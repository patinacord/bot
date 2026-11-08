import { execFile } from "node:child_process";
import { remoteSha } from "./github.js";

export function localSha() {
  return new Promise((resolve) => {
    execFile("git", ["rev-parse", "HEAD"], (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
}

export function createUpdater({ repo, branch, token, state, restart, doFetch = fetch, getLocal = localSha }) {
  async function check() {
    const local = await getLocal();
    if (!local) return "no-git";
    const remote = await remoteSha(repo, branch, token, doFetch);
    if (remote === local) return "current";
    if (state.get("restartedFor") === remote) return "pending";
    state.set("restartedFor", remote);
    restart(remote);
    return "restarting";
  }

  return { check };
}
