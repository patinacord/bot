import fs from "node:fs";
import path from "node:path";

export function createState(file) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return {
    exists: fs.existsSync(file),
    get: (key) => data[key],
    set(key, value) {
      data[key] = value;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    },
  };
}
