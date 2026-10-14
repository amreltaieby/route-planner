"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../db";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const top = (arr) => {
  const c = {};
  arr.forEach((x) => {
    if (x) c[x] = (c[x] || 0) + 1;
  });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
};

export default function Schedule() {
  const [locs, setLocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [arr, setArr] = useState({});
  const [routes, setRoutes] = useState({});
  const [today, setToday] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const cache = useRef({});

  useEffect(() => {
    async function init() {
      const l = await supabase.from("locations").select("id,name,coords");
      setLocs(l.data || []);
      const c = await supabase.from("clients").select("id,name,stop,days,end_loc");
      setClients(c.data || []);
      try {
        setArr(JSON.parse(localStorage.getItem("abs_sched_arrival")) || {});
      } catch {}
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
          const dateStr = d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const cl = clients.filter((c) => c.stop && toArr(c.days).includes(dayName));
          const endName = top(cl.map((c) => c.end_loc));
          const groups = {};
          cl.forEach((c) => {
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
          return { dayName, dateStr, cl, endName, groups, eLoc, mids, sig };
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

  function setArrival(day, v) {
    const n = { ...arr, [day]: v };
    setArr(n);
    try {
      localStorage.setItem("abs_sched_arrival", JSON.stringify(n));
    } catch {}
  }

  function rowsFor(d, midOrder) {
    const names = [...midOrder];
    if (d.groups[d.endName]) names.push(d.endName);
    return names.map((n) => ({ name: n, clients: d.groups[n] }));
  }

  function copyToHome(d, rows) {
    const stopRows = rows.filter((r) => r.name !== d.endName);
    if (!stopRows.length || !d.eLoc) return;
    const mk = (n) => ({ name: n, loc: locOf(n).coords });
    const data = {
      start: mk(stopRows[0].name),
      stops: stopRows.slice(1).map((r) => mk(r.name)),
      end: { name: d.endName, loc: d.eLoc.coords },
      arrival: arr[d.dayName] || "",
    };
    try {
      localStorage.setItem("abs_prefill", JSON.stringify(data));
    } catch {}
    window.open("/?prefill=1", "_blank");
  }

  return (
    <main className="rt">
      <h1>Schedule</h1>

      {days.map((d) => {
        let rows = null;
        let note = "";
        if (!d.cl.length) note = "No clients scheduled.";
        else if (!d.eLoc)
          note = "Assign an end location to these clients on the Clients page.";
        else if (d.sig) {
          const rt = routes[d.sig];
          if (!rt || rt.pending) note = "Calculating route...";
          else if (rt.error) note = rt.error;
          else rows = rowsFor(d, rt.order);
        } else rows = rowsFor(d, []);

        const canCopy = rows && rows.some((r) => r.name !== d.endName);

        return (
          <section className="card" key={d.dayName + d.dateStr}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17 }}>
                {d.dayName}, {d.dateStr}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="muted">Arrival time</span>
                <input
                  className="in"
                  type="time"
                  style={{ width: 140 }}
                  value={arr[d.dayName] || ""}
                  onChange={(e) => setArrival(d.dayName, e.target.value)}
                />
                <button
                  className="ghost"
                  style={{ marginTop: 0 }}
                  disabled={!canCopy}
                  onClick={() => copyToHome(d, rows)}
                >
                  Copy to homepage
                </button>
              </div>
            </div>

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
          </section>
        );
      })}
    </main>
  );
}