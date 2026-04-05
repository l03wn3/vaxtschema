import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data", "history.json");
const PLANTS_FILE = join(__dirname, "data", "plants.json");
const PLANTS_DIR = join(__dirname, "public", "plants");
const PLANTS_HIRES_DIR = join(PLANTS_DIR, "hires");
const PORT = 3001;

// Ensure directories exist
[join(__dirname, "data"), PLANTS_DIR, PLANTS_HIRES_DIR].forEach(dir => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// Configure multer for image uploads
const upload = multer({ storage: multer.memoryStorage() });

function loadData() {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {}
  return {};
}

function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadPlants() {
  try {
    if (existsSync(PLANTS_FILE)) return JSON.parse(readFileSync(PLANTS_FILE, "utf8"));
  } catch {}
  return [];
}

function savePlants(plants) {
  writeFileSync(PLANTS_FILE, JSON.stringify(plants, null, 2));
}

const app = express();
app.use(express.json());
app.use(express.static("public"));

// History endpoints
app.get("/api/history", (_req, res) => {
  res.json(loadData());
});

app.post("/api/history", (req, res) => {
  saveData(req.body);
  res.json({ ok: true });
});

// Plants endpoints
app.get("/api/plants", (_req, res) => {
  const plants = loadPlants();
  res.json(plants);
});

app.post("/api/plants", (req, res) => {
  const { plants } = req.body;
  if (!Array.isArray(plants)) {
    return res.status(400).json({ error: "plants must be an array" });
  }
  savePlants(plants);
  res.json({ ok: true });
});

// Image upload endpoint
app.post("/api/plants/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    // Generate unique filename using timestamp + random
    const filename = `plant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const thumbPath = join(PLANTS_DIR, filename);
    const hiresPath = join(PLANTS_HIRES_DIR, filename);

    // Create thumbnail (120x120)
    await sharp(req.file.buffer)
      .resize(120, 120, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toFile(thumbPath);

    // Create high-res (800x800)
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: "cover", position: "center" })
      .jpeg({ quality: 90 })
      .toFile(hiresPath);

    res.json({ filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process image" });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Växtmanual API listening on port ${PORT}`);
});
