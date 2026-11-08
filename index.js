import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ActivityType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./src/config.js";
import { createEventWatcher } from "./src/events.js";
import { createState } from "./src/state.js";
import { createUpdater } from "./src/updater.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN is missing. Put it in a .env file next to index.js");
  process.exit(1);
}

const githubToken = process.env.GITHUB_TOKEN || undefined;
const here = path.dirname(fileURLToPath(import.meta.url));
const state = createState(path.join(here, "data", "state.json"));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function send(_name, payload) {
  const channel = await client.channels.fetch(config.githubChannelId);
  await channel.send(payload);
}

const events = createEventWatcher({ state, send, token: githubToken });
const updater = createUpdater({
  repo: config.botRepo,
  branch: config.botBranch,
  token: githubToken,
  state,
  restart(sha) {
    console.log(`new commit ${sha.slice(0, 7)}, restarting to update`);
    client.destroy().finally(() => process.exit(1));
  },
});

function every(ms, label, fn) {
  const run = async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`${label} failed: ${error.message}`);
    }
  };
  run();
  setInterval(run, ms).unref();
}

client.once("clientReady", () => {
  console.log(`online as ${client.user.tag}`);
  client.user.setPresence({
    status: "online",
    activities: [{ name: config.status, type: ActivityType.Watching }],
  });
  every(config.eventPollMs, "github check", () => events.check());
  every(config.updatePollMs, "update check", () => updater.check());
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => client.destroy().finally(() => process.exit(0)));
}

client.login(token);
