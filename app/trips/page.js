"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../db";
import CheckPick from "../CheckPick";

let uid = 0;
const nid = () => ++uid;

const fmt = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtHM = (hm) => {
  const [h, m] = hm.split(":");
  const d = new Date();
  d.setHours(+h, +m, 0, 0);
  return fmt(d.getTime());
};

const fmtDur = (min) => {
  const t = Math.round(min);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
};

export default function Trips() {
  const [locs, setLocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [trips, setTrips] = useState([]);
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [stops, setStops] = useState(() => [{ id: nid(), locId: "", clients: [] }]);
  const [stopMin, setStopMin] = useState(5);
  const [traffic, setTraffic] = useState(1.3);
  const [arrival, setArrival] = useState("");
  const [calc, setCalc] = useState(null);
  const [calcErr, setCalcErr] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadTrips() {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    setTrips(data || []);
  }

  useEffect(() => {
    async function init() {
      const l = await supabase.from("locations").select("id,name,coords").order("name");
      setLocs(l.data || []);
      const c = await supabase.from("clients").select("id,name,stop").order("name");
      setClients(c.data || []);
      loadTrips();
    }
    init();
  }, []);

  const nn = (set) => (e) => {
    const v = e.target.value;
    set(Number(v) < 0 ? "0" : v);
  };
  const locOf = (id) => locs.find((l) => l.id === id);
  const sLoc = locOf(startId);
  const eLoc = locOf(endId);
  const mids = stops
    .map((s, i) => ({ i, s, l: locOf(s.locId) }))
    .filter((x) => x.l);

  const addStop = () =>
    setStops((s) => [...s, { id: nid(), locId: "", clients: [] }]);
  const setStopLoc = (i, v) =>
    setStops((s) => s.map((x, j) => (j === i ? { ...x, locId: v, clients: [] } : x)));
  const setStopClients = (i, v) =>
    setStops((s) => s.map((x, j) => (j === i ? { ...x, clients: v } : x)));

  const clientItems = (i) => {
    const l = locOf(stops[i].locId);
    if (!l) return [];
    const taken = new Set(stops.filter((_, j) => j !== i).flatMap((s) => s.clients));
    return clients
      .filter((c) => c.stop === l.name && !taken.has(c.id))
      .map((c) => ({ id: c.id, label: c.name }));
  };

  const sig = JSON.stringify([
    startId,
    endId,
    stops.map((s) => s.locId),
    arrival,
    stopMin,
    traffic,
    locs.length,
  ]);

  useEffect(() => {
    if (!sLoc || !eLoc || !mids.length || !arrival) {
      setCalc(null);
      setCalcErr("");
      setCalcBusy(false);
      return;
    }
    const sm = Math.max(0, Number(stopMin) || 0);
    const [h, m] = arrival.split(":");
    const when = new Date();
    when.setHours(+h, +m, 0, 0);
    const body = JSON.stringify({
      stops: mids.map((x) => x.l.coords),
      start: sLoc.coords,
      end: eLoc.coords,
      arrivalMs: when.getTime(),
      stopMin: sm,
      traffic,
    });
    const rowIdx = mids.map((x) => x.i);
    let alive = true;
    const t = setTimeout(async () => {
      setCalcBusy(true);
      setCalcErr("");
      try {
        const r = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const d = await r.json();
        if (!alive) return;
        if (d.error) {
          setCalc(null);
          setCalcErr(d.error);
        } else setCalc({ ...d, rowIdx });
      } catch (e) {
        if (alive) setCalcErr(e.message);
      }
      if (alive) setCalcBusy(false);
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [sig]);

  const info = {};
  if (calc)
    calc.order.forEach((p, k) => {
      const key =
        p.idx === 0
          ? "start"
          : p.idx === calc.rowIdx.length + 1
          ? "end"
          : "s" + calc.rowIdx[p.idx - 1];
      info[key] = { no: k + 1, ...p };
    });

  async function save() {
    setErr("");
    setMsg("");
    if (!name.trim()) return setErr("Enter a trip name.");
    if (calcBusy) return setErr("Wait for the calculation to finish.");
    if (!calc) return setErr("Complete the route first (start, end, a stop and arrival time).");
    const data = {
      start: { name: sLoc.name, loc: sLoc.coords },
      end: { name: eLoc.name, loc: eLoc.coords },
      stops: mids.map((x) => ({
        name: x.l.name,
        loc: x.l.coords,
        clients: clients.filter((c) => x.s.clients.includes(c.id)).map((c) => c.name),
      })),
      arrival,
      stopMin: Math.max(0, Number(stopMin) || 0),
      traffic: Number(traffic) > 0 ? Number(traffic) : 1,
    };
    setSaving(true);
    const { error } = await supabase.from("trips").insert({
      name: name.trim(),
      time_min: Math.round(calc.totalMin * 10) / 10,
      distance_km: Math.round(calc.distanceKm * 10) / 10,
      data,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    setName("");
    setMsg("Trip saved.");
    loadTrips();
  }

  const locOptions = locs.map((l) => (
    <option key={l.id} value={l.id}>
      {l.name}
    </option>
  ));

  return (
    <main className="rt wide">
      <h1>Trips</h1>

      <div className="sec">Create new trip</div>
      <div className="gwrap">
        <div className="g4">
          <div className="gh">Locations</div>
          <div className="gh">Arrival time</div>
          <div className="gh">Clients in stop</div>
          <div className="gh">Trip link</div>

          <select className="in" value={startId} onChange={(e) => setStartId(e.target.value)}>
            <option value="">Start</option>
            {locOptions}
          </select>
          <div className="muted">
            {info.start ? (
              <>
                {info.start.no}. Depart <span className="acc">{fmt(info.start.departMs)}</span>
              </>
            ) : (
              "-"
            )}
          </div>
          <div />
          <div>
            {calc ? (
              <a className="maps" href={calc.mapsUrl} target="_blank" rel="noreferrer">
                Open trip in Google Maps
              </a>
            ) : (
              <span className="muted">-</span>
            )}
          </div>

          <select className="in" value={endId} onChange={(e) => setEndId(e.target.value)}>
            <option value="">End</option>
            {locOptions}
          </select>
          <input
            className="in"
            type="time"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
          <div />
          <div />

          {stops.map((s, i) => {
            const l = locOf(s.locId);
            const inf = info["s" + i];
            return (
              <Fragment key={s.id}>
                <select
                  className="in"
                  value={s.locId}
                  onChange={(e) => setStopLoc(i, e.target.value)}
                >
                  <option value="">{`Stop ${i + 1}`}</option>
                  {locOptions}
                </select>
                <div className="muted">
                  {inf ? (
                    <>
                      {inf.no}. Arrive <span className="acc">{fmt(inf.arriveMs)}</span>
                    </>
                  ) : (
                    "-"
                  )}
                </div>
                <CheckPick
                  label={
                    l
                      ? `Clients in ${l.name}: ${s.clients.length || "none"}`
                      : "Clients in stop (select a stop)"
                  }
                  items={clientItems(i)}
                  selected={s.clients}
                  onChange={(v) => setStopClients(i, v)}
                  disabled={!l}
                />
                <div />
              </Fragment>
            );
          })}

          <div>
            <label className="gl">Stopped time per stop (min)</label>
            <input
              className="in"
              type="number"
              min="0"
              value={stopMin}
              onChange={nn(setStopMin)}
            />
          </div>
          <div />
          <div />
          <div />

          <div>
            <label className="gl">Traffic factor</label>
            <input
              className="in"
              type="number"
              step="0.05"
              min="0"
              value={traffic}
              onChange={nn(setTraffic)}
            />
          </div>
          <div />
          <div />
          <div />

          <div>
            <button className="ghost" onClick={addStop}>
              + Add stop
            </button>
          </div>
          <div />
          <div />
          <div />
        </div>
      </div>

      {calcBusy && <p className="muted">Calculating...</p>}
      {calcErr && <p className="err">{calcErr}</p>}

      <div className="row" style={{ marginTop: 18 }}>
        <input
          className="in nm"
          placeholder="Trip name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" style={{ marginTop: 0 }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <div className="sec">Saved trips</div>
      <div className="gwrap">
        <table>
          <thead>
            <tr>
              <th>Trip name</th>
              <th>Route</th>
              <th>Arrival time</th>
              <th>Distance</th>
              <th>Time</th>
              <th>Clients</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => {
              const d = t.data || {};
              const route = d.start
                ? [d.start.name, ...(d.stops || []).map((s) => s.name), d.end && d.end.name].join(" → ")
                : "-";
              const cl =
                (d.stops || [])
                  .filter((s) => s.clients && s.clients.length)
                  .map((s) => `${s.name}: ${s.clients.join(", ")}`)
                  .join(" | ") || "-";
              return (
                <tr key={t.id}>
                  <td>
                    <Link className="maps" href={`/?trip=${t.id}`}>
                      {t.name}
                    </Link>
                  </td>
                  <td>{route}</td>
                  <td>{d.arrival ? fmtHM(d.arrival) : "-"}</td>
                  <td>{t.distance_km != null ? `${Number(t.distance_km).toFixed(1)} km` : "-"}</td>
                  <td>{t.time_min != null ? fmtDur(Number(t.time_min)) : "-"}</td>
                  <td>{cl}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {trips.length === 0 && <div className="empty">No saved trips yet.</div>}
    </main>
  );
}