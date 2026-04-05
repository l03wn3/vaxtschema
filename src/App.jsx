import { useState, useEffect } from "react";

const VERSION = __APP_VERSION__;
const CHANGELOG = __APP_CHANGELOG__;

const SW = ["SÃ¶ndag","MÃ¥ndag","Tisdag","Onsdag","Torsdag","Fredag","LÃ¶rdag"];
const MON = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
const TODAY = new Date();
const STORAGE_KEY = "vaxtmanual_history";
const RETENTION_DAYS = 7;

async function loadPlants() {
  try {
    const res = await fetch("/api/plants");
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

async function loadHistoryFromServer() {
  try {
    const res = await fetch("/api/history");
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}

function saveHistoryToServer(h) {
  fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(h),
  }).catch(() => {});
}

async function savePlantsToServer(plants) {
  try {
    await fetch("/api/plants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plants }),
    });
  } catch (err) {
    console.error("Failed to save plants:", err);
  }
}

function purgeOld(h) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const cleaned = { ...h };
  Object.keys(cleaned).forEach(d => { if (d < cutoffStr) delete cleaned[d]; });
  return cleaned;
}

function fmtDate(d) {
  return `${["SÃ¶n","MÃ¥n","Tis","Ons","Tor","Fre","LÃ¶r"][d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

// Helper to derive weeklyMap and rareGroup from plants
function deriveScheduleMaps(plants) {
  const weeklyMap = { 0: [], 3: [], 5: [] };
  const rareGroup = [];

  plants.forEach((p, idx) => {
    const pid = idx + 1; // 1-based plant ID
    if (!Array.isArray(p.schedule)) return;

    if (p.schedule.includes("rare")) {
      rareGroup.push(pid);
    } else {
      p.schedule.forEach(day => {
        if (day in weeklyMap && !weeklyMap[day].includes(pid)) {
          weeklyMap[day].push(pid);
        }
      });
    }
  });

  return { weeklyMap, rareGroup };
}

function generateUpcoming(plants, weeklyMap, rareGroup) {
  const events = [];
  for (let d = 0; d <= 14; d++) {
    const date = new Date(TODAY);
    date.setDate(TODAY.getDate() + d);
    const dow = date.getDay();
    if (!weeklyMap[dow]) continue;
    events.push({ date, dayName: SW[dow], plants: weeklyMap[dow] });
  }
  const rareDate = new Date(TODAY);
  rareDate.setDate(TODAY.getDate() + 12);
  if (rareGroup.length > 0) {
    events.push({ date: rareDate, dayName: "Var 10â€“14 dag", plants: rareGroup, isRare: true });
  }
  events.sort((a, b) => a.date - b.date);
  return events;
}

function plantDays(pid, weeklyMap, rareGroup) {
  const d = [];
  if (weeklyMap[0]?.includes(pid)) d.push("SÃ¶n");
  if (weeklyMap[3]?.includes(pid)) d.push("Ons");
  if (weeklyMap[5]?.includes(pid)) d.push("Fre");
  if (rareGroup.includes(pid)) d.push("10â€“14d");
  return d;
}

function lastWateredLabel(history) {
  const dates = Object.keys(history).filter(d => history[d]?.length > 0).sort();
  if (!dates.length) return null;
  const last = new Date(dates[dates.length - 1] + "T12:00:00");
  return `ğŸ’§ Vattnade ${last.getDate()} ${MON[last.getMonth()]}`;
}

function PlantModal({ plant, pid, weeklyMap, rareGroup, onClose }) {
  if (!plant) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>âœ•</button>
        <img src={`/plants/hires/${plant.image}`} alt={plant.id} className="modal-img" />
        <div className="modal-badge" style={{ background: plant.color }}>#{pid}</div>
        <div className="modal-body">
          <h2 className="modal-title">{plant.id}</h2>
          <div className="modal-rule">
            <span className="modal-rule-icon">ğŸ’§</span>
            {plant.rule}
          </div>
          <div className="modal-schedule">
            {plantDays(pid, weeklyMap, rareGroup).map(d => <span key={d} className="chip">{d}</span>)}
          </div>
          <p className="modal-wiki">{plant.wiki}</p>
        </div>
      </div>
    </div>
  );
}

function AdminTab({ plants, onSave, onAddPlant }) {
  const [reordered, setReordered] = useState(plants);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    rule: "",
    color: "#5A8A5E",
    wiki: "",
    schedule: [0],
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const colors = [...new Set(plants.map(p => p.color))];

  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...reordered];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setReordered(arr);
  };

  const moveDown = (idx) => {
    if (idx === reordered.length - 1) return;
    const arr = [...reordered];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setReordered(arr);
  };

  const handleSave = () => {
    onSave(reordered);
  };

  const handleAddPlant = async () => {
    if (!formData.id || !formData.rule || !selectedFile) {
      alert("Fyll i alla fÃ¤lt och vÃ¤lj en bild");
      return;
    }

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append("image", selectedFile);

    try {
      const res = await fetch("/api/plants/upload", {
        method: "POST",
        body: uploadFormData,
      });
      const { filename } = await res.json();

      const newPlant = {
        ...formData,
        image: filename,
      };

      const updatedPlants = [...reordered, newPlant];
      setReordered(updatedPlants);
      onAddPlant(updatedPlants);

      setFormData({
        id: "",
        rule: "",
        color: "#5A8A5E",
        wiki: "",
        schedule: [0],
      });
      setSelectedFile(null);
      setShowForm(false);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Laddningen misslyckades");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-section">
        <h3 className="admin-title">VÃ¤xtsamling ({reordered.length})</h3>
        <div className="plant-list">
          {reordered.map((p, idx) => (
            <div key={idx} className="admin-plant-row">
              <img src={`/plants/${p.image}`} alt={p.id} className="admin-thumb" />
              <div className="admin-plant-info">
                <div className="admin-plant-name">{p.id}</div>
                <div className="admin-plant-number">#{idx + 1}</div>
              </div>
              <div className="admin-buttons">
                <button onClick={() => moveUp(idx)} className="admin-btn" disabled={idx === 0}>â¬†</button>
                <button onClick={() => moveDown(idx)} className="admin-btn" disabled={idx === reordered.length - 1}>â¬‡</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleSave} className="admin-save-btn">Spara ordning</button>
      </div>

      <div className="admin-section">
        <h3 className="admin-title">LÃ¤gg till vÃ¤xt</h3>
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="admin-add-btn">+ LÃ¤gg till ny vÃ¤xt</button>
        ) : (
          <div className="admin-form">
            <input
              type="text"
              placeholder="VÃ¤xtens namn"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              className="form-input"
            />
            <input
              type="text"
              placeholder="Vattningsregel"
              value={formData.rule}
              onChange={(e) => setFormData({ ...formData, rule: e.target.value })}
              className="form-input"
            />
            <select
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="form-input"
            >
              {colors.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <textarea
              placeholder="VÃ¤xtbeskrivning (wiki)"
              value={formData.wiki}
              onChange={(e) => setFormData({ ...formData, wiki: e.target.value })}
              className="form-input"
              rows="4"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="form-input"
            />
            <div className="form-buttons">
              <button onClick={handleAddPlant} disabled={uploading} className="form-submit">
                {uploading ? "Laddar upp..." : "LÃ¤gg till"}
              </button>
              <button onClick={() => setShowForm(false)} className="form-cancel">Avbryt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VÃ¤xtManual() {
  const [tab, setTab] = useState("schema");
  const [plants, setPlants] = useState([]);
  const [history, setHistory] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [modalPlant, setModalPlant] = useState(null);
  const [weeklyMap, setWeeklyMap] = useState({});
  const [rareGroup, setRareGroup] = useState([]);

  // Load plants and history on mount
  useEffect(() => {
    Promise.all([loadPlants(), loadHistoryFromServer()]).then(([p, h]) => {
      setPlants(p);
      if (p.length > 0) {
        const { weeklyMap, rareGroup } = deriveScheduleMaps(p);
        setWeeklyMap(weeklyMap);
        setRareGroup(rareGroup);
      }
      setHistory(purgeOld(h));
      setLoaded(true);
    });
  }, []);

  // Save history when it changes
  useEffect(() => { if (loaded) saveHistoryToServer(history); }, [history, loaded]);

  const toggle = (dateStr, pid) => {
    setHistory(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = [];
      const arr = [...next[dateStr]];
      const idx = arr.indexOf(pid);
      if (idx > -1) arr.splice(idx, 1);
      else arr.push(pid);
      return { ...next, [dateStr]: arr };
    });
  };

  const isChecked = (dateStr, pid) => (history[dateStr] || []).includes(pid);
  const upcoming = generateUpcoming(plants, weeklyMap, rareGroup);
  const plantCount = plants.length;

  const handleAdminSave = (reorderedPlants) => {
    setPlants(reorderedPlants);
    savePlantsToServer(reorderedPlants);
    const { weeklyMap, rareGroup } = deriveScheduleMaps(reorderedPlants);
    setWeeklyMap(weeklyMap);
    setRareGroup(rareGroup);
  };

  const handleAddPlant = (updatedPlants) => {
    setPlants(updatedPlants);
    savePlantsToServer(updatedPlants);
    const { weeklyMap, rareGroup } = deriveScheduleMaps(updatedPlants);
    setWeeklyMap(weeklyMap);
    setRareGroup(rareGroup);
  };

  if (!loaded) {
    return <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F5F0E8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Laddar...</div>;
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F5F0E8", minHeight: "100vh", color: "#26200F" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .hdr { background: #1E3A0E; padding: 20px 18px 0; position: sticky; top: 0; z-index: 10; }
        .hdr-top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; }
        .hdr-title { font-family: 'Playfair Display', serif; font-size: 22px; color: #F5F0E8; font-weight: 700; }
        .hdr-sub { font-size: 11px; color: rgba(245,240,232,0.55); font-weight: 300; margin-top: 2px; letter-spacing: 0.5px; }
        .version-badge { font-size: 10px; color: rgba(245,240,232,0.4); margin-top: 3px; }
        .badge-today { background: #B85C38; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; margin-top: 3px; }
        .tabs { display: flex; gap: 4px; }
        .tab-btn { flex: 1; padding: 10px 0; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; background: transparent; color: rgba(245,240,232,0.5); border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn.active { color: #F5F0E8; border-bottom-color: #8CB87A; }
        .notice { background: #FDF5E6; border-left: 3px solid #B85C38; padding: 10px 14px; margin: 14px 14px 0; border-radius: 0 8px 8px 0; font-size: 12.5px; color: #6B5538; line-height: 1.5; }
        .content { padding: 14px 14px 80px; }
        .day-card { background: white; border-radius: 14px; overflow: hidden; margin-bottom: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
        .day-hdr { background: #1E3A0E; color: #F5F0E8; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
        .day-hdr-name { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; }
        .day-hdr-date { font-size: 12px; opacity: 0.6; }
        .rare-pill { background: #9A7A1A; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; margin-right: 6px; }
        .p-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid #F0EBE0; cursor: pointer; transition: background 0.15s; -webkit-tap-highlight-color: transparent; }
        .p-row:last-child { border-bottom: none; }
        .p-row:active { background: #F5F0E8; }
        .p-info { flex: 1; }
        .p-species { font-size: 12px; color: #9A8878; font-weight: 300; }
        .p-rule { font-size: 14px; font-weight: 500; margin-top: 1px; }
        .p-check { font-size: 18px; flex-shrink: 0; }
        .all-card { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.07); margin-bottom: 14px; }
        .all-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #F0EBE0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .all-row:last-child { border-bottom: none; }
        .all-row:active { background: #F5F0E8; }
        .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
        .chip { background: #EEE9DF; color: #6B5538; padding: 2px 7px; border-radius: 8px; font-size: 11px; font-weight: 500; }
        .all-row-right { flex: 1; }
        .all-name { font-size: 14px; font-weight: 500; }
        .all-species { font-size: 12px; color: #9A8878; font-weight: 300; margin-top: 1px; }
        .all-disclaimer { font-size: 11.5px; color: #9A8878; margin: 0 0 12px; font-style: italic; line-height: 1.4; }
        .sec-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #9A8878; margin: 18px 0 8px; }
        .thumb { position: relative; flex-shrink: 0; }
        .thumb img { display: block; border-radius: 10px; object-fit: cover; }
        .thumb-badge { position: absolute; bottom: 0; right: 0; color: white; border-radius: 6px 0 10px 0; font-size: 10px; font-weight: 700; padding: 1px 4px; line-height: 1.4; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.2s ease; }
        .modal-content { background: #F5F0E8; border-radius: 20px 20px 0 0; max-height: 85vh; width: 100%; max-width: 500px; overflow-y: auto; -webkit-overflow-scrolling: touch; position: relative; animation: slideUp 0.3s ease; }
        .modal-close { position: absolute; top: 12px; right: 14px; background: rgba(0,0,0,0.4); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 16px; cursor: pointer; z-index: 2; display: flex; align-items: center; justify-content: center; }
        .modal-img { width: 100%; height: 250px; object-fit: cover; border-radius: 20px 20px 0 0; }
        .modal-badge { position: absolute; top: 216px; left: 16px; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; }
        .modal-body { padding: 20px 18px 48px; }
        .modal-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #1E3A0E; }
        .modal-rule { background: white; padding: 12px 14px; border-radius: 12px; font-size: 15px; font-weight: 500; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .modal-rule-icon { font-size: 18px; }
        .modal-schedule { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .modal-wiki { font-size: 14px; line-height: 1.6; color: #4A4030; }

        .admin-container { padding: 14px; }
        .admin-section { background: white; border-radius: 14px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
        .admin-title { font-size: 15px; font-weight: 600; color: #1E3A0E; margin-bottom: 14px; }
        .plant-list { margin-bottom: 14px; }
        .admin-plant-row { display: flex; align-items: center; gap: 12px; padding: 12px; background: #F9F6F0; border-radius: 10px; margin-bottom: 10px; }
        .admin-thumb { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; }
        .admin-plant-info { flex: 1; }
        .admin-plant-name { font-size: 13px; font-weight: 500; }
        .admin-plant-number { font-size: 11px; color: #9A8878; margin-top: 2px; }
        .admin-buttons { display: flex; gap: 8px; }
        .admin-btn { padding: 8px 12px; background: #1E3A0E; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; }
        .admin-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .admin-save-btn { width: 100%; padding: 12px; background: #1E3A0E; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .admin-add-btn { width: 100%; padding: 12px; background: #8CB87A; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .admin-form { display: flex; flex-direction: column; gap: 12px; }
        .foÉ´µ¥¹ÁÕĞìÁ…‘‘¥¹œè€ÄÁÁà€ÄÉÁàì‰½É‘•Èè€ÅÁàÍ½±¥€áÁÔì‰½É‘•ÈµÉ…‘¥ÕÌè€áÁàì™½¹Ğµ™…µ¥±äè€4M…¹Ìœ°Í…¹ÌµÍ•É¥˜ì™½¹ĞµÍ¥é”è€ÄÍÁàìô(€€€€€€€€¹™½É´µ¥¹ÁÕĞé™½ÕÌì½ÕÑ±¥¹”è¹½¹”ì‰½É‘•Èµ½±½Èè€Œáàİìô(€€€€€€€€¹™½É´µ‰ÕÑÑ½¹Ìì‘¥ÍÁ±…äè™±•àì…Àè€ÄÁÁàìô(€€€€€€€€¹™½É´µÍÕ‰µ¥Ğì™±•àè€ÄìÁ…‘‘¥¹œè€ÄÁÁàì‰…­É½Õ¹è€Œáàİì½±½Èèİ¡¥Ñ”ì‰½É‘•Èè¹½¹”ì‰½É‘•ÈµÉ…‘¥ÕÌè€áÁàì™½¹Ğµİ•¥¡Ğè€ØÀÀìÕÉÍ½ÈèÁ½¥¹Ñ•Èìô(€€€€€€€€¹™½É´µ…¹•°ì™±•àè€ÄìÁ…‘‘¥¹œè€ÄÁÁàì‰…­É½Õ¹è€áÁÔì½±½Èè€ŒÙÔÔÌàì‰½É‘•Èè¹½¹”ì‰½É‘•ÈµÉ…‘¥ÕÌè€áÁàì™½¹Ğµİ•¥¡Ğè€ØÀÀìÕÉÍ½ÈèÁ½¥¹Ñ•Èìô((€€€€€€€­•å™É…µ•Ì™…‘•%¸ì™É½´ì½Á…¥Ñäè€ÀìôÑ¼ì½Á…¥Ñäè€Äìôô(€€€€€€€­•å™É…µ•ÌÍ±¥‘•UÀì™É½´ìÑÉ…¹Í™½É´èÑÉ…¹Í±…Ñ•d ÄÀÀ”¤ìôÑ¼ìÑÉ…¹Í™½É´èÑÉ…¹Í±…Ñ•d À¤ìôô(€€€€€ôğ½ÍÑå±”ø((€€€€€íµ½‘…±A±…¹Ğ€„ôô¹Õ±°€˜˜€ñA±…¹Ñ5½‘…°(€€€€€€€Á±…¹ĞõíÁ±…¹ÑÍmµ½‘…±A±…¹Ğ€´€Åuô(€€€€€€€Á¥õíµ½‘…±A±…¹Ñô(€€€€€€€İ••­±å5…Àõíİ••­±å5…Áô(€€€€€€€É…É•É½ÕÀõíÉ…É•É½ÕÁô(€€€€€€€½¹±½Í”õì ¤€ôøÍ•Ñ5½‘…±A±…¹Ğ¡¹Õ±°¥ô(€€€€€€¼ùô((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡‘Èˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡‘ÈµÑ½Àˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡‘ÈµÑ¥Ñ±”ˆûÂ~2ü[‘áÑµ…¹Õ…°ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡‘ÈµÍÕˆˆùíÁ±…¹Ñ½Õ¹Ñô[aQHƒ
ÜOY8€¼=9L€¼Iğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ù•ÉÍ¥½¸µ‰…‘”ˆùíYIM%=9ôƒ
Üí!91=ôğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€í±…ÍÑ]…Ñ•É•‘1…‰•°¡¡¥ÍÑ½Éä¤€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…‘”µÑ½‘…äˆùí±…ÍÑ]…Ñ•É•‘1…‰•°¡¡¥ÍÑ½Éä¥ôğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ…‰Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíÑ…ˆµ‰Ñ¸€‘íÑ…ˆ€ôôô€‰Í¡•µ„ˆ€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰õô½¹±¥¬õì ¤€ôøÍ•ÑQ…ˆ ‰Í¡•µ„ˆ¥ôù-½µµ…¹‘”ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíÑ…ˆµ‰Ñ¸€‘íÑ…ˆ€ôôô€‰Á±…¹ÑÌˆ€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰õô½¹±¥¬õì ¤€ôøÍ•ÑQ…ˆ ‰Á±…¹ÑÌˆ¥ôù±±„Û‘áÑ•Èğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíÑ…ˆµ‰Ñ¸€‘íÑ…ˆ€ôôô€‰…‘µ¥¸ˆ€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰õô½¹±¥¬õì ¤€ôøÍ•ÑQ…ˆ ‰…‘µ¥¸ˆ¥ôù‘µ¥¸ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€íÑ…ˆ€ôôô€‰Í¡•µ„ˆ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¹½Ñ¥”ˆûÂ~N€ñÍÑÉ½¹œùM¡•µ„èOÙ¹‘…œ€¬=¹Í‘…œ€¬É•‘…œ¸ğ½ÍÑÉ½¹œøğ½‘¥Øø(€€€€€€¥ô((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½¹Ñ•¹Ğˆø(€€€€€€€íÑ…ˆ€ôôô€‰Í¡•µ„ˆ€ü€ (€€€€€€€€€ÕÁ½µ¥¹œ¹µ…À ¡•Ø°¤¤€ôøì(€€€€€€€€€€€½¹ÍĞ‘…Ñ•MÑÈ€ô•Ø¹‘…Ñ”¹Ñ½%M=MÑÉ¥¹œ ¤¹ÍÁ±¥Ğ ‰Pˆ¥lÁtì(€€€€€€€€€€€½¹ÍĞ…±±½¹”€ô•Ø¹Á±…¹ÑÌ¹•Ù•Éä¡Á¥€ôø¥Í¡•­•¡‘…Ñ•MÑÈ°Á¥¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘…äµ…Éˆ­•äõí¥ôÍÑå±”õíì½Á…¥Ñäè…±±½¹”€ü€À¸Ø€è€Äõôø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘…äµ¡‘Èˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘…äµ¡‘Èµ¹…µ”ˆùí•Ø¹‘…å9…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°…±¥¹%Ñ•µÌè€‰•¹Ñ•Èˆõôø(€€€€€€€€€€€€€€€€€€€í•Ø¹¥ÍI…É”€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰É…É”µÁ¥±°ˆøÄÃŠLÄĞ‘…œğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰‘…äµ¡‘Èµ‘…Ñ”ˆùí™µÑ…Ñ”¡•Ø¹‘…Ñ”¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€í•Ø¹Á±…¹ÑÌ¹µ…À¡Á¥€ôøì(€€€€€€€€€€€€€€€€€½¹ÍĞÀ€ôÁ±…¹ÑÍmÁ¥€´€Åtì(€€€€€€€€€€€€€€€€€¥˜€ …À¤É•ÑÕÉ¸¹Õ±°ì(€€€€€€€€€€€€€€€€€½¹ÍĞ‘½¹”€ô¥Í¡•­•¡‘…Ñ•MÑÈ°Á¥¤ì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÀµÉ½Üˆ­•äõíÁ¥‘ôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ¡Õµˆˆ½¹±¥¬õì¡”¤€ôøì”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ìÍ•Ñ5½‘…±A±…¹Ğ¡Á¥¤ìõôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥µœÍÉŒõí€½Á±…¹ÑÌ¼‘íÀ¹¥µ…•õô…±Ğõí[‘áĞ€Œ‘íÁ¥‘õôİ¥‘Ñ õìĞáô¡•¥¡ĞõìĞáô(€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑå±”õíì½Á…¥Ñäè‘½¹”€ü€À¸Ğ€è€Ä°™¥±Ñ•Èè‘½¹”€ü€‰É…åÍ…±” àÀ”¤ˆ€è€‰¹½¹”ˆõô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ¡Õµˆµ‰…‘”ˆÍÑå±”õíì‰…­É½Õ¹è‘½¹”€ü€ˆÑáàˆ€èÀ¹½±½ÈõôùíÁ¥‘ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Àµ¥¹™¼ˆ½¹±¥¬õì ¤€ôøÑ½±”¡‘…Ñ•MÑÈ°Á¥¥ôÍÑå±”õíì½Á…¥Ñäè‘½¹”€ü€À¸Ô€è€Äõôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÀµÍÁ•¥•ÌˆùíÀ¹¥‘ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÀµÉÕ±”ˆùíÀ¹ÉÕ±•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Àµ¡•¬ˆ½¹±¥¬õì ¤€ôøÑ½±”¡‘…Ñ•MÑÈ°Á¥¥ôùí‘½¹”€ü€‹Šrˆ€è€‹Š^,‰ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¤(€€€€€€€€¤€èÑ…ˆ€ôôô€‰Á±…¹ÑÌˆ€ü€ (€€€€€€€€€€ğø(€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰…±°µ‘¥Í±…¥µ•ÈˆùÉÑ•É¹„¹•‘…¸ƒ‘È›ÙÉÍ±…œ‰…Í•É…‘”Ã”‰¥±‘•É¹„ƒŠP‰•­Ë‘™Ñ„Ÿ‘É¹„„ğ½Àø(€€€€€€€€€€€íl(€€€€€€€€€€€€€ì±…‰•°è€‰	…É„ÏÙ¹‘…œˆ°¥‘ÌèÁ±…¹ÑÌ¹µ…À ¡À°¥‘à¤€ôøÀ¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì À¤€˜˜€…À¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì Ì¤€˜˜€…À¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì Ô¤€ü¥‘à€¬€Ä€è¹Õ±°¤¹™¥±Ñ•È¡	½½±•…¸¤ô°(€€€€€€€€€€€€€ì±…‰•°è€‰OÙ¹‘…œ€¬½¹Í‘…œˆ°¥‘ÌèÁ±…¹ÑÌ¹µ…À ¡À°¥‘à¤€ôøÀ¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì À¤€˜˜À¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì Ì¤€˜˜€…À¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì Ô¤€ü¥‘à€¬€Ä€è¹Õ±°¤¹™¥±Ñ•È¡	½½±•…¸¤ô°(€€€€€€€€€€€€€ì±…‰•°è€‰OÙ¸€¬½¹Ì€¬™É”ˆ°¥‘ÌèÁ±…¹ÑÌ¹µ…À ¡À°¥‘à¤€ôøÀ¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì À¤€˜˜À¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì Ì¤€˜˜À¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì Ô¤€ü¥‘à€¬€Ä€è¹Õ±°¤¹™¥±Ñ•È¡	½½±•…¸¤ô°(€€€€€€€€€€€€€ì±…‰•°è€‰Y…È€ÄÃŠLÄĞ‘…œˆ°¥‘ÌèÁ±…¹ÑÌ¹µ…À ¡À°¥‘à¤€ôøÀ¹Í¡•‘Õ±”¹¥¹±Õ‘•Ì ‰É…É”ˆ¤€ü¥‘à€¬€Ä€è¹Õ±°¤¹™¥±Ñ•È¡	½½±•…¸¤ô°(€€€€€€€€€€€t¹µ…À¡É½ÕÀ€ôøÉ½ÕÀ¹¥‘Ì¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÉ½ÕÀ¹±…‰•±ôø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Œµ±…‰•°ˆùíÉ½ÕÀ¹±…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±°µ…Éˆø(€€€€€€€€€€€€€€€€€íÉ½ÕÀ¹¥‘Ì¹µ…À¡Á¥€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÀ€ôÁ±…¹ÑÍmÁ¥€´€Åtì(€€€€€€€€€€€€€€€€€€€¥˜€ …À¤É•ÑÕÉ¸¹Õ±°ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±°µÉ½Üˆ­•äõíÁ¥‘ô½¹±¥¬õì ¤€ôøÍ•Ñ5½‘…±A±…¹Ğ¡Á¥¥ôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ¡Õµˆˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥µœÍÉŒõí€½Á±…¹ÑÌ¼‘íÀ¹¥µ…•õô…±Ğõí[‘áĞ€Œ‘íÁ¥‘õôİ¥‘Ñ õìÔÉô¡•¥¡ĞõìÔÉô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ¡Õµˆµ‰…‘”ˆÍÑå±”õíì‰…­É½Õ¹èÀ¹½±½ÈõôùíÁ¥‘ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±°µÉ½ÜµÉ¥¡Ğˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±°µ¹…µ”ˆùíÀ¹ÉÕ±•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±°µÍÁ•¥•ÌˆùíÀ¹¥‘ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡¥ÁÌˆùíÁ±…¹Ñ…åÌ¡Á¥°İ••­±å5…À°É…É•É½ÕÀ¤¹µ…À¡€ôø€ñÍÁ…¸­•äõí‘ô±…ÍÍ9…µ”ô‰¡¥Àˆùí‘ôğ½ÍÁ…¸ø¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ¼ø(€€€€€€€€¤€è€ (€€€€€€€€€€ñ‘µ¥¹Q…ˆÁ±…¹ÑÌõíÁ±…¹ÑÍô½¹M…Ù”õí¡…¹‘±•‘µ¥¹M…Ù•ô½¹‘‘A±…¹Ğõí¡…¹‘±•‘‘A±…¹Ñô€¼ø(€€€€€€€€¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€¤ì)ô+rm-input { padding: 10px 12px; border: 1px solid #E8E0D5; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; }
        .form-input:focus { outline: none; border-color: #8CB87A; }
        .form-buttons { display: flex; gap: 10px; }
        .form-submit { flex: 1; padding: 10px; background: #8CB87A; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .form-cancel { flex: 1; padding: 10px; background: #E8E0D5; color: #6B5538; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {modalPlant !== null && <PlantModal
        plant={plants[modalPlant - 1]}
        pid={modalPlant}
        weeklyMap={weeklyMap}
        rareGroup={rareGroup}
        onClose={() => setModalPlant(null)}
      />}

      <div className="hdr">
        <div className="hdr-top">
          <div>
            <div className="hdr-title">ğŸŒ¿ VÃ¤xtmanual</div>
            <div className="hdr-sub">{plantCount} VÃ„XTER Â· SÃ–N / ONS / FRE</div>
            <div className="version-badge">{VERSION} Â· {CHANGELOG}</div>
          </div>
          {lastWateredLabel(history) && <div className="badge-today">{lastWateredLabel(history)}</div>}
        </div>
        <div className="tabs">
          <button className={`tab-btn ${tab === "schema" ? "active" : ""}`} onClick={() => setTab("schema")}>Kommande</button>
          <button className={`tab-btn ${tab === "plants" ? "active" : ""}`} onClick={() => setTab("plants")}>Alla vÃ¤xter</button>
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>Admin</button>
        </div>
      </div>

      {tab === "schema" && (
        <div className="notice">ğŸ“… <strong>Schema: SÃ¶ndag + Onsdag + Fredag.</strong></div>
      )}

      <div className="content">
        {tab === "schema" ? (
          upcoming.map((ev, i) => {
            const dateStr = ev.date.toISOString().split("T")[0];
            const allDone = ev.plants.every(pid => isChecked(dateStr, pid));
            return (
              <div className="day-card" key={i} style={{ opacity: allDone ? 0.6 : 1 }}>
                <div className="day-hdr">
                  <div className="day-hdr-name">{ev.dayName}</div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {ev.isRare && <span className="rare-pill">10â€“14 dag</span>}
                    <span className="day-hdr-date">{fmtDate(ev.date)}</span>
                  </div>
                </div>
                {ev.plants.map(pid => {
                  const p = plants[pid - 1];
                  if (!p) return null;
                  const done = isChecked(dateStr, pid);
                  return (
                    <div className="p-row" key={pid}>
                      <div className="thumb" onClick={(e) => { e.stopPropagation(); setModalPlant(pid); }}>
                        <img src={`/plants/${p.image}`} alt={`VÃ¤xt #${pid}`} width={48} height={48}
                          style={{ opacity: done ? 0.4 : 1, filter: done ? "grayscale(80%)" : "none" }} />
                        <div className="thumb-badge" style={{ background: done ? "#C4B8A8" : p.color }}>{pid}</div>
                      </div>
                      <div className="p-info" onClick={() => toggle(dateStr, pid)} style={{ opacity: done ? 0.5 : 1 }}>
                        <div className="p-species">{p.id}</div>
                        <div className="p-rule">{p.rule}</div>
                      </div>
                      <div className="p-check" onClick={() => toggle(dateStr, pid)}>{done ? "âœ…" : "â—‹"}</div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : tab === "plants" ? (
          <>
            <p className="all-disclaimer">Arterna nedan Ã¤r fÃ¶rslag baserade pÃ¥ bilderna â€” bekrÃ¤fta gÃ¤rna!</p>
            {[
              { label: "Bara sÃ¶ndag", ids: plants.map((p, idx) => p.schedule.includes(0) && !p.schedule.includes(3) && !p.schedule.includes(5) ? idx + 1 : null).filter(Boolean) },
              { label: "SÃ¶ndag + onsdag", ids: plants.map((p, idx) => p.schedule.includes(0) && p.schedule.includes(3) && !p.schedule.includes(5) ? idx + 1 : null).filter(Boolean) },
              { label: "SÃ¶n + ons + fre", ids: plants.map((p, idx) => p.schedule.includes(0) && p.schedule.includes(3) && p.schedule.includes(5) ? idx + 1 : null).filter(Boolean) },
              { label: "Var 10â€“14 dag", ids: plants.map((p, idx) => p.schedule.includes("rare") ? idx + 1 : null).filter(Boolean) },
            ].map(group => group.ids.length > 0 && (
              <div key={group.label}>
                <div className="sec-label">{group.label}</div>
                <div className="all-card">
                  {group.ids.map(pid => {
                    const p = plants[pid - 1];
                    if (!p) return null;
                    return (
                      <div className="all-row" key={pid} onClick={() => setModalPlant(pid)}>
                        <div className="thumb">
                          <img src={`/plants/${p.image}`} alt={`VÃ¤xt #${pid}`} width={52} height={52} />
                          <div className="thumb-badge" style={{ background: p.color }}>{pid}</div>
                        </div>
                        <div className="all-row-right">
                          <div className="all-name">{p.rule}</div>
                          <div className="all-species">{p.id}</div>
                          <div className="chips">{plantDays(pid, weeklyMap, rareGroup).map(d => <span key={d} className="chip">{d}</span>)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        ) : (
          <AdminTab plants={plants} onSave={handleAdminSave} onAddPlant={handleAddPlant} />
        )}
      </div>
    </div>
  );
}
