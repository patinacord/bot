import { config } from "./config.js";
import { formatEvent } from "./format.js";
import { orgEvents, pushCommits } from "./github.js";

export function createEventWatcher({
  state,
  send,
  token,
  org = config.githubOrg,
  doFetch = fetch,
}) {
  let etag;
  const getCommits = (repo, before, head) => pushCommits(repo, before, head, token, doFetch);

  async function check() {
    const result = await orgEvents(org, token, etag, doFetch);
    etag = result.etag;
    if (!result.events) return 0;

    const events = result.events
      .map((e) => ({ ...e, key: BigInt(e.id) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const last = state.get("lastEventId");
    if (last === undefined) {
      state.set("lastEventId", events.length > 0 ? events[events.length - 1].id : "0");
      return 0;
    }

    let posted = 0;
    for (const event of events) {
      if (event.key <= BigInt(last)) continue;
      const message = await formatEvent(event, getCommits);
      if (message) {
        await send(message.channel, message.payload);
        posted++;
      }
      state.set("lastEventId", event.id);
    }
    return posted;
  }

  return { check };
}
