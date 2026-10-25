"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../db";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  const d = new Date(ms);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
};

export default function TripPage() {
  const params = useParams();
  const id = params && params.id;
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [locs, setLocs] = useState([]);
  const [events, setEvents] = useState([]);
  const [state, setState] = useState("loading");

  const [planning, setPlanning] = useState(false);
  const [planErr, setPlanErr] = useState("");
  const [plan, setPlan] = useState(null);
  const [gKm, setGKm] = useState("");
  const [gMin, setGMin] = useState("");
  const [calcErr, setCalcErr] = useState("");
  const [times, setTimes] = useState(null);

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
      const [l, c, ev] = await Promise.all([
        supabase.from("locations").select("name,coords"),
        supabase
          .from("clients")
          .select("id,name,first_name,last_name,phone,stop,trips_by_day")
          .eq("status", "approved"),
        supabase
          .from("trip_events")
          .select("id,created_at,client_name,action,day")
          .eq("trip_id", id)
          .order("created_at", { ascending: false }),
      ]);
      setLocs(l.data || []);
      setEvents(ev.data || []);
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

  function copy() {
    const st = [];
    stops.forEach((s) => {
      const l = locs.find((x) => x.name === s.name);
      if (l) st.push({ name: l.name, loc: l.coords });
    });
    try {
      localStorage.setItem(
        "abs_prefill",
        JSON.stringify({
          start: trip.data.start,
          end: trip.data.end,
          stops: st,
          arrival: trip.data.arrival || "",
          stopMin: trip.data.stopMin ?? 5,
        })
      );
    } catch {}
    window.location.assign("/?prefill=1");
  }

  function baseMs() {
    const p = (trip.data.arrival || "").split(":").map(Number);
    const d = new Date();
    d.setHours(p[0] || 0, p[1] || 0, 0, 0);
    return d.getTime();
  }

  async function openMaps() {
    setPlanErr("");
    setCalcErr("");
    setTimes(null);
    const d = trip.data;
    if (!d.start || !d.start.loc || !d.end || !d.end.loc) {
      setPlanErr("This trip needs a start and an end location. Edit it on the Trips page.");
      return;
    }
    if (stops.length === 0) {
      setPlanErr("No stops yet.");
      return;
    }
    const withLoc = [];
    const missing = [];
    stops.forEach((s) => {
      const l = locs.find((x) => x.name === s.name);
      if (l && l.coords) withLoc.push({ s, coords: l.coords });
      else missing.push(s.name);
    });
    if (withLoc.length === 0) {
      setPlanErr("None of the stops match a saved location.");
      return;
    }
    const w = window.open("", "_blank");
    setPlanning(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: withLoc.map((x) => x.coords),
          start: d.start.loc,
          end: d.end.loc,
          arrivalMs: baseMs(),
          stopMin: Number(d.stopMin) || 0,
          traffic: 1,
          cars: 1,
        }),
      });
      const data = await res.json();
      const r = data && data.routes ? data.routes[0] : data;
      if (!res.ok || !r || data.error || !r.order) {
        if (w) w.close();
        setPlanErr((data && data.error) || "Could not plan the route.");
        setPlanning(false);
        return;
      }
      const order = r.order;
      if (order.length !== withLoc.length + 2) {
        if (w) w.close();
        setPlanErr("Unexpected route response.");
        setPlanning(false);
        return;
      }
      const legs = [];
      for (let i = 1; i < order.length; i++) legs.push(order[i].arriveMs - order[i - 1].departMs);
      const ordered = order.slice(1, -1).map((o) => withLoc[o.idx - 1].s);
      missing.forEach((m) => {
        const s = stops.find((x) => x.name === m);
        if (s) ordered.push(s);
      });
      setStops(ordered);
      setPlan({ url: r.mapsUrl, legs, n: withLoc.length, missing });
      if (r.mapsUrl) {
        if (w) w.location.href = r.mapsUrl;
      } else if (w) w.close();
    } catch {
      if (w) w.close();
      setPlanErr("Could not reach the route service.");
    }
    setPlanning(false);
  }

  function calc() {
    setCalcErr("");
    const g = Number(gMin);
    if (!(g > 0)) return setCalcErr("Enter the Google time in minutes.");
    const raw = plan.legs.reduce((a, b) => a + b, 0) / 60000;
    if (!(raw > 0)) return setCalcErr("Route time is zero.");
    const f = g / raw;
    const sm = (Number(trip.data.stopMin) || 0) * 60000;
    const total = (raw * f * 60000) + plan.n * sm;
    const start = isReturn ? baseMs() : baseMs() - total;
    const rows = [{ kind: "start", leave: start }];
    let cur = start;
    for (let i = 0; i < plan.legs.length; i++) {
      cur += plan.legs[i] * f;
      if (i < plan.n) {
        const arrive = cur;
        cur += sm;
        rows.push({ kind: "stop", arrive, leave: cur });
      } else rows.push({ kind: "end", arrive: cur });
    }
    setTimes(rows);
  }

  if (state === "loading") return null;

  const hasPlan = !!plan;

  return (
    <main className="rt">
      <Link className="maps" href="/trips">
        Back to trips
      </Link>

      {state === "missing" ? (
        <p className="muted" style={{ marginTop: 20 }}>
          Trip not found.
        </p>
      ) : (
        <>
          <h1 style={{ marginTop: 14 }}>{trip.name}</h1>
          <div className="muted">
            {isReturn ? "Leave time" : "Arrival time"}: {trip.data.arrival || "-"}
          </div>

          <section className="card" style={{ marginTop: 18 }}>
            <label style={{ marginTop: 0 }}>Start location</label>
            <div>
              {(trip.data.start && trip.data.start.name) || "-"}
              {times && (
                <span className="muted">{" | Leave " + fmt(times[0].leave) + " (estimated)"}</span>
              )}
            </div>

            <label>Stops</label>
            {stops.length === 0 ? (
              <div className="muted">No stops yet. Stops appear when clients join this trip.</div>
            ) : (
              stops.map((s, i) => (
                <div key={s.name}>
                  {i > 0 && (
                    <div className="muted" style={{ lineHeight: 1, padding: "4px 0 4px 6px" }}>
                      {"\u22EE"}
                    </div>
                  )}
                  <div>
                    <b>{s.name}</b>
                    {" : "}
                    {s.clients.map((c) => c.n + ", " + c.p).join(" | ")}
                  </div>
                  {times && times[i + 1] && times[i + 1].kind === "stop" && (
                    <div className="muted">
                      {"Arrive " +
                        fmt(times[i + 1].arrive) +
                        " | Leave " +
                        fmt(times[i + 1].leave) +
                        " (estimated)"}
                    </div>
                  )}
                </div>
              ))
            )}

            <label>End location</label>
            <div>
              {(trip.data.end && trip.data.end.name) || "-"}
              {times && (
                <span className="muted">
                  {" | Arrive " + fmt(times[times.length - 1].arrive) + " (estimated)"}
                </span>
              )}
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={copy}>
              Copy to homepage
            </button>
            <button className="btn" onClick={openMaps} disabled={planning}>
              {planning ? "Planning..." : "Open in Google Maps"}
            </button>
          </div>
          {planErr && <p className="err">{planErr}</p>}

          {hasPlan && (
            <section className="card" style={{ marginTop: 18 }}>
              {plan.url && (
                <a className="maps" href={plan.url} target="_blank" rel="noreferrer">
                  Open route in Google Maps
                </a>
              )}
              {plan.missing.length > 0 && (
                <div className="muted">
                  {"Not in the route (no saved location): " + plan.missing.join(", ")}
                </div>
              )}
              <label>Distance from Google (km)</label>
              <input
                className="in"
                type="number"
                min="0"
                value={gKm}
                onChange={(e) => setGKm(e.target.value)}
              />
              <label>Time from Google (minutes)</label>
              <input
                className="in"
                type="number"
                min="0"
                value={gMin}
                onChange={(e) => setGMin(e.target.value)}
              />
              <button className="btn" onClick={calc}>
                Estimate stop times
              </button>
              {calcErr && <p className="err">{calcErr}</p>}
              {times && (
                <div className="muted" style={{ marginTop: 10 }}>
                  {(gKm ? "Distance " + gKm + " km | " : "") +
                    "Drive " +
                    Math.round(Number(gMin)) +
                    " min | Stops " +
                    plan.n +
                    " x " +
                    (Number(trip.data.stopMin) || 0) +
                    " min"}
                </div>
              )}
            </section>
          )}

          <div className="sec" style={{ marginTop: 32 }}>
            Join and leave log
          </div>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Action</th>
                <th>Day</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.client_name || "-"}</td>
                  <td>{e.action === "join" ? "Joined" : "Left"}</td>
                  <td>{e.day || "-"}</td>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && <div className="empty">No activity yet.</div>}
        </>
      )}
    </main>
  );
}