"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../db";

export default function TripPage() {
  const params = useParams();
  const id = params && params.id;
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [locs, setLocs] = useState([]);
  const [events, setEvents] = useState([]);
  const [state, setState] = useState("loading");

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
        supabase.from("clients").select("id,stop,trips_by_day").eq("status", "approved"),
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
        if (ids.includes(t.data.id) && cl.stop && !out.includes(cl.stop)) out.push(cl.stop);
      });
      setStops(out);
      setState("ok");
    }
    init();
  }, [id]);

  function copy() {
    const st = [];
    stops.forEach((n) => {
      const l = locs.find((x) => x.name === n);
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

  if (state === "loading") return null;

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

          <section className="card" style={{ marginTop: 18 }}>
            <label style={{ marginTop: 0 }}>Start location</label>
            <div>{(trip.data.start && trip.data.start.name) || "-"}</div>

            <label>End location</label>
            <div>{(trip.data.end && trip.data.end.name) || "-"}</div>

            <label>Stops</label>
            {stops.length === 0 ? (
              <div className="muted">No stops yet. Stops appear when clients join this trip.</div>
            ) : (
              stops.map((n) => <div key={n}>{n}</div>)
            )}
          </section>

          <button className="btn" onClick={copy}>
            Copy to homepage
          </button>

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