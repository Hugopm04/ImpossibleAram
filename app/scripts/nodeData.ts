// Node-side data reader for scripts (precompute, smoke tests).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { JsonReader } from "../src/engine/data";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(here, "../public/data");

export const nodeReader: JsonReader = async (name) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf-8"));
