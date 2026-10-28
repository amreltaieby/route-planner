"use client";
import { useEffect, useState } from "react";
import { supabase } from "./db";
import MapPicker from "./MapPicker";

let uid = 0;
const nid = () => ++uid;
const blank = () => ({ id: nid(), name: "", loc: "", people: "1" });

const fmt = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtDur = (min) => {
  const t = Math.round(min);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
};

const parseKm = (s) => {
  const t = String(s).trim().toLowerCase().replace(",", ".");
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(km|m)?$/);
  if (!m) return NaN;
  const v = +m[1];
  return m[2] === "m" ? v / 1000 : v;
};

const parseMin = (s) => {
  const t = String(s).trim().toLowerCase();
  if (!t) return NaN;
  let m = t.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return +m[1];
  m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  const h = t.match(/(\d+(?:\.\d+)?)\s*h/);
  const mi = t.match(/(\d+(?:\.\d+)?)\s*m/);
  if (h || mi) return (h ? +h[1] * 60 : 0) + (mi ? +mi[1] : 0);
  return NaN;
};

const legUrl = (a, b) =>
  "https://www.google.com/maps/dir/?api=1&travelmode=driving" +
  `&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}`;

function build(r, gMin) {
  const gSec = gMin * 60;
  const raw = r.legSec.reduce((a, b) => a + b, 0);
  const f = gSec / raw;
  const mid = r.order.length - 2;
  const totalSec = gSec + (mid * r.stopMs) / 1000;
  const startMs = r.arrivalMs - totalSec * 1000;
  let t = startMs;
  const order = [{ ...r.order[0], arriveMs: t, departMs: t }];
  for (let i = 1; i < r.order.length; i++) {
    t += r.legSec[i - 1] * f * 1000;
    const arriveMs = t;
    if (i < r.order.length - 1) t += r.stopMs;
    order.push({ ...r.order[i], arriveMs, departMs: t });
  }
  return { factor: f, startMs, order, driveMin: gMin, totalMin: totalSec / 60 };
}

function Row({ v, set, saved, onDel, showPeople }) {
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = saved.filter((l) =>
    l.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input
          className="in nm"
          style={{ minWidth: 140 }}
          placeholder="Name of location"
          value={v.name}
          onChange={(e) => set({ ...v, name: e.target.value })}
        />
        {showPeople && (
          <input
            className="in"
            type="number"
            min="1"
            step="1"
            title="People at this stop"
            placeholder="People"
            style={{ width: 80 }}
            value={v.people ?? "1"}
            onChange={(e) => {
              const x = e.target.value;
              set({ ...v, people: x !== "" && !(Number(x) >= 1) ? "1" : x });
            }}
            onBlur={() => {
              if (!v.people) set({ ...v, people: "1" });
            }}
          />
        )}
        <div className="hb">
          <button
            type="button"
            className="ghost"
            style={{ marginTop: 0, height: "100%", whiteSpace: "nowrap" }}
            onClick={() => {
              setQ("");
              setOpen(!open);
            }}
          >
            My locations
          </button>
          {open && (
            <>
              <div className="mo" onClick={() => setOpen(false)} />
              <div className="mlist">
                <div
                  style={{ position: "sticky", top: 0, background: "inherit", padding: 6 }}
                >
                  <input
                    className="in"
                    autoFocus
                    placeholder="Search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <div
                  className="mi"
                  style={{ color: "var(--cyan)", fontWeight: 600 }}
                  onClick={() => {
                    setOpen(false);
                    setMapOpen(true);
                  }}
                >
                  Choose on map
                </div>
                {saved.length === 0 && <div className="mi muted">No saved locations</div>}
                {saved.length > 0 && shown.length === 0 && (
                  <div className="mi muted">No match</div>
                )}
                {shown.map((l) => (
                  <div
                    key={l.id}
                    className="mi"
                    onClick={() => {
                      set({ ...v, name: l.name, loc: l.coords });
                      setOpen(false);
                    }}
                  >
                    {l.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {onDel ? (
          <button type="button" className="x" onClick={onDel} aria-label="Delete stop">
            {"\u2715"}
          </button>
        ) : (
          <span className="xb" />
        )}
      </div>
      {v.loc && (
        <div className="muted" style={{ margin: "-4px 0 8px 2px", fontSize: 12 }}>
          {v.loc}
        </div>
      )}
      {mapOpen && (
        <MapPicker
          initial={v.loc}
          onConfirm={(c) => {
            set({ ...v, loc: c });
            setMapOpen(false);
          }}
          onClose={() => setMapOpen(false)}
        />
      )}
    </>
  );
}

function Result({ res }) {
  const [gOpen, setGOpen] = useState(false);
  const [gTotal, setGTotal] = useState("");
  const [viewed, setViewed] = useState({});
  const [gdist, setGdist] = useState({});
  const [gtime, setGtime] = useState({});

  const [saveOpen, setSaveOpen] = useState(false);
  const [tripName, setTripName] = useState("");
  const [tripTime, setTripTime] = useState("");
  const [tripDist, setTripDist] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const nn = (set) => (e) => {
    const v = e.target.value;
    set(Number(v) < 0 ? "0" : v);
  };

  const gMin = parseMin(gTotal);
  const rawTotal = res.legSec.reduce((a, b) => a + b, 0);
  const fin = gMin > 0 && rawTotal > 0 ? build(res, gMin) : null;
  const gBad = gTotal.trim() !== "" && !(gMin > 0);

  async function saveTrip() {
    setSaveErr("");
    if (!tripName.trim()) return setSaveErr("Enter a trip name.");
    const t = tripTime === "" ? null : Number(tripTime);
    const d = tripDist === "" ? null : Number(tripDist);
    if ((t !== null && !(t >= 0)) || (d !== null && !(d >= 0)))
      return setSaveErr("Time and distance cannot be negative.");
    const data = {
      ...res.plan,
      traffic: fin ? Number(fin.factor.toFixed(3)) : 1,
    };
    setSaving(true);
    const { error } = await supabase
      .from("trips")
      .insert({ name: tripName.trim(), time_min: t, distance_km: d, data });
    setSaving(false);
    if (error) return setSaveErr(error.message);
    setSaveOpen(false);
    setTripName("");
    setTripTime("");
    setTripDist("");
    setSaved(true);
  }

  const etas = [];
  const gd = [];
  if (fin) {
    let acc = fin.startMs;
    let ok = true;
    for (let i = 1; i < fin.order.length; i++) {
      const g = parseMin(gtime[i] || "");
      if (!Number.isFinite(g)) ok = false;
      if (ok) {
        acc += g * 60000;
        etas[i] = acc;
        if (i < fin.order.length - 1) acc += res.stopMs;
      } else {
        etas[i] = null;
      }
    }
    let dacc = 0;
    let dok = true;
    for (let i = 1; i < fin.order.length; i++) {
      const g = parseKm(gdist[i] || "");
      if (!Number.isFinite(g)) dok = false;
      if (dok) {
        dacc += g;
        gd[i] = dacc;
      } else {
        gd[i] = null;
      }
    }
  }

  const fuelL = res.l100 > 0 ? (res.distanceKm * res.l100) / 100 : null;
  const fuelCost = fuelL !== null && res.price > 0 ? fuelL * res.price : null;

  return (
    <>
      {res.title && <h3 style={{ margin: "24px 0 0" }}>{res.title}</h3>}

      <section className="card">
        <a
          className="maps"
          href={res.mapsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => setGOpen(true)}
        >
          Open route in Google Maps
        </a>
        {!gOpen && (
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Open it, then enter the time Google Maps shows.
          </p>
        )}
        {gOpen && (
          <div className="gbox">
            <div className="gfield">
              <span className="muted">Google Maps estimated time (whole route)</span>
              <input
                className="in gin"
                placeholder="e.g. 65 or 1 hr 5 min"
                value={gTotal}
                onChange={(e) => setGTotal(e.target.value)}
              />
            </div>
          </div>
        )}
        {gBad && (
          <p className="err" style={{ marginBottom: 0 }}>
            Enter minutes like 65, 1:05 or 1 hr 5 min.
          </p>
        )}
      </section>

      {fin && (
        <section className="card">
          <h2 style={{ margin: "0 0 18px" }}>
            Start at <span className="acc">{fmt(fin.startMs)}</span>
          </h2>

          {fin.order.map((p, i) => (
            <div key={i}>
              {i > 0 && (
                <div className="gap">
                  <div>
                    <span className="dots">{"\u22EE"}</span>
                    <a
                      className="view"
                      href={legUrl(fin.order[i - 1], p)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setViewed((v) => ({ ...v, [i]: true }))}
                    >
                      view
                    </a>
                  </div>
                  {viewed[i] && (
                    <div className="gbox">
                      <div className="gfield">
                        <span className="muted">Google Maps estimated distance</span>
                        <input
                          className="in gin"
                          placeholder="e.g. 47.5 or 47.5 km"
                          value={gdist[i] || ""}
                          onChange={(e) => setGdist((g) => ({ ...g, [i]: e.target.value }))}
                        />
                      </div>
                      <div className="gfield">
                        <span className="muted">Google Maps estimated time</span>
                        <input
                          className="in gin"
                          placeholder="e.g. 25 or 1 hr 5 min"
                          value={gtime[i] || ""}
                          onChange={(e) => setGtime((g) => ({ ...g, [i]: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <span className="acc">{i + 1}.</span> {res.names[p.idx]}
              </div>
              <div className="muted">
                {i === 0
                  ? `Depart ${fmt(p.departMs)}`
                  : i === fin.order.length - 1
                  ? `Arrive ${fmt(p.arriveMs)}`
                  : `Arrive ${fmt(p.arriveMs)} | Leave ${fmt(p.departMs)}`}
              </div>
              {i > 0 && etas[i] != null && (
                <div className="muted">
                  Google Maps ETA <span className="acc">{fmt(etas[i])}</span>
                </div>
              )}
              {i > 0 && gd[i] != null && (
                <div className="muted">
                  Google Maps distance <span className="acc">{gd[i].toFixed(1)} km</span>
                </div>
              )}
            </div>
          ))}

          <div className="muted" style={{ lineHeight: 1.9, marginTop: 20 }}>
            <div>Driving time: {fmtDur(fin.driveMin)}</div>
            <div>
              Total time: <span className="acc">{fmtDur(fin.totalMin)}</span>
            </div>
            <div>Traffic factor (calculated): {fin.factor.toFixed(2)}</div>
            <div>Fuel: {fuelL !== null ? `${fuelL.toFixed(2)} L` : "N/A"}</div>
            <div>Fuel cost: {fuelCost !== null ? fuelCost.toFixed(2) : "N/A"}</div>
          </div>

          <p style={{ marginTop: 16 }}>
            <button className="ghost" onClick={() => setSaveOpen(true)}>
              Save trip
            </button>
            {saved && (
              <span className="muted" style={{ marginLeft: 10 }}>
                Trip saved
              </span>
            )}
          </p>
        </section>
      )}

      {saveOpen && (
        <div className="ov" onClick={() => setSaveOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Save trip</h3>

            <label>Save as (trip name)</label>
            <input className="in" value={tripName} onChange={(e) => setTripName(e.target.value)} />

            <label>Trip time (min)</label>
            <input className="in" type="number" min="0" value={tripTime} onChange={nn(setTripTime)} />

            <label>Trip distance (km)</label>
            <input className="in" type="number" min="0" step="0.1" value={tripDist} onChange={nn(setTripDist)} />

            {saveErr && <p className="err">{saveErr}</p>}

            <div className="mbtns">
              <button className="btn" onClick={saveTrip} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button className="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Home() {
  const [start, setStart] = useState({ name: "", loc: "" });
  const [end, setEnd] = useState({ name: "", loc: "" });
  const [start2, setStart2] = useState({ name: "", loc: "" });
  const [end2, setEnd2] = useState({ name: "", loc: "" });
  const [stops, setStops] = useState(() => [blank()]);
  const [locs, setLocs] = useState([]);
  const [fuel, setFuel] = useState({ l100: 0, price: 0 });
  const [cars, setCars] = useState("1");
  const [capacity, setCapacity] = useState("");
  const [arrival, setArrival] = useState("");
  const [stopMin, setStopMin] = useState(5);
  const [results, setResults] = useState([]);
  const [runId, setRunId] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const two = Number(cars) === 2;

  function applyPlan(t) {
    setStart({ name: (t.start && t.start.name) || "", loc: (t.start && t.start.loc) || "" });
    setEnd({ name: (t.end && t.end.name) || "", loc: (t.end && t.end.loc) || "" });
    const list = t.stops && t.stops.length ? t.stops : [{ name: "", loc: "" }];
    setStops(
      list.map((s) => ({ id: nid(), name: s.name || "", loc: s.loc || "", people: "1" }))
    );
    setArrival(t.arrival || "");
    setStopMin(t.stopMin ?? 5);
  }

  useEffect(() => {
    async function init() {
      const l = await supabase.from("locations").select("id,name,coords").order("name");
      setLocs(l.data || []);
      const co = await supabase.from("companies").select("fuel_l100,fuel_price").maybeSingle();
      if (co.data)
        setFuel({
          l100: Number(co.data.fuel_l100) || 0,
          price: Number(co.data.fuel_price) || 0,
        });
      const p = new URLSearchParams(window.location.search);
      if (p.get("prefill")) {
        try {
          const t = JSON.parse(localStorage.getItem("abs_prefill"));
          localStorage.removeItem("abs_prefill");
          if (t) applyPlan(t);
        } catch {}
        return;
      }
      const id = p.get("trip");
      if (!id) return;
      const r = await supabase.from("trips").select("data").eq("id", id).single();
      if (r.data && r.data.data) applyPlan(r.data.data);
    }
    init();
  }, []);

  const setStop = (i, v) => setStops((s) => s.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const addStop = () => setStops((s) => [...s, blank()]);
  const delStop = (i) => setStops((s) => s.filter((_, j) => j !== i));
  const nn = (set) => (e) => {
    const v = e.target.value;
    set(Number(v) < 0 ? "0" : v);
  };
  const onCars = (e) => {
    const v = e.target.value;
    setCars(v === "" ? "" : String(Math.min(2, Math.max(1, Math.floor(Number(v)) || 1))));
  };
  const onCap = (e) => {
    const v = e.target.value;
    setCapacity(v !== "" && !(Number(v) >= 1) ? "1" : v);
  };

  async function go() {
    setErr("");
    setResults([]);
    const list = stops.filter((s) => s.loc.trim());
    if (!start.loc.trim() || !end.loc.trim() || !list.length || !arrival) {
      setErr("Fill start, end, at least one stop and arrival time.");
      return;
    }
    if (two && (!start2.loc.trim() || !end2.loc.trim())) {
      setErr("Fill start and end for car 2.");
      return;
    }
    const sm = Number(stopMin) || 0;
    if (sm < 0) return setErr("Stop time cannot be negative.");
    const nm = (x) => x.name.trim() || x.loc.trim();
    const names = [
      nm(start),
      ...list.map(nm),
      nm(end),
      ...(two ? [nm(start2), nm(end2)] : []),
    ];
    const [h, m] = arrival.split(":");
    const when = new Date();
    when.setHours(+h, +m, 0, 0);
    setBusy(true);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: list.map((s) => s.loc.trim()),
          start: start.loc.trim(),
          end: end.loc.trim(),
          start2: two ? start2.loc.trim() : undefined,
          end2: two ? end2.loc.trim() : undefined,
          arrivalMs: when.getTime(),
          stopMin: sm,
          traffic: 1,
          cars: Number(cars) || 1,
          capacity: Number(capacity) || 0,
          people: list.map((s) => Math.max(1, Math.floor(Number(s.people)) || 1)),
        }),
      });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else {
        const multi = !!d.routes;
        const routes = d.routes || [d];
        const out = routes.map((rt) => {
          const legSec = rt.order
            .slice(1)
            .map((p, i) => (p.arriveMs - rt.order[i].departMs) / 1000);
          const planStops = multi
            ? rt.order.slice(1, -1).map((p) => list[p.idx - 1])
            : list;
          const cs = rt.car === 2 ? start2 : start;
          const ce = rt.car === 2 ? end2 : end;
          return {
            ...rt,
            names,
            legSec,
            title: multi ? `Car ${rt.car} (${rt.people} people)` : "",
            plan: {
              start: { name: nm(cs), loc: cs.loc.trim() },
              end: { name: nm(ce), loc: ce.loc.trim() },
              stops: planStops.map((s) => ({ name: nm(s), loc: s.loc.trim() })),
              arrival,
              stopMin: sm,
            },
            arrivalMs: when.getTime(),
            stopMs: sm * 60000,
            l100: fuel.l100,
            price: fuel.price,
          };
        });
        setRunId((x) => x + 1);
        setResults(out);
      }
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <main className="rt">
      <h1 className="brandh">RouteIQ</h1>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Number of cars</label>
          <input
            className="in"
            type="number"
            min="1"
            max="2"
            value={cars}
            onChange={onCars}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Capacity per car</label>
          <input
            className="in"
            type="number"
            min="1"
            step="1"
            placeholder="Optional"
            value={capacity}
            onChange={onCap}
          />
        </div>
      </div>

      <label>Start location of car 1</label>
      <Row v={start} set={setStart} saved={locs} />

      <label>End location of car 1</label>
      <Row v={end} set={setEnd} saved={locs} />

      {two && (
        <>
          <label>Start location of car 2</label>
          <Row v={start2} set={setStart2} saved={locs} />

          <label>End location of car 2</label>
          <Row v={end2} set={setEnd2} saved={locs} />
        </>
      )}

      <label>Stops</label>
      {stops.map((s, i) => (
        <Row
          key={s.id}
          v={s}
          set={(v) => setStop(i, v)}
          saved={locs}
          onDel={() => delStop(i)}
          showPeople={Number(capacity) > 0}
        />
      ))}
      <button className="ghost" onClick={addStop}>
        + Add location
      </button>

      <label>Desired arrival time at end</label>
      <input className="in" type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} />

      <label>Stop time per stop (min)</label>
      <input className="in" type="number" min="0" value={stopMin} onChange={nn(setStopMin)} />

      <button className="btn" onClick={go} disabled={busy}>
        {busy ? "Planning..." : "Plan route"}
      </button>

      {err && <p className="err">{err}</p>}

      {results.map((r, i) => (
        <Result key={runId + "-" + i} res={r} />
      ))}
    </main>
  );
}