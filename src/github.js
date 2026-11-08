const API = "https://api.github.com";
const ZERO = /^0+$/;

export function githubHeaders(token, accept = "application/vnd.github+json") {
  const headers = {
    Accept: accept,
    "User-Agent": "PatinaBot",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function orgEvents(org, token, etag, doFetch = fetch) {
  const headers = githubHeaders(token);
  if (etag) headers["If-None-Match"] = etag;
  const res = await doFetch(`${API}/orgs/${org}/events?per_page=100`, { headers });
  if (res.status === 304) return { events: null, etag };
  if (!res.ok) throw new Error(`events ${res.status}`);
  return { events: await res.json(), etag: res.headers.get("etag") ?? etag };
}

export async function remoteSha(repo, branch, token, doFetch = fetch) {
  const res = await doFetch(`${API}/repos/${repo}/commits/${branch}`, {
    headers: githubHeaders(token, "application/vnd.github.sha"),
  });
  if (!res.ok) throw new Error(`commit ${res.status}`);
  return (await res.text()).trim();
}

export async function pushCommits(repo, before, head, token, doFetch = fetch) {
  const single = ZERO.test(before);
  const url = single
    ? `${API}/repos/${repo}/commits/${head}`
    : `${API}/repos/${repo}/compare/${before}...${head}`;
  const res = await doFetch(url, { headers: githubHeaders(token) });
  if (!res.ok) throw new Error(`commits ${res.status}`);
  const data = await res.json();
  const list = single ? [data] : data.commits;
  return list.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    url: c.html_url,
  }));
}
