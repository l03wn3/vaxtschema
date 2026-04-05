import { useState, useEffect } from "react";

const VERSION = "v2.1 – 2026-04-02";

// Images live in /public/plants/
const plantImages = Object.fromEntries(
  Array.from({length: 21}, (_, i) => [i + 1, `/plants/plant_${i + 1}.jpg`])
);

const plantData = {
  1:  { rule: "Lätt fuktig jord",                    id: "Begonia rex",                   color: "#B85C38" },
  2:  { rule: "Låt torka ut",                         id: "Spindelplanta (Chlorophytum)",  color: "#5A8A5E" },
  3:  { rule: "Stick fingret 3–5 cm — torr? Vattna", id: "Monstera / Philodendron",       color: "#5A8A5E" },
  4:  { rule: "Lite vatten, sällan",                  id: "Hyacint / Tulpan (lök)",        color: "#8A6AAB" },
  5:  { rule: "Håll jämnt fuktig",                    id: "Begonia / Caladium",            color: "#B85C38" },
  6:  { rule: "Lite vatten, låt nästan torka",        id: "Tropisk buske",                 color: "#5A8A5E" },
  7:  { rule: "Alltid fuktig",                        id: "Vattenväxt / stickling i glas", color: "#3A7A9A" },
  8:  { rule: "Torkar snabbt — kolla ofta",           id: "Pothos / Epipremnum",           color: "#5A8A5E" },
  9:  { rule: "Lite vatten, sällan",                  id: "Lökväxt (hyacint?)",            color: "#8A6AAB" },
  10: { rule: "Lite vatten, sällan",                  id: "Lökväxt",                       color: "#8A6AAB" },
  11: { rule: "Lätt fuktig jord",                     id: "Spindelplanta / Gräsväxt",      color: "#5A8A5E" },
  12: { rule: "Känn på jorden — vattna vid behov",    id: "Hängande tropisk",              color: "#5A8A5E" },
  13: { rule: "Aldrig torr — vattna frikostigt",      id: "Ormbunke (Nephrolepis)",        color: "#3A7A9A" },
  14: { rule: "Låt torka helt ut",                    id: "Epiphyllum / Ökenväxt",         color: "#9A7A1A" },
  15: { rule: "Låt översta lagret torka",             id: "Monstera",                      color: "#5A8A5E" },
  16: { rule: "Torkar snabbt — kolla ofta",           id: "Caladium / Coleus",             color: "#B85C38" },
  17: { rule: "Fuktig jord + duscha bladen",          id: "Colocasia / Alocasia",          color: "#3A7A9A" },
  18: { rule: "Vattna när den börjar hänga",          id: "Oxalis / Begonia (röd)",        color: "#8A3A3A" },
  19: { rule: "Låt torka ut",                         id: "Gräshängare (Carex/Chlor.)",    color: "#5A8A5E" },
  20: { rule: "Sällan, men vattna ordentligt",        id: "Monstera / Alocasia (stor)",    color: "#9A7A1A" },
  21: { rule: "Känn på jorden — vattna vid behov",    id: "Fredslilja (Spathiphyllum)",    color: "#3A7A9A" },
};

const weeklyMap = {
  1: [5, 7, 8, 13, 17, 21],
  3: [1, 2, 3, 6, 12, 16, 18, 19],
  0: [4, 5, 7, 8, 9, 10, 11, 13, 17, 21],
};
const rareGroup = [14, 15, 20];
const TODAY = new Date(2026, 3, 2);
const STORAGE_KEY = "vaxtmanual_history";
const RETENTION_DAYS = 7;

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

function purgeOld(h) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const cleaned = { ...h };
  Object.keys(cleaned).forEach(d => { if (d < cutoffStr) delete cleaned[d]; });
  return cleaned;
}

const SW = ["Söndag","Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag"];
const MON = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];

function fmtDate(d) {
  return `${["Sön","Mån","Tis","Ons","Tor","Fre","Lör"][d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

function generateUpcoming() {
  const events = [];
  for (let d = 1; d <= 14; d++) {
    const date = new Date(TODAY);
    date.setDate(TODAY.getDate() + d);
    const dow = date.getDay();
    if (!weeklyMap[dow]) continue;
    events.push({ date, dayName: SW[dow], plants: weeklyMap[dow] });
  }
  const rareDate = new Date(TODAY);
  rareDate.setDate(TODAY.getDate() + 12);
  events.push({ date: rareDate, dayName: "Var 10–14 dag", plants: rareGroup, isRare: true });
  events.sort((a, b) => a.date - b.date);
  return events;
}

function plantDays(pid) {
  const d = [];
  if (weeklyMap[1]?.includes(pid)) d.push("Mån");
  if (weeklyMap[3]?.includes(pid)) d.push("Ons");
  if (weeklyMap[0]?.includes(pid)) d.push("Sön");
  if (rareGroup.includes(pid)) d.push("10–14d");
  return d;
}

export default function VäxtManual() {
  const [tab, setTab] = useState("schema");
  const [history, setHistory] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadHistoryFromServer().then(h => { setHistory(purgeOld(h)); setLoaded(true); });
  }, []);

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
  const upcoming = generateUpcoming();

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
        .all-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #F0EBE0; }
        .all-row:last-child { border-bottom: none; }
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
      `}</style>

      <div className="hdr">
        <div className="hdr-top">
          <div>
            <div className="hdr-title">🌿 Växtmanual</div>
            <div className="hdr-sub">21 VÄXTER · MÅN / ONS / SÖN</div>
            <div className="version-badge">{VERSION}</div>
          </div>
          <div className="badge-today">💧 Vattnade 2 apr</div>
        </div>
        <div className="tabs">
          <button className={`tab-btn ${tab === "schema" ? "active" : ""}`} onClick={() => setTab("schema")}>Kommande</button>
          <button className={`tab-btn ${tab === "plants" ? "active" : ""}`} onClick={() => setTab("plants")}>Alla växter</button>
        </div>
      </div>

      {tab === "schema" && (
        <div className="notice">📅 <strong>Schema: Måndag + Onsdag + Söndag.</strong> Bockningar sparas i 7 dagar.</div>
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
                    {ev.isRare && <span className="rare-pill">10–14 dag</span>}
                    <span className="day-hdr-date">{fmtDate(ev.date)}</span>
                  </div>
                </div>
                {ev.plants.map(pid => {
                  const p = plantData[pid];
                  const done = isChecked(dateStr, pid);
                  return (
                    <div className="p-row" key={pid} onClick={() => toggle(dateStr, pid)}>
                      <div className="thumb">
                        <img src={plantImages[pid]} alt={`Växt #${pid}`} width={48} height={48}
                          style={{ opacity: done ? 0.4 : 1, filter: done ? "grayscale(80%)" : "none" }} />
                        <div className="thumb-badge" style={{ background: done ? "#C4B8A8" : p.color }}>{pid}</div>
                      </div>
                      <div className="p-info" style={{ opacity: done ? 0.5 : 1 }}>
                        <div className="p-species">{p.id}</div>
                        <div className="p-rule">{p.rule}</div>
                      </div>
                      <div className="p-check">{done ? "✅" : "○"}</div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          <>
            <p className="all-disclaimer">Arterna nedan är förslag baserade på bilderna — bekräfta gärna!</p>
            {[
              { label: "Måndag", ids: [5, 7, 8, 13, 17, 21] },
              { label: "Onsdag", ids: [1, 2, 3, 6, 12, 16, 18, 19] },
              { label: "Söndag", ids: [4, 9, 10, 11] },
              { label: "Var 10–14 dag", ids: [14, 15, 20] },
            ].map(group => (
              <div key={group.label}>
                <div className="sec-label">{group.label}</div>
                <div className="all-card">
                  {group.ids.map(pid => {
                    const p = plantData[pid];
                    return (
                      <div className="all-row" key={pid}>
                        <div className="thumb">
                          <img src={plantImages[pid]} alt={`Växt #${pid}`} width={52} height={52} />
                          <div className="thumb-badge" style={{ background: p.color }}>{pid}</div>
                        </div>
                        <div className="all-row-right">
                          <div className="all-name">{p.rule}</div>
                          <div className="all-species">{p.id}</div>
                          <div className="chips">{plantDays(pid).map(d => <span key={d} className="chip">{d}</span>)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
