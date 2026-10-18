import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Local API used by the feedback loop (D8): the dev server writes into ../feedback/.
//   GET  /api/feedback  -> all saved feedback entries (feeds the power factor's rating term)
//   POST /api/feedback  -> save one entry as feedback/<timestamp>-<champion>.json
//   GET  /api/tuning    -> feedback/tuning.json (auto-tuned weights), {} if missing
//   POST /api/tuning    -> overwrite feedback/tuning.json
const FEEDBACK_DIR = path.resolve(__dirname, "../feedback");

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function feedbackApi(): Plugin {
  return {
    name: "impossible-aram-feedback-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
        res.setHeader("Content-Type", "application/json");
        try {
          if (req.url === "/api/feedback" && req.method === "GET") {
            const entries = fs
              .readdirSync(FEEDBACK_DIR)
              .filter((f) => f.endsWith(".json") && f !== "tuning.json")
              .map((f) => JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR, f), "utf-8")));
            res.end(JSON.stringify(entries));
            return;
          }
          if (req.url === "/api/feedback" && req.method === "POST") {
            const entry = JSON.parse(await readBody(req));
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const safe = String(entry.champion ?? "build").replace(/[^A-Za-z0-9]/g, "");
            const file = path.join(FEEDBACK_DIR, `${stamp}-${safe}.json`);
            fs.writeFileSync(file, JSON.stringify(entry, null, 2) + "\n", "utf-8");
            res.end(JSON.stringify({ ok: true, file: path.basename(file) }));
            return;
          }
          if (req.url === "/api/tuning") {
            const file = path.join(FEEDBACK_DIR, "tuning.json");
            if (req.method === "GET") {
              res.end(fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "{}");
              return;
            }
            if (req.method === "POST") {
              const body = JSON.parse(await readBody(req));
              fs.writeFileSync(file, JSON.stringify(body, null, 2) + "\n", "utf-8");
              res.end(JSON.stringify({ ok: true }));
              return;
            }
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "not found" }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), feedbackApi()],
  server: { port: 5173, open: false },
});
