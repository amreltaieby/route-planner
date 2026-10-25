"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../db";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  const d = new Date(ms);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
};
const legUrl = (a, b) =>
  "https://www.google.com/maps/dir/?api=1&origin=" +
  a.lat +
  "," +
  a.lng +
  "&destination=" +
  b.lat +
  "," +
  b.lng +
  "&travelmode=driving";

function buildModel(r, inputs, base, isReturn, sm) {
  let rawF = 0;
  let gF = 0;
  r.legsMs.forEach((ms, i) => {
    const m = Number(inputs[i] && inputs[i].min);
    if (m > 0) {
      rawF += ms;
      gF += m * 60000;
    }
  });
  const f = rawF > 0 ? gF / rawF : 1;
  const adj = r.legsMs.map((ms, i) => {
    const m = Number(inputs[i] && inputs[i].min);
    return m > 0 ? m * 60000 : ms * f;
  });
  const n = r.mids.length;
  const total = adj.reduce((a, b) => a + b, 0) + n * sm;
  const start = isReturn ? base : base - total;
  const pts = [{ leave: start }];
  let cur = start;
  for (let i = 0; i < adj.length; i++) {
    cur += adj[i];
    if (i < n) {
      const arrive = cur;
      cur += sm;
      pts.push({ arrive, leave: cur });
    } else pts.push({ arrive: cur });
  }
  const km = inputs.reduce((a, x) => a + (Number(x && x.km) || 0), 0);
  return { pts, total, km, drive: adj.reduce((a, b) => a + b, 0) };
}

export default function PlanPage() {
  const params = useParams();
  const id = params && params.id;
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [locs, setLocs] = useState([]);
  const [state, setState] = useState("loading");
  const [cars, setCars] = useState("1");
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [routes, setRoutes] = useState(null);
  const [legs, setLegs] = useState([]);
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    if (!id) return;
    async function init() {
      const t = await supabase
        .from("trips")
        .select("id,name,data")
        .eq("id", id)
        .maybeSingle();
      if (t.error || !t.data || !t.data.data) {
        setState("missing");
        return;
      }
      setTrip(t.data);
      const [l, c] = await Promise.all([
        supabase.from("locations").select("name,coords"),
        supabase
          .from("clients")
          .select("id,name,first_name,last_name,phone,stop,trips_by_day")
          .eq("status", "approved"),
      ]);
      setLocs(l.data || []);
      const day = t.data.data.day;
      const out = [];
      (c.data || []).forEach((cl) => {
        const v = cl.trips_by_day;
        const ids =
          v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v[day]) ? v[day] : [];
        if (!ids.includes(t.data.id) || !cl.stop) return;
        const nm =
          [cl.first_name, cl.last_name].filter(Boolean).join(" ").trim() || cl.name || "Client";
        let s = out.find((x) => x.name === cl.stop);
        if (!s) {
          s = { name: cl.stop, clients: [] };
          out.push(s);
        }
        s.clients.push({ n: nm, p: cl.phone || "-" });
      });
      setStops(out);
      setState("ok");
    }
    init();
  }, [id]);

  const isReturn = trip && trip.data.type === "return";
  const nCars = Math.floor(Number(cars));

  function baseMs() {
    const p = (trip.data.arrival || "").split(":").map(Number);
    const d = new Date();
    d.setHours(p[0] || 0, p[1] || 0, 0, 0);
    return d.getTime();
  }

  async function calculate() {
    setErr("");
    setRoutes(null);
    const d = trip.data;
    if (!d.start || !d.start.loc || !d.end || !d.end.loc)
      return setErr("This trip needs a start and an end location. Edit it on the Trips page.");
    if (!(nCars >= 1 && nCars <= 2)) return setErr("Number of cars must be 1 or 2.");
    const cp = Number(cap);
    if (nCars > 1 && !(cp > 0)) return setErr("Enter the capacity per car.");
    const withLoc = [];
    const miss = [];
    stops.forEach((s) => {
      const l = locs.find((x) => x.name === s.name);
      if (l && l.coords) withLoc.push({ s, coords: l.coords });
      else miss.push(s.name);
    });
    if (withLoc.length === 0)
      return setErr(stops.length ? "None of the stops match a saved location." : "No stops yet.");
    const body = {
      stops: withLoc.map((x) => x.coords),
      start: d.start.loc,
      end: d.end.loc,
      arrivalMs: baseMs(),
      stopMin: Number(d.stopMin) || 0,
      traffic: 1,
      cars: nCars,
    };
    if (nCars > 1) {
      body.start2 = d.start.loc;
      body.end2 = d.end.loc;
      body.capacity = cp;
      body.people = withLoc.map((x) => x.s.clients.length);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data || data.error) {
        setBusy(false);
        return setErr((data && data.error) || "Could not plan the route.");
      }
      const list = data.routes ? data.routes : [data];
      const out = [];
      for (const r of list) {
        if (!r || !r.order || r.order.length < 2) continue;
        const order = r.order;
        const mids = order.slice(1, -1).map((o) => withLoc[o.idx - 1]);
        if (mids.some((m) => !m)) {
          setBusy(false);
          return setErr("Unexpected route response.");
        }
        const legsMs = [];
        for (let i = 1; i < order.length; i++)
          legsMs.push(order[i].arriveMs - order[i - 1].departMs);
        out.push({
          car: r.car || out.length + 1,
          people: r.people,
          url: r.mapsUrl,
          pts: order.map((o) => ({ lat: o.lat, lng: o.lng })),
          mids: mids.map((m) => m.s),
          legsMs,
          km: r.distanceKm,
        });
      }
      if (out.length === 0) {
        setBusy(false);
        return setErr("Unexpected route response.");
      }
      setMissing(miss);
      setLegs(out.map((r) => r.legsMs.map(() => ({ km: "", min: "" }))));
      setRoutes(out);
    } catch {
      setErr("Could not reach the route service.");
    }
    setBusy(false);
  }

  function setLeg(ri, li, key, v) {
    const val = Number(v) < 0 ? "0" : v;
    setLegs((ls) =>
      ls.map((row, a) =>
        a !== ri ? row : row.map((x, b) => (b !== li ? x : { ...x, [key]: val }))
      )
    );
  }

  if (state === "loading") return null;

  return (
    <main className="rt">
      <Link className="maps" href={"/trips/" + id}>
        Back to trip
      </Link>

      {state === "missing" ? (
        <p className="muted" style={{ marginTop: 20 }}>
          Trip not found.
        </p>
      ) : (
        <>
          <h1 style={{ marginTop: 14 }}>{"Plan: " + trip.name}</h1>
          <div className="muted">
            {trip.data.day ? trip.data.day + " | " : ""}
            {isReturn ? "Leave time" : "Arrival time"}: {trip.data.arrival || "-"}
          </div>

          <section className="card" style={{ marginTop: 18 }}>
            <label style={{ marginTop: 0 }}>Number of cars (1 or 2)</label>
            <input
              className="in"
              type="number"
              min="1"
              max="2"
              value={cars}
              onChange={(e) => setCars(e.target.value)}
            />
            {nCars > 1 && (
              <>
                <label>Capacity per car</label>
                <input
                  className="in"
                  type="number"
                  min="1"
                  value={cap}
                  onChange={(e) => setCap(Number(e.target.value) < 0 ? "1" : e.target.value)}
                />
              </>
            )}
            <button className="btn" onClick={calculate} disabled={busy}>
              {busy ? "Calculating..." : "Calculate"}
            </button>
            {err && <p className="err">{err}</p>}
            {stops.length === 0 && (
              <div className="muted" style={{ marginTop: 10 }}>
                No stops yet. Stops appear when clients join this trip.
              </div>
            )}
          </section>

          {missing.length > 0 && routes && (
            <div className="muted" style={{ marginTop: 10 }}>
              {"Not in the route (no saved location): " + missing.join(", ")}
            </div>
          )}

          {routes &&
            routes.map((r, ri) => {
              const inputs = legs[ri] || [];
              const sm = (Number(trip.data.stopMin) || 0) * 60000;
              const m = buildModel(r, inputs, baseMs(), isReturn, sm);
              return (
                <section className="card" key={ri} style={{ marginTop: 18 }}>
                  {routes.length > 1 && (
                    <div className="sec" style={{ margin: "0 0 8px", fontSize: 15 }}>
                      {"Car " + r.car + (r.people != null ? " (" + r.people + " people)" : "")}
                    </div>
                  )}

                  <label style={{ marginTop: 0 }}>Start location</label>
                  <div>
                    {(trip.data.start && trip.data.start.name) || "-"}
                    <span className="muted">{" | Leave " + fmt(m.pts[0].leave) + " (estimated)"}</span>
                  </div>

                  {r.legsMs.map((ms, li) => {
                    const a = r.pts[li];
                    const b = r.pts[li + 1];
                    const s = r.mids[li];
                    const p = m.pts[li + 1];
                    const inp = inputs[li] || { km: "", min: "" };
                    return (
                      <div key={li}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 0",
                          }}
                        >
                          <span className="muted" style={{ lineHeight: 1 }}>
                            {"\u22EE"}
                          </span>
                          <a className="maps" href={legUrl(a, b)} target="_blank" rel="noreferrer">
                            View Google Maps link
                          </a>
                          <input
                            className="in"
                            style={{ width: 130 }}
                            type="number"
                            min="0"
                            placeholder="Distance (km)"
                            value={inp.km}
                            onChange={(e) => setLeg(ri, li, "km", e.target.value)}
                          />
                          <input
                            className="in"
                            style={{ width: 130 }}
                            type="number"
                            min="0"
                            placeholder="Time (min)"
                            value={inp.min}
                            onChange={(e) => setLeg(ri, li, "min", e.target.value)}
                          />
                        </div>

                        {s ? (
                          <div>
                            <div>
                              <b>{"Stop " + (li + 1)}</b>
                              {": " + s.name + " --- "}
                              {s.clients.map((c) => c.n + ", " + c.p).join(" | ")}
                            </div>
                            <div className="muted">
                              {"Arrive " +
                                fmt(p.arrive) +
                                " | Leave " +
                                fmt(p.leave) +
                                " (estimated)"}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label>End location</label>
                            <div>
                              {(trip.data.end && trip.data.end.name) || "-"}
                              <span className="muted">
                                {" | Arrive " + fmt(p.arrive) + " (estimated)"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="muted" style={{ marginTop: 12 }}>
                    {"Drive " +
                      Math.round(m.drive / 60000) +
                      " min | Stops " +
                      r.mids.length +
                      " x " +
                      (Number(trip.data.stopMin) || 0) +
                      " min | Total " +
                      Math.round(m.total / 60000) +
                      " min" +
                      (Number.isFinite(Number(r.km)) && r.km != null
                        ? " | App distance " + Number(r.km).toFixed(1) + " km"
                        : "") +
                      (m.km > 0 ? " | Google distance (entered) " + m.km.toFixed(1) + " km" : "")}
                  </div>
                  {r.url && (
                    <div style={{ marginTop: 8 }}>
                      <a className="maps" href={r.url} target="_blank" rel="noreferrer">
                        Open full route in Google Maps
                      </a>
                    </div>
                  )}
                </section>
              );
            })}

          <p className="muted" style={{ fontSize: 11, marginTop: 28 }}>
            {"Routes calculated with "}
            <a className="maps" href="https://project-osrm.org" target="_blank" rel="noreferrer">
              OSRM
            </a>
            {". Map data \u00A9 "}
            <a
              className="maps"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>
            {" (ODbL)."}
          </p>
        </>
      )}
    </main>
  );
}