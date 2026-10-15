"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CopyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function Trips() {
  const [locs, setLocs] = useState([]);
  const [trips, setTrips] = useState([]);
  const [clients, setClients] = useState([]);
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [day, setDay] = useState("");
  const [arrival, setArrival] = useState("");
  const [stopMin, setStopMin] = useState("5");
  const [tripName, setTripName] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState({ startId: "", endId: "", arrival: "" });
  const [listErr, setListErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function loadAll() {
    const l = await supabase.from("locations").select("id,name,coords").order("name");
    setLocs(l.data || []);
    const t = await supabase.from("trips").select("id,name,data");
    setTrips((t.data || []).filter((x) => x.data && x.data.day));
    const c = await supabase.from("clients").select("id,name,stop,trips_by_day");
    setClients(c.data || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const opts = locs.map((l) => (
    <option key={l.id} value={l.id}>
      {l.name}
    </option>
  ));

  const sorted = [...trips].sort(
    (a, b) =>
      DAYS.indexOf(a.data.day) - DAYS.indexOf(b.data.day) ||
      (a.data.arrival || "99:99").localeCompare(b.data.arrival || "99:99") ||
      a.name.localeCompare(b.name)
  );

  function enrolled(t) {
    return clients.filter((c) => {
      const v = c.trips_by_day;
      const ids =
        v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v[t.data.day])
          ? v[t.data.day]
          : [];
      return ids.includes(t.id);
    });
  }

  function stopsOf(t) {
    const out = [];
    enrolled(t).forEach((c) => {
      if (c.stop && !out.includes(c.stop)) out.push(c.stop);
    });
    return out;
  }

  function copy(t) {
    const stops = [];
    stopsOf(t).forEach((n) => {
      const l = locs.find((x) => x.name === n);
      if (l) stops.push({ name: l.name, loc: l.coords });
    });
    localStorage.setItem(
      "abs_prefill",
      JSON.stringify({
        start: t.data.start,
        end: t.data.end,
        stops,
        arrival: t.data.arrival || "",
        stopMin: t.data.stopMin ?? 5,
      })
    );
    window.location.href = "/?prefill=1";
  }

  function beginEdit(t) {
    const byName = (x) => {
      const l = locs.find((q) => q.name === (x && x.name));
      return l ? l.id : "";
    };
    setListErr("");
    setEditId(t.id);
    setEd({
      startId: byName(t.data.start),
      endId: byName(t.data.end),
      arrival: t.data.arrival || "",
    });
  }

  async function saveEdit(t) {
    setListErr("");
    const s = locs.find((l) => l.id === ed.startId);
    const e = locs.find((l) => l.id === ed.endId);
    const data = {
      ...t.data,
      start: s ? { name: s.name, loc: s.coords } : t.data.start,
      end: e ? { name: e.name, loc: e.coords } : t.data.end,
      arrival: ed.arrival,
    };
    setEditSaving(true);
    const res = await supabase.from("trips").update({ data }).eq("id", t.id).select();
    setEditSaving(false);
    if (res.error) return setListErr(res.error.message);
    if (!res.data || !res.data.length)
      return setListErr("Update was blocked. Run the Supabase update policy SQL first.");
    setTrips((ts) => ts.map((x) => (x.id === t.id ? { ...x, data } : x)));
    setEditId(null);
  }

  async function save() {
    setErr("");
    setMsg("");
    const s = locs.find((l) => l.id === startId);
    const e = locs.find((l) => l.id === endId);
    if (!s || !e || !day) {
      setErr("Fill start, end and day.");
      return;
    }
    if (!tripName.trim()) {
      setErr("Enter a trip name.");
      return;
    }
    const sm = Number(stopMin) || 0;
    if (sm < 0) {
      setErr("Time per stop cannot be negative.");
      return;
    }
    const data = {
      start: { name: s.name, loc: s.coords },
      end: { name: e.name, loc: e.coords },
      day,
      arrival,
      stopMin: sm,
    };
    setSaving(true);
    const { error } = await supabase
      .from("trips")
      .insert({ name: tripName.trim(), time_min: null, distance_km: null, data });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setStartId("");
    setEndId("");
    setDay("");
    setArrival("");
    setStopMin("5");
    setTripName("");
    setMsg("Trip saved.");
    loadAll();
  }

  return (
    <main className="rt wide">
      <h1>Trips</h1>

      <div className="sec">Create trip</div>
      <table>
        <thead>
          <tr>
            <th>Trip details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ verticalAlign: "top" }}>
              <label>Start</label>
              <select className="in" value={startId} onChange={(e) => setStartId(e.target.value)}>
                <option value="">Select start</option>
                {opts}
              </select>

              <label>End</label>
              <select className="in" value={endId} onChange={(e) => setEndId(e.target.value)}>
                <option value="">Select end</option>
                {opts}
              </select>

              <label>Day</label>
              <select className="in" value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">Select day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <label>Arrival time (optional)</label>
              <input
                className="in"
                type="time"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              />

              <label>Time per stop (min)</label>
              <input
                className="in"
                type="number"
                min="0"
                value={stopMin}
                onChange={(e) => {
                  const v = e.target.value;
                  setStopMin(Number(v) < 0 ? "0" : v);
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
        }}
      >
        {msg && <span className="muted">{msg}</span>}
        <input
          className="in"
          style={{ maxWidth: 260 }}
          placeholder="Trip name"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
        />
        <button className="btn" style={{ marginTop: 0 }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {err && <p className="err">{err}</p>}

      <div className="sec" style={{ marginTop: 36 }}>
        Trips
      </div>
      <table>
        <thead>
          <tr>
            <th>Trip day</th>
            <th>Trip name</th>
            <th>Start location</th>
            <th>Stops</th>
            <th>Clients</th>
            <th>End location</th>
            <th>Arrival time</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const st = stopsOf(t);
            const cl = enrolled(t);
            const editing = editId === t.id;
            return (
              <tr key={t.id}>
                <td>{t.data.day}</td>
                <td>{t.name}</td>
                <td>
                  {editing ? (
                    <select
                      className="in"
                      value={ed.startId}
                      onChange={(e) => setEd({ ...ed, startId: e.target.value })}
                    >
                      <option value="">{(t.data.start && t.data.start.name) || "Select start"}</option>
                      {opts}
                    </select>
                  ) : (
                    (t.data.start && t.data.start.name) || "-"
                  )}
                </td>
                <td>
                  {st.length === 0 ? "-" : st.map((n) => <div key={n}>{n}</div>)}
                </td>
                <td>
                  {cl.length === 0 ? "-" : cl.map((c) => <div key={c.id}>{c.name}</div>)}
                </td>
                <td>
                  {editing ? (
                    <select
                      className="in"
                      value={ed.endId}
                      onChange={(e) => setEd({ ...ed, endId: e.target.value })}
                    >
                      <option value="">{(t.data.end && t.data.end.name) || "Select end"}</option>
                      {opts}
                    </select>
                  ) : (
                    (t.data.end && t.data.end.name) || "-"
                  )}
                </td>
                <td>
                  {editing ? (
                    <input
                      className="in"
                      type="time"
                      value={ed.arrival}
                      onChange={(e) => setEd({ ...ed, arrival: e.target.value })}
                    />
                  ) : (
                    t.data.arrival || "-"
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {editing ? (
                      <>
                        <button
                          className="btn"
                          style={{ marginTop: 0 }}
                          onClick={() => saveEdit(t)}
                          disabled={editSaving}
                        >
                          {editSaving ? "Saving..." : "Save"}
                        </button>
                        <button className="ghost" onClick={() => setEditId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="ghost"
                          title="Copy to homepage"
                          aria-label="Copy to homepage"
                          onClick={() => copy(t)}
                        >
                          <CopyIcon />
                        </button>
                        <button
                          className="ghost"
                          title="Edit trip"
                          aria-label="Edit trip"
                          onClick={() => beginEdit(t)}
                        >
                          {"\u22EE"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="empty">No trips yet.</div>}
      {listErr && <p className="err">{listErr}</p>}
    </main>
  );
}