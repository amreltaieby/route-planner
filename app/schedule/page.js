"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const arr = (x) => (Array.isArray(x) ? x : []);
const tbObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export default function StopsPage() {
  const [clients, setClients] = useState([]);
  const [trips, setTrips] = useState([]);
  const [today, setToday] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function init() {
      const [t, c] = await Promise.all([
        supabase.from("trips").select("id,name,data"),
        supabase
          .from("clients")
          .select("id,name,stop,days,trips_by_day")
          .eq("status", "approved"),
      ]);
      if (c.error) setErr(c.error.message);
      setTrips((t.data || []).filter((x) => x.data && x.data.day));
      setClients(c.data || []);
      setToday(new Date());
      setLoaded(true);
    }
    init();
  }, []);

  const days =
    loaded && today
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
          const cl = clients.filter((c) => toArr(c.days).includes(dayName));
          const noStop = cl.filter((c) => !c.stop).map((c) => c.name);
          const stops = {};
          cl.filter((c) => c.stop).forEach((c) => {
            const s = stops[c.stop] || (stops[c.stop] = { name: c.stop, clients: [], tripsMap: {} });
            s.clients.push(c.name);
            const names = arr(tbObj(c.trips_by_day)[dayName])
              .map((id) => {
                const t = trips.find((x) => x.id === id);
                return t ? t.name : null;
              })
              .filter(Boolean);
            if (!names.length) names.push("No trip joined");
            names.forEach((n) => {
              (s.tripsMap[n] = s.tripsMap[n] || []).push(c.name);
            });
          });
          const rows = Object.values(stops).sort((a, b) => a.name.localeCompare(b.name));
          return { dayName, cl, noStop, rows };
        })
      : [];

  return (
    <main className="rt">
      <h1>Stops page</h1>
      <p className="muted">
        All stops of the next 7 days, with the clients at each stop and the trips they joined.
        Stops are not ordered.
      </p>
      {err && <p className="err">{err}</p>}

      {days.map((d) => (
        <section className="card" key={d.dayName}>
          <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>{d.dayName}</h3>

          {d.rows.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Stop name</th>
                  <th>Clients at stop</th>
                  <th>Trip name</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => {
                  const keys = Object.keys(r.tripsMap);
                  return (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.clients.join(", ")}</td>
                      <td>
                        {keys.length === 1
                          ? keys[0]
                          : keys.map((k) => (
                              <div key={k}>{k + ": " + r.tripsMap[k].join(", ")}</div>
                            ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="muted">
              {d.cl.length ? "These clients have no stop set." : "No clients scheduled."}
            </div>
          )}

          {d.noStop.length > 0 && d.rows.length > 0 && (
            <div className="muted" style={{ marginTop: 8 }}>
              No stop set: {d.noStop.join(", ")}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}