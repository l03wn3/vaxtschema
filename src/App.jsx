import { useState, useEffect } from "react";

const VERSION = __APP_VERSION__;
const CHANGELOG = __APP_CHANGELOG__;

// Thumbnails in /public/plants/, high-res in /public/plants/hires/
const plantImages = Object.fromEntries(
  Array.from({length: 21}, (_, i) => [i + 1, `/plants/plant_${i + 1}.jpg`])
);
const plantImagesHires = Object.fromEntries(
  Array.from({length: 21}, (_, i) => [i + 1, `/plants/hires/plant_${i + 1}.jpg`])
);

const plantData = {
  1:  { rule: "Lätt fuktig jord",                    id: "Begonia rex",                   color: "#B85C38",
        wiki: "Begonia rex är en art i begoniasläktet, ursprungligen från nordöstra Indien. Den odlas främst för sina spektakulära, mönstrade blad som kan ha färger i silver, rosa, lila och grönt. Trivs i indirekt ljus och vill ha jämnt fuktig jord utan att stå blöt." },
  2:  { rule: "Låt torka ut",                         id: "Spindelplanta (Chlorophytum)",  color: "#5A8A5E",
        wiki: "Ampellilja (Chlorophytum comosum) är en växtart i familjen sparrisväxter från tropiska Afrika. Den är en av världens mest populära krukväxter tack vare sin härdighet och luftrenande egenskaper. Plantan bildar långa utlöpare med småplantor som hänger ned som spindlar." },
  3:  { rule: "Stick fingret 3–5 cm — torr? Vattna", id: "Monstera / Philodendron",       color: "#5A8A5E",
        wiki: "Monstera deliciosa, även kallad Adams revben efter bladens karaktäristiska hål och flikar, är en klätterväxt från Centralamerikas tropiska skogar. Den är en av de mest populära krukväxterna och kan bli mycket stor inomhus. Trivs i indirekt ljus och vill ha väldränerad jord som får torka upp något mellan vattningarna." },
  4:  { rule: "Lite vatten, sällan",                  id: "Hyacint / Tulpan (lök)",        color: "#8A6AAB",
        wiki: "Hyacint är en flerårig blommande lökväxt med ursprung i sydöstra Turkiet och Levantens medelhavskust. Den kom troligen till Sverige under 1600-talet och är mest känd för sina flockar av doftande, färgglada blommor i blått, vitt, rosa, rött eller lila. Blommar på våren och behöver lite vatten under viloperiodens." },
  5:  { rule: "Håll jämnt fuktig",                    id: "Begonia / Caladium",            color: "#B85C38",
        wiki: "Begoniasläktet (Begonia) är ett av de tio artrikaste släktena bland gömfröväxter med ungefär 1 800 arter. De flesta kommer från tropiska och subtropiska områden. Odlas som krukväxter för sina dekorativa blad eller vackra blommor och trivs i jämnt fuktig, väldränerad jord." },
  6:  { rule: "Lite vatten, låt nästan torka",        id: "Tropisk buske (Kroton)",        color: "#5A8A5E",
        wiki: "Kroton (Codiaeum variegatum) är en törelväxt som först beskrevs av Carl von Linné. Namnet kommer från malajiska 'kodiho' och latin 'variegatum' (brokig). Känd för sina intensivt färgade blad i gult, orange, rött och grönt. Trivs i starkt ljus och vill torka upp något mellan vattningarna." },
  7:  { rule: "Alltid fuktig",                        id: "Vattenväxt / stickling i glas", color: "#3A7A9A",
        wiki: "En stickling är en avskuren stam-, gren- eller rotdel av en växt som sätts i vatten eller jord för att slå rot och bilda en ny planta. Sticklingar i vatten bör skyddas från direkt ljus på rotdelen. Många tropiska krukväxter som pothos och monstera rotar sig lätt i vatten." },
  8:  { rule: "Torkar snabbt — kolla ofta",           id: "Pothos / Epipremnum",           color: "#5A8A5E",
        wiki: "Gullranka (Epipremnum aureum) är en art i familjen kallaväxter som förekommer naturligt på Sällskapsöarna. I Sverige är den en mycket vanlig och populär krukväxt. Den är lättskött och tålig, med hjärtformade blad som ofta har gula eller vita mönster. Klättrar eller hänger och renar luften." },
  9:  { rule: "Lite vatten, sällan",                  id: "Lökväxt (hyacint?)",            color: "#8A6AAB",
        wiki: "Hyacint är en flerårig blommande lökväxt med ursprung i sydöstra Turkiet. Blomfärgen kan vara blå, vit, ljusgul, rosa, röd eller lila. Under viloperioden behöver löken torrt och svalt. Vattna sparsamt — lökar ruttnar lätt av för mycket fukt." },
  10: { rule: "Lite vatten, sällan",                  id: "Lökväxt",                       color: "#8A6AAB",
        wiki: "Lökväxter lagrar energi i en underjordisk lök och har ofta en tydlig viloperiod. Under aktiv tillväxt och blomning behöver de måttligt med vatten, men under vila ska jorden vara nästan torr. Vanliga lökväxter inomhus inkluderar hyacint, amaryllis och tulpan." },
  11: { rule: "Lätt fuktig jord",                     id: "Spindelplanta / Gräsväxt",      color: "#5A8A5E",
        wiki: "Ampellilja (Chlorophytum comosum) är en växtart i familjen sparrisväxter från tropiska Afrika. Den är extremt tålig och anpassningsbar, och klarar både torka och övervattning bättre än de flesta krukväxter. Perfekt för nybörjare och känd för att rena luften." },
  12: { rule: "Känn på jorden — vattna vid behov",    id: "Hängande tropisk",              color: "#5A8A5E",
        wiki: "Tremastarblomssläktet (Tradescantia), även kallade båtblommor, är ett växtsläkte i familjen himmelsblommeväxter. Flera arter odlas som krukväxter för sina dekorativa, ofta randiga blad i grönt, lila och silver. De växer snabbt som hängväxter och är lätta att föröka med sticklingar." },
  13: { rule: "Aldrig torr — vattna frikostigt",      id: "Ormbunke (Nephrolepis)",        color: "#3A7A9A",
        wiki: "Nephrolepis (svärdsbräken) är ett släkte av bräkenväxter. Den vanligaste arten i odling är Nephrolepis exaltata, känd som Bostonbräken. Den trivs i hög luftfuktighet och jämnt fuktig jord — låt den aldrig torka ut helt. Perfekt för badrum eller kök." },
  14: { rule: "Låt torka helt ut",                    id: "Epiphyllum / Ökenväxt",         color: "#9A7A1A",
        wiki: "Bladkaktussläktet (Epiphyllum) omfattar 15–20 arter inom familjen kaktusväxter, ursprungligen från Centralamerika och Mexiko. Till skillnad från ökenkaktus är de flesta epifyter som växer på träd i tropisk regnskog. De har platta, bladlika stammar och behöver torka ut ordentligt mellan vattningarna." },
  15: { rule: "Låt översta lagret torka",             id: "Monstera",                      color: "#5A8A5E",
        wiki: "Monstera deliciosa, även kallad Adams revben, är den vanligaste arten i monsterasläktet. De karaktäristiska hålen i bladen utvecklas när plantan mognar. Ursprungligen en klätterväxt från Centralamerikas regnskogar. Låt översta jordlagret torka mellan vattningarna — den ska inte torka ut helt." },
  16: { rule: "Torkar snabbt — kolla ofta",           id: "Caladium / Coleus",             color: "#B85C38",
        wiki: "Palettblad (Coleus/Plectranthus scutellarioides) är en flerårig ört med flerfärgade blad, ursprungligen från Sydostasien. Plantan blir 30–80 cm hög och blommar juni–oktober. Känd för sina spektakulära blad i kombinationer av grönt, rött, rosa, gult och lila. Torkar snabbt och vill ha jämnt fuktig jord." },
  17: { rule: "Fuktig jord + duscha bladen",          id: "Colocasia / Alocasia",          color: "#3A7A9A",
        wiki: "Alokasiasläktet (Alocasia) omfattar cirka 70 arter i familjen kallaväxter, främst från sydöstra Asien. De har stora, dekorativa blad och kallas ibland \"elefantöron\". Trivs i hög luftfuktighet och jämnt fuktig jord. Duscha gärna bladen regelbundet för att hålla dem friska." },
  18: { rule: "Vattna när den börjar hänga",          id: "Oxalis / Begonia (röd)",        color: "#8A3A3A",
        wiki: "Harsyra (Oxalis) är ett släkte i familjen harsyreväxter. Bladen är ätbara med en syrlig smak som kommer av oxalsyra. Många arter odlas som krukväxter för sina dekorativa, trefingrade blad som fälls ihop på natten. Signalerar tydligt när den behöver vatten genom att bladen hänger." },
  19: { rule: "Låt torka ut",                         id: "Gräshängare (Carex/Chlor.)",    color: "#5A8A5E",
        wiki: "Ampellilja (Chlorophytum comosum) är en växtart i familjen sparrisväxter från tropiska Afrika. Som hängväxt bildar den eleganta utlöpare med småplantor. Extremt tålig och klarar perioder av torka bra, men trivs bäst med regelbunden vattning där jorden får torka ut emellan." },
  20: { rule: "Sällan, men vattna ordentligt",        id: "Monstera / Alocasia (stor)",    color: "#9A7A1A",
        wiki: "Monstera deliciosa kan bli mycket stor inomhus med blad som når över en meter i diameter. Som regnväxt vill den ha ordentligt med vatten när den vattnas, men tål att jorden torkar ut en del mellan vattningarna. Ge den en stöttpinne eller mosstotem att klättra på för bästa tillväxt." },
  21: { rule: "Känn på jorden — vattna vid behov",    id: "Fredslilja (Spathiphyllum)",    color: "#3A7A9A",
        wiki: "Fredslilja (Spathiphyllum) är en populär krukväxt i familjen kallaväxter, ursprungligen från tropiska Amerika och sydöstra Asien. Känd för sina eleganta vita blommor och mörkgröna, blanka blad. En av de bästa luftrenande växterna enligt NASA. Signalerar tydligt när den behöver vatten genom att bladen sjunker." },
};

const weeklyMap = {
  5: [5, 7, 8, 13, 17, 21],
  3: [1, 2, 3, 6, 12, 16, 18, 19],
  0: [4, 5, 7, 8, 9, 10, 11, 13, 17, 21],
};
const rareGroup = [14, 15, 20];
const TODAY = new Date();
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
  for (let d = 0; d <= 14; d++) {
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

function PlantModal({ pid, onClose }) {
  const p = plantData[pid];
  if (!p) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <img src={plantImagesHires[pid]} alt={p.id} className="modal-img" />
        <div className="modal-badge" style={{ background: p.color }}>#{pid}</div>
        <div className="modal-body">
          <h2 className="modal-title">{p.id}</h2>
          <div className="modal-rule">
            <span className="modal-rule-icon">💧</span>
            {p.rule}
          </div>
          <div className="modal-schedule">
            {plantDays(pid).map(d => <span key={d} className="chip">{d}</span>)}
          </div>
          <p className="modal-wiki">{p.wiki}</p>
        </div>
      </div>
    </div>
  );
}

export default function VäxtManual() {
  const [tab, setTab] = useState("schema");
  const [history, setHistory] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [modalPlant, setModalPlant] = useState(null);

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

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {modalPlant && <PlantModal pid={modalPlant} onClose={() => setModalPlant(null)} />}

      <div className="hdr">
        <div className="hdr-top">
          <div>
            <div className="hdr-title">🌿 Växtmanual</div>
            <div className="hdr-sub">21 VÄXTER · SÖN / ONS / FRE</div>
            <div className="version-badge">{VERSION} · {CHANGELOG}</div>
          </div>
          {lastWateredLabel(history) && <div className="badge-today">{lastWateredLabel(history)}</div>}
        </div>
        <div className="tabs">
          <button className={`tab-btn ${tab === "schema" ? "active" : ""}`} onClick={() => setTab("schema")}>Kommande</button>
          <button className={`tab-btn ${tab === "plants" ? "active" : ""}`} onClick={() => setTab("plants")}>Alla växter</button>
        </div>
      </div>

      {tab === "schema" && (
        <div className="notice">📅 <strong>Schema: Söndag + Onsdag + Fredag.</strong></div>
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
                    <div className="p-row" key={pid}>
                      <div className="thumb" onClick={(e) => { e.stopPropagation(); setModalPlant(pid); }}>
                        <img src={plantImages[pid]} alt={`Växt #${pid}`} width={48} height={48}
                          style={{ opacity: done ? 0.4 : 1, filter: done ? "grayscale(80%)" : "none" }} />
                        <div className="thumb-badge" style={{ background: done ? "#C4B8A8" : p.color }}>{pid}</div>
                      </div>
                      <div className="p-info" onClick={() => toggle(dateStr, pid)} style={{ opacity: done ? 0.5 : 1 }}>
                        <div className="p-species">{p.id}</div>
                        <div className="p-rule">{p.rule}</div>
                      </div>
                      <div className="p-check" onClick={() => toggle(dateStr, pid)}>{done ? "✅" : "○"}</div>
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
              { label: "Söndag", ids: [4, 5, 7, 8, 9, 10, 11, 13, 17, 21] },
              { label: "Onsdag", ids: [1, 2, 3, 6, 12, 16, 18, 19] },
              { label: "Fredag", ids: [5, 7, 8, 13, 17, 21] },
              { label: "Var 10–14 dag", ids: [14, 15, 20] },
            ].map(group => (
              <div key={group.label}>
                <div className="sec-label">{group.label}</div>
                <div className="all-card">
                  {group.ids.map(pid => {
                    const p = plantData[pid];
                    return (
                      <div className="all-row" key={pid} onClick={() => setModalPlant(pid)}>
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
