"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

export default function ClientLists() {
  const [locs, setLocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [pend, setPend] = useState({});
  const [openDay, setOpenDay] = useState(null);
  const [routes, setRoutes] = useState({});
  const [today, setToday] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const cache = useRef({});

  async function loadClients() {
    const c = await supabase
      .from("clients")
      .select("id,name,stop,days,end_loc,trips_by_day");
    if (c.error) setErr(c.error.message);
    setClients(c.data || []);
  }

  useEffect(() => {
    async function init() {
      const l = await supabase.from("locations").select("id,name,coords");
      setLocs(l.data || []);
      await loadClients();
      setToday(new Date());
      setLoaded(true);
    }
    init();
  }, []);

  const locOf = (n) => locs.find((l) => l.name === n);

  const eff = clients.map((c) => ({
    ...c,
    days: pend[c.id] !== undefined ? pend[c.id] : c.days,
  }));
  const sortedClients = [...eff].sort((a, b) => a.name.localeCompare(b.name));

  const days =
    loaded && today
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
          const cl = eff.filter((c) => c.stop && toArr(c.days).includes(dayName));
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
          return { dayName, cl, endName, groups, eLoc, mids, sig };
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

  function toggle(c, dayName) {
    setMsg("");
    const cur = toArr(c.days);
    const next = cur.includes(dayName)
      ? cur.filter((x) => x !== dayName)
      : [...cur, dayName];
    const str = DAYS.filter((x) => next.includes(x)).join(", ");
    setPend((p) => ({ ...p, [c.id]: str }));
  }

  async function save() {
    setErr("");
    setMsg("");
    const ids = Object.keys(pend);
    if (!ids.length) return;
    setSaving(true);
    const results = await Promise.all(
      ids.map((id) => {
        const c = clients.find((x) => String(x.id) === id);
        const keep = toArr(pend[id]);
        const v =
          c && c.trips_by_day && typeof c.trips_by_day === "object" && !Array.isArray(c.trips_by_day)
            ? c.trips_by_day
            : {};
        const tb = {};
        Object.keys(v).forEach((k) => {
          if (keep.includes(k)) tb[k] = v[k];
        });
        return supabase
          .from("clients")
          .update({ days: pend[id] || null, trips_by_day: tb })
          .eq("id", id);
      })
    );
    setSaving(false);
    const bad = results.find((r) => r.error);
    if (bad) {
      setErr(bad.error.message);
      return;
    }
    await loadClients();
    setPend({});
    setMsg("Changes saved.");
  }

  function rowsFor(d, midOrder) {
    const names = [...midOrder];
    if (d.groups[d.endName]) names.push(d.endName);
    return names.map((n) => ({ name: n, clients: d.groups[n] }));
  }

  const pending = Object.keys(pend).length;

  return (
    <main className="rt">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h1>Client lists</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {msg && <span className="muted">{msg}</span>}
          <button
            className="btn"
            style={{ marginTop: 0 }}
            onClick={save}
            disabled={saving || pending === 0}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}

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

        return (
          <section className="card" key={d.dayName}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>{d.dayName}</h3>
              <div style={{ position: "relative" }}>
                <button
                  className="ghost"
                  style={{ marginTop: 0 }}
                  onClick={() => setOpenDay(openDay === d.dayName ? null : d.dayName)}
                >
                  Edit
                </button>
                {openDay === d.dayName && (
                  <>
                    <div className="mo" onClick={() => setOpenDay(null)} />
                    <div className="mlist">
                      {sortedClients.length === 0 && (
                        <div className="mi muted">No clients</div>
                      )}
                      {sortedClients.map((c) => (
                        <label
                          key={c.id}
                          className="mi"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={toArr(c.days).includes(d.dayName)}
                            onChange={() => toggle(c, d.dayName)}
                          />
                          <span>{c.name}</span>
                          {!c.stop && <span className="muted">(no stop)</span>}
                        </label>
                      ))}
                    </div>
                  </>
                )}
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