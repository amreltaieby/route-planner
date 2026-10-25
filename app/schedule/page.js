"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export default function StopsPage() {
  const [clients, setClients] = useState([]);
  const [today, setToday] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function init() {
      const c = await supabase
        .from("clients")
        .select("id,name,stop,days")
        .eq("status", "approved");
      if (c.error) setErr(c.error.message);
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
            (stops[c.stop] = stops[c.stop] || []).push(c.name);
          });
          const rows = Object.keys(stops)
            .sort((a, b) => a.localeCompare(b))
            .map((n) => ({ name: n, clients: stops[n] }));
          return { dayName, cl, noStop, rows };
        })
      : [];

  return (
    <main className="rt">
      <h1>Stops page</h1>
      <p className="muted">
        All stops of the next 7 days with the clients at each stop. Stops are not ordered.
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
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.clients.join(", ")}</td>
                  </tr>
                ))}
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