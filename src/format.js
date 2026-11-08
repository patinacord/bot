import { config } from "./config.js";

const ZERO = /^0+$/;
const OK_ACTIONS = ["opened", "reopened", "closed"];

const short = (repo) => repo.split("/")[1] ?? repo;

function clip(text, max) {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}...` : t;
}

function base(event) {
  return {
    color: config.color,
    timestamp: event.created_at,
    author: {
      name: event.actor.display_login ?? event.actor.login,
      icon_url: event.actor.avatar_url,
      url: `https://github.com/${event.actor.login}`,
    },
  };
}

export function commitLine(repo, commit) {
  const first = commit.message.split("\n")[0];
  const url = commit.url ?? `https://github.com/${repo}/commit/${commit.sha}`;
  return `[\`${commit.sha.slice(0, 7)}\`](${url}) ${clip(first, 72)}`;
}

function pushTitle(repo, count, branch) {
  const what = count === 1 ? "1 new commit" : count > 1 ? `${count} new commits` : "new push";
  return `${short(repo)}: ${what} on ${branch}`;
}

async function pushMessage(event, getCommits) {
  const { ref, before, head } = event.payload;
  if (!ref?.startsWith("refs/heads/") || ZERO.test(head)) return null;
  const branch = ref.slice("refs/heads/".length);
  const repo = event.repo.name;

  let commits = [];
  if (Array.isArray(event.payload.commits) && event.payload.commits.length > 0) {
    commits = event.payload.commits.map((c) => ({ sha: c.sha, message: c.message }));
  } else {
    try {
      commits = await getCommits(repo, before, head);
    } catch {
      commits = [];
    }
  }

  const lines = commits.slice(0, 5).map((c) => commitLine(repo, c));
  if (commits.length > 5) lines.push(`and ${commits.length - 5} more`);
  const url = ZERO.test(before)
    ? `https://github.com/${repo}/commit/${head}`
    : `https://github.com/${repo}/compare/${before.slice(0, 12)}...${head.slice(0, 12)}`;

  return {
    channel: "github",
    payload: {
      embeds: [
        {
          ...base(event),
          title: pushTitle(repo, commits.length, branch),
          url,
          description: lines.join("\n") || undefined,
        },
      ],
    },
  };
}

function withBody(title, body, action) {
  const extra = action === "opened" && body ? `\n${clip(body, 300)}` : "";
  return `**${clip(title, 200)}**${extra}`;
}

function pullMessage(event) {
  const { action, pull_request: pr } = event.payload;
  if (!OK_ACTIONS.includes(action)) return null;
  const verb = action === "closed" ? (pr.merged ? "merged" : "closed") : action;
  return {
    channel: "github",
    payload: {
      embeds: [
        {
          ...base(event),
          title: `${short(event.repo.name)}: pr #${pr.number} ${verb}`,
          url: pr.html_url,
          description: withBody(pr.title, pr.body, action),
        },
      ],
    },
  };
}

function issueMessage(event) {
  const { action, issue } = event.payload;
  if (!OK_ACTIONS.includes(action)) return null;
  return {
    channel: "github",
    payload: {
      embeds: [
        {
          ...base(event),
          title: `${short(event.repo.name)}: issue #${issue.number} ${action}`,
          url: issue.html_url,
          description: withBody(issue.title, issue.body, action),
        },
      ],
    },
  };
}

function releaseMessage(event) {
  const { action, release } = event.payload;
  if (action !== "published") return null;
  return {
    channel: "github",
    payload: {
      embeds: [
        {
          ...base(event),
          title: `${short(event.repo.name)} ${release.name || release.tag_name}`,
          url: release.html_url,
          description: clip(release.body, 1500) || undefined,
        },
      ],
    },
  };
}

function starMessage(event) {
  const repo = event.repo.name;
  return {
    channel: "github",
    payload: {
      embeds: [
        {
          ...base(event),
          description: `starred [${short(repo)}](https://github.com/${repo})`,
        },
      ],
    },
  };
}

function forkMessage(event) {
  const repo = event.repo.name;
  const forkee = event.payload.forkee;
  return {
    channel: "github",
    payload: {
      embeds: [
        {
          ...base(event),
          description: `forked [${short(repo)}](https://github.com/${repo}) to [${forkee.full_name}](${forkee.html_url})`,
        },
      ],
    },
  };
}

export async function formatEvent(event, getCommits) {
  switch (event.type) {
    case "PushEvent":
      return pushMessage(event, getCommits);
    case "PullRequestEvent":
      return pullMessage(event);
    case "IssuesEvent":
      return issueMessage(event);
    case "ReleaseEvent":
      return releaseMessage(event);
    case "WatchEvent":
      return starMessage(event);
    case "ForkEvent":
      return forkMessage(event);
    default:
      return null;
  }
}
