import express from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data", "history.json");
const PORT = 3001;

function loadData() {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {}
  return {};
}

function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json());

app.get("/api/history", (_req, res) => {
  res.json(loadData());
});

app.post("/api/history", (req, res) => {
  saveData(req.body);
  res.json({ ok: true });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Växtmanual API listening on port ${PORT}`);
});
