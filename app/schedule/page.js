"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../db";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const arr = (x) => (Array.isArray(x) ? x : []);
const tbObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const top = (list) => {
  const c = {};
  list.forEach((x) => {
    if (x) c[x] = (c[x] || 0) + 1;
  });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
};

export default function ClientLists() {
  const [locs, setLocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState({});
  const [today, setToday] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const cache = useRef({});

  useEffect(() => {
    async function init() {
      const [l, t, c] = await Promise.all([
        supabase.from("locations").select("id,name,coords"),
        supabase.from("trips").select("id,name,data"),
        supabase
          .from("clients")
          .select("id,name,stop,days,end_loc,trips_by_day")
          .eq("status", "approved"),
      ]);
      if (c.error) setErr(c.error.message);
      setLocs(l.data || []);
      setTrips((t.data || []).filter((x) => x.data && x.data.day));
      setClients(c.data || []);
      setToday(new Date());
      setLoaded(true);
    }
    init();
  }, []);

  const locOf = (n) => locs.find((l) => l.name === n);

  const days =
    loaded && today
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
          const cl = clients.filter((c) => toArr(c.days).includes(dayName));
          const withStop = cl.filter((c) => c.stop);
          const noStop = cl.filter((c) => !c.stop).map((c) => c.name);

          const joinedEnds = [];
          cl.forEach((c) => {
            arr(tbObj(c.trips_by_day)[dayName]).forEach((id) => {
              const t = trips.find((x) => x.id === id);
              if (t && t.data.end && t.data.end.name) joinedEnds.push(t.data.end.name);
            });
          });
          const endName = top(joinedEnds) || top(cl.map((c) => c.end_loc));

          const groups = {};
          withStop.forEach((c) => {
            (groups[c.stop] = groups[c.stop] || []).push(c.name);
          });
          const eLoc = locOf(endName);
          const mids = Object.keys(groups)
            .filter((n) => n !== endName && locOf(n))
            .sort();
          const sig =
            eLoc && mids.length
              ? JSON.stringify([eLoc.coords, mids.map((n) => [n, locOf(n).coords])])
              : "";
          return { dayName, cl, noStop, withStop, endName, groups, eLoc, mids, sig };
        })
      : [];

  const dkey = JSON.stringify(days.map((d) => d.sig));

  useEffect(() => {
    let alive = true;
    async function run() {
      for (const d of days) {
        if (!alive) return;
        if (!d.sig || cache.current[d.sig]) continue;
        cache.current[d.sig] = { pending: true };
        try {
          const r = await fetch("/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stops: d.mids.map((n) => locOf(n).coords),
              end: d.eLoc.coords,
              arrivalMs: Date.now(),
              stopMin: 0,
              traffic: 1,
            }),
          });
          const j = await r.json();
          if (j.error) cache.current[d.sig] = { error: j.error };
          else
            cache.current[d.sig] = {
              order: j.order
                .filter((p) => p.idx < d.mids.length)
                .map((p) => d.mids[p.idx]),
            };
        } catch (e) {
          cache.current[d.sig] = { error: e.message };
        }
        setRoutes({ ...cache.current });
        await sleep(1500);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [dkey]);

  function rowsFor(d, midOrder) {
    const names = [...midOrder];
    Object.keys(d.groups)
      .filter((n) => n !== d.endName && !names.includes(n))
      .sort()
      .forEach((n) => names.push(n));
    if (d.groups[d.endName]) names.push(d.endName);
    return names.map((n) => ({ name: n, clients: d.groups[n] }));
  }

  return (
    <main className="rt">
      <h1>Client lists</h1>
      {err && <p className="err">{err}</p>}

      {days.map((d) => {
        let rows = null;
        let note = "";
        let info = "";
        if (!d.cl.length) note = "No clients scheduled.";
        else if (!d.withStop.length) note = "These clients have no stop set.";
        else if (d.eLoc && d.sig) {
          const rt = routes[d.sig];
          if (!rt || rt.pending) note = "Calculating route...";
          else if (rt.error) note = rt.error;
          else rows = rowsFor(d, rt.order);
        } else if (d.eLoc) rows = rowsFor(d, []);
        else {
          rows = rowsFor(d, []);
          info = "No end location found for this day, so the stop order is not optimized.";
        }

        return (
          <section className="card" key={d.dayName}>
            <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>{d.dayName}</h3>

            {rows ? (
              <table>
                <thead>
                  <tr>
                    <th>Stop number</th>
                    <th>Stop name</th>
                    <th>Clients at stop</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.name}>
                      <td>{i + 1}</td>
                      <td>{r.name}</td>
                      <td>{r.clients.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="muted">{note}</div>
            )}
            {info && (
              <div className="muted" style={{ marginTop: 8 }}>
                {info}
              </div>
            )}
            {d.noStop.length > 0 && (
              <div className="muted" style={{ marginTop: 8 }}>
                No stop set: {d.noStop.join(", ")}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}