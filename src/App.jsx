import { useState, useEffect, useRef, useCallback } from "react";

const VERSION = __APP_VERSION__;
const CHANGELOG = __APP_CHANGELOG__;
const SW = ["Söndag","Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag"];
const MON = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
const TODAY = new Date();
const RETENTION_DAYS = 7;
const DEFAULT_ROOMS = ["Vardagsrum", "Kök", "Sovrum", "Balkong"];

async function loadPlants() {
  try { const r = await fetch("/api/plants"); return r.ok ? await r.json() : []; } catch { return []; }
}
async function loadHistoryFromServer() {
  try { const r = await fetch("/api/history"); return r.ok ? await r.json() : {}; } catch { return {}; }
}
function saveHistoryToServer(h) {
  fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(h) }).catch(() => {});
}
async function savePlantsToServer(plants) {
  try { await fetch("/api/plants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plants }) }); }
  catch (err) { console.error("Failed to save plants:", err); }
}
function purgeOld(h) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const cleaned = { ...h };
  Object.keys(cleaned).forEach(d => { if (d < cutoffStr) delete cleaned[d]; });
  return cleaned;
}
function fmtDate(d) {
  return `${["Sön","Mån","Tis","Ons","Tor","Fre","Lör"][d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

function deriveScheduleMaps(plants) {
  const weeklyMap = { 0: [], 3: [], 5: [] };
  const rareGroup = [];
  plants.forEach((p, idx) => {
    const pid = idx + 1;
    if (!Array.isArray(p.schedule)) return;
    if (p.schedule.includes("rare")) { rareGroup.push(pid); }
    else { p.schedule.forEach(day => { if (day in weeklyMap && !weeklyMap[day].includes(pid)) weeklyMap[day].push(pid); }); }
  });
  return { weeklyMap, rareGroup };
}

function generateUpcoming(plants, weeklyMap, rareGroup) {
  const events = [];
  for (let d = 0; d <= 14; d++) {
    const date = new Date(TODAY); date.setDate(TODAY.getDate() + d);
    const dow = date.getDay();
    if (!weeklyMap[dow]) continue;
    events.push({ date, dayName: SW[dow], plants: weeklyMap[dow] });
  }
  if (rareGroup.length > 0) {
    const rareDate = new Date(TODAY); rareDate.setDate(TODAY.getDate() + 12);
    events.push({ date: rareDate, dayName: "Var 10–14 dag", plants: rareGroup, isRare: true });
  }
  events.sort((a, b) => a.date - b.date);
  return events;
}

function plantDays(pid, weeklyMap, rareGroup) {
  const d = [];
  if (weeklyMap[0]?.includes(pid)) d.push("Sön");
  if (weeklyMap[3]?.includes(pid)) d.push("Ons");
  if (weeklyMap[5]?.includes(pid)) d.push("Fre");
  if (rareGroup.includes(pid)) d.push("10–14d");
  return d;
}

function lastWateredLabel(history) {
  const dates = Object.keys(history).filter(d => history[d]?.length > 0).sort();
  if (!dates.length) return null;
  const last = new Date(dates[dates.length - 1] + "T12:00:00");
  return `💧 Vattnade ${last.getDate()} ${MON[last.getMonth()]}`;
}

function PlantModal({ plant, pid, weeklyMap, rareGroup, onClose }) {
  if (!plant) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <img src={`/plants/hires/${plant.image}`} alt={plant.id} className="modal-img" />
        <div className="modal-badge" style={{ background: plant.color }}>#{pid}</div>
        <div className="modal-body">
          <h2 className="modal-title">{plant.id}</h2>
          <div className="modal-rule"><span className="modal-rule-icon">💧</span>{plant.rule}</div>
          <div className="modal-schedule">
            {plantDays(pid, weeklyMap, rareGroup).map(d => <span key={d} className="chip">{d}</span>)}
          </div>
          {plant.room && <div style={{ fontSize: 13, color: "#9A8878", marginBottom: 8 }}>📍 {plant.room}</div>}
          <p className="modal-wiki">{plant.wiki}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Drag-and-drop reorderable list ── */
function DraggableList({ items, onReorder, renderItem, keyFn }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const itemRefs = useRef([]);
  const dragStartY = useRef(0);

  const getTargetIdx = useCallback((clientY) => {
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return items.length - 1;
  }, [items.length]);

  const handlePointerDown = (e, idx) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIdx(idx);
    setOverIdx(idx);
    dragStartY.current = e.clientY;
  };

  const handlePointerMove = (e) => {
    if (dragIdx === null) return;
    setOverIdx(getTargetIdx(e.clientY));
  };

  const handlePointerUp = () => {
    if (dragIdx === null || overIdx === null) return;
    if (dragIdx !== overIdx) {
      const arr = [...items];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(overIdx, 0, moved);
      onReorder(arr);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const displayOrder = () => {
    if (dragIdx === null || overIdx === null) return items.map((_, i) => i);
    const order = items.map((_, i) => i);
    const [moved] = order.splice(dragIdx, 1);
    order.splice(overIdx, 0, moved);
    return order;
  };

  const order = displayOrder();

  return (
    <div onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => { setDragIdx(null); setOverIdx(null); }}>
      {order.map((itemIdx, visualPos) => (
        <div
          key={keyFn ? keyFn(items[itemIdx], itemIdx) : itemIdx}
          ref={el => itemRefs.current[visualPos] = el}
          style={{
            opacity: dragIdx === itemIdx ? 0.85 : 1,
            background: dragIdx === itemIdx ? "#EDE8DF" : "transparent",
            borderRadius: 10,
            transition: dragIdx !== null ? "none" : "transform 0.2s",
          }}
        >
          {renderItem(items[itemIdx], itemIdx, (e) => handlePointerDown(e, itemIdx))}
        </div>
      ))}
    </div>
  );
}

/* ── Admin Tab ── */
function AdminTab({ plants, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: "", rule: "", color: "#5A8A5E", wiki: "", schedule: [0], room: DEFAULT_ROOMS[0] });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null); // idx of plant being room-edited
  const [newRoom, setNewRoom] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [customRooms, setCustomRooms] = useState([]);

  const colors = [...new Set(plants.map(p => p.color))];
  const allRooms = [...new Set([...DEFAULT_ROOMS, ...customRooms, ...plants.map(p => p.room).filter(Boolean)])];

  const handleReorder = (newOrder) => {
    onUpdate(newOrder);
  };

  const handleRoomChange = (idx, room) => {
    const updated = [...plants];
    updated[idx] = { ...updated[idx], room };
    onUpdate(updated);
    setEditingRoom(null);
  };

  const handleAddRoom = () => {
    if (newRoom.trim() && !allRooms.includes(newRoom.trim())) {
      setCustomRooms(prev => [...prev, newRoom.trim()]);
    }
    setNewRoom('');
    setShowNewRoom(false);
  };

  const handleAddPlant = async () => {
    if (!formData.id || !formData.rule || !selectedFile) {
      alert("Fyll i alla fält och välj en bild");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("image", selectedFile);
    try {
      const res = await fetch("/api/plants/upload", { method: "POST", body: fd });
      const { filename } = await res.json();
      const updated = [...plants, { ...formData, image: filename }];
      onUpdate(updated);
      setFormData({ id: "", rule: "", color: "#5A8A5E", wiki: "", schedule: [0], room: allRooms[0] || "Vardagsrum" });
      setSelectedFile(null);
      setShowForm(false);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Uppladdningen misslyckades");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-section">
        <h3 className="admin-title">Växtsamling ({plants.length})</h3>
        <p style={{ fontSize: 12, color: "#9A8878", marginBottom: 12 }}>Håll ☰ och dra för att ändra ordning. Tryck rum för att flytta.</p>
        <DraggableList
          items={plants}
          onReorder={handleReorder}
          keyFn={(p) => p.id + p.image}
          renderItem={(p, idx, onDragHandle) => (
            <div className="admin-plant-row">
              <div className="drag-handle" onPointerDown={onDragHandle} style={{ touchAction: "none", cursor: "grab", padding: "8px 4px", fontSize: 18, color: "#B0A898", userSelect: "none" }}>☰</div>
              <img src={`/plants/hires/${p.image}`} alt={p.id} className="admin-thumb" />
              <div className="admin-plant-info">
                <div className="admin-plant-name">{p.id}</div>
                <div className="admin-plant-number">#{idx + 1}</div>
              </div>
              {editingRoom === idx ? (
                <select
                  autoFocus
                  value={p.room || ""}
                  onChange={(e) => handleRoomChange(idx, e.target.value)}
                  onBlur={() => setEditingRoom(null)}
                  className="room-select"
                >
                  {allRooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <button className="room-badge" onClick={() => setEditingRoom(idx)}>
                  {p.room || "—"}
                </button>
              )}
            </div>
          )}
        />
      </div>

      <div className="admin-section">
        <h3 className="admin-title">Rum</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {allRooms.map(r => {
            const count = plants.filter(p => p.room === r).length;
            return <span key={r} className="chip">{r} ({count})</span>;
          })}
        </div>
        {showNewRoom ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="Nytt rum" value={newRoom} onChange={e => setNewRoom(e.target.value)}
              className="form-input" style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && handleAddRoom()} />
            <button onClick={handleAddRoom} className="form-submit" style={{ flex: 0, padding: "8px 16px" }}>+</button>
          </div>
        ) : (
          <button onClick={() => setShowNewRoom(true)} className="admin-add-btn" style={{ fontSize: 13, padding: 10 }}>+ Nytt rum</button>
        )}
      </div>

      <div className="admin-section">
        <h3 className="admin-title">Lägg till växt</h3>
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="admin-add-btn">+ Lägg till ny växt</button>
        ) : (
          <div className="admin-form">
            <input type="text" placeholder="Växtens namn" value={formData.id}
              onChange={e => setFormData({ ...formData, id: e.target.value })} className="form-input" />
            <input type="text" placeholder="Vattningsregel" value={formData.rule}
              onChange={e => setFormData({ ...formData, rule: e.target.value })} className="form-input" />
            <select value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })} className="form-input">
              {allRooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="form-input">
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="Växtbeskrivning (wiki)" value={formData.wiki}
              onChange={e => setFormData({ ...formData, wiki: e.target.value })} className="form-input" rows="3" />
            <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="form-input" />
            <div className="form-buttons">
              <button onClick={handleAddPlant} disabled={uploading} className="form-submit">
                {uploading ? "Laddar upp..." : "Lägg till"}
              </button>
              <button onClick={() => setShowForm(false)} className="form-cancel">Avbryt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main App ── */
export default function Växtmanual() {
  const [tab, setTab] = useState("schema");
  const [plants, setPlants] = useState([]);
  const [history, setHistory] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [modalPlant, setModalPlant] = useState(null);
  const [weeklyMap, setWeeklyMap] = useState({});
  const [rareGroup, setRareGroup] = useState([]);

  useEffect(() => {
    Promise.all([loadPlants(), loadHistoryFromServer()]).then(([p, h]) => {
      setPlants(p);
      if (p.length > 0) {
        const maps = deriveScheduleMaps(p);
        setWeeklyMap(maps.weeklyMap);
        setRareGroup(maps.rareGroup);
      }
      setHistory(purgeOld(h));
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (loaded) saveHistoryToServer(history); }, [history, loaded]);

  const toggle = (dateStr, pid) => {
    setHistory(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = [];
      const arr = [...next[dateStr]];
      const idx = arr.indexOf(pid);
      if (idx > -1) arr.splice(idx, 1); else arr.push(pid);
      return { ...next, [dateStr]: arr };
    });
  };
  const isChecked = (dateStr, pid) => (history[dateStr] || []).includes(pid);
  const upcoming = generateUpcoming(plants, weeklyMap, rareGroup);

  const handlePlantsUpdate = (updatedPlants) => {
    setPlants(updatedPlants);
    savePlantsToServer(updatedPlants);
    const maps = deriveScheduleMaps(updatedPlants);
    setWeeklyMap(maps.weeklyMap);
    setRareGroup(maps.rareGroup);
  };

  // Group plants by room for gallery
  const plantsByRoom = plants.reduce((acc, p, idx) => {
    const room = p.room || "Övrigt";
    if (!acc[room]) acc[room] = [];
    acc[room].push({ ...p, pid: idx + 1 });
    return acc;
  }, {});

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
        .thumb { position: relative; flex-shrink: 0; }
        .thumb img { display: block; border-radius: 10px; object-fit: cover; }
        .thumb-badge { position: absolute; bottom: 0; right: 0; color: white; border-radius: 6px 0 10px 0; font-size: 10px; font-weight: 700; padding: 1px 4px; line-height: 1.4; }
        .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
        .chip { background: #EEE9DF; color: #6B5538; padding: 2px 7px; border-radius: 8px; font-size: 11px; font-weight: 500; }

        /* Gallery (Alla växter) */
        .room-section { margin-bottom: 20px; }
        .room-hdr { font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #9A8878; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .gallery-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.07); cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .gallery-card:active { opacity: 0.85; }
        .gallery-img { width: 100%; aspect-ratio: 1; object-fit: cover; }
        .gallery-info { padding: 8px; }
        .gallery-name { font-size: 12px; font-weight: 500; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gallery-rule { font-size: 10px; color: #9A8878; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Modal */
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

        /* Admin */
        .admin-container { padding: 0; }
        .admin-section { background: white; border-radius: 14px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
        .admin-title { font-size: 15px; font-weight: 600; color: #1E3A0E; margin-bottom: 14px; }
        .admin-plant-row { display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-bottom: 1px solid #F0EBE0; }
        .admin-plant-row:last-child { border-bottom: none; }
        .admin-thumb { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .admin-plant-info { flex: 1; min-width: 0; }
        .admin-plant-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .admin-plant-number { font-size: 11px; color: #9A8878; margin-top: 2px; }
        .admin-add-btn { width: 100%; padding: 12px; background: #8CB87A; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .admin-form { display: flex; flex-direction: column; gap: 12px; }
        .form-input { padding: 10px 12px; border: 1px solid #E8E0D5; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; }
        .form-input:focus { outline: none; border-color: #8CB87A; }
        .form-buttons { display: flex; gap: 10px; }
        .form-submit { flex: 1; padding: 10px; background: #8CB87A; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .form-cancel { flex: 1; padding: 10px; background: #E8E0D5; color: #6B5538; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .room-badge { background: #EEE9DF; color: #6B5538; border: none; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .room-select { padding: 4px 8px; border: 1px solid #8CB87A; border-radius: 8px; font-size: 11px; font-family: 'DM Sans', sans-serif; background: white; }
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
            <div className="hdr-title">🌿 Växtmanual</div>
            <div className="hdr-sub">{plants.length} VÄXTER · SÖN / ONS / FRE</div>
            <div className="version-badge">{VERSION} · {CHANGELOG}</div>
          </div>
          {lastWateredLabel(history) && <div className="badge-today">{lastWateredLabel(history)}</div>}
        </div>
        <div className="tabs">
          <button className={`tab-btn ${tab === "schema" ? "active" : ""}`} onClick={() => setTab("schema")}>Kommande</button>
          <button className={`tab-btn ${tab === "plants" ? "active" : ""}`} onClick={() => setTab("plants")}>Alla växter</button>
          <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>Admin</button>
        </div>
      </div>

      {tab === "schema" && <div className="notice">📖 <strong>Schema: Söndag + Onsdag + Fredag.</strong></div>}

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
                    {ev.isRare && <span className="rare-pill">10–14 dag</span>}
                    <span className="day-hdr-date">{fmtDate(ev.date)}</span>
                  </div>
                </div>
                {ev.plants.map(pid => {
                  const p = plants[pid - 1];
                  if (!p) return null;
                  const done = isChecked(dateStr, pid);
                  return (
                    <div className="p-row" key={pid}>
                      <div className="thumb" onClick={() => setModalPlant(pid)}>
                        <img src={`/plants/${p.image}`} alt={`#${pid}`} width={48} height={48}
                          style={{ opacity: done ? 0.4 : 1, filter: done ? "grayscale(80%)" : "none" }} />
                        <div className="thumb-badge" style={{ background: done ? "#C4B8A8" : p.color }}>{pid}</div>
                      </div>
                      <div className="p-info" onClick={() => toggle(dateStr, pid)} style={{ opacity: done ? 0.5 : 1 }}>
                        <div className="p-species">{p.id}</div>
                        <div className="p-rule">{p.rule}</div>
                      </div>
                      <div className="p-check" onClick={() => toggle(dateStr, pid)}>{done ? "✅" : "◻"}</div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : tab === "plants" ? (
          <>
            {Object.entries(plantsByRoom).map(([room, roomPlants]) => (
              <div className="room-section" key={room}>
                <div className="room-hdr">📍 {room} <span style={{ fontWeight: 400, fontSize: 11 }}>({roomPlants.length})</span></div>
                <div className="gallery-grid">
                  {roomPlants.map(p => (
                    <div className="gallery-card" key={p.pid} onClick={() => setModalPlant(p.pid)}>
                      <img src={`/plants/hires/${p.image}`} alt={p.id} className="gallery-img" loading="lazy" />
                      <div className="gallery-info">
                        <div className="gallery-name">{p.id}</div>
                        <div className="gallery-rule">{p.rule}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <AdminTab plants={plants} onUpdate={handlePlantsUpdate} />
        )}
      </div>
    </div>
  );
}
