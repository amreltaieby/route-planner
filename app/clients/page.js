"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";
import CheckPick from "../CheckPick";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayItems = DAYS.map((d) => ({ id: d, label: d }));
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export default function Clients() {
  const [rows, setRows] = useState([]);
  const [locs, setLocs] = useState([]);
  const [edits, setEdits] = useState({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    else setRows(data);
  }

  useEffect(() => {
    async function init() {
      const l = await supabase.from("locations").select("id,name").order("name");
      setLocs(l.data || []);
      load();
    }
    init();
  }, []);

  const val = (r, f) =>
    (edits[r.id] && f in edits[r.id] ? edits[r.id][f] : r[f]) || "";
  const setField = (id, f, v) => {
    setMsg("");
    setEdits((e) => ({ ...e, [id]: { ...e[id], [f]: v } }));
  };
  const pending = Object.keys(edits).length;

  async function save() {
    setErr("");
    setMsg("");
    const ids = Object.keys(edits);
    if (!ids.length) return;
    const clean = (o) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v || null]));
    setSaving(true);
    const results = await Promise.all(
      ids.map((id) => supabase.from("clients").update(clean(edits[id])).eq("id", id))
    );
    setSaving(false);
    const bad = results.find((r) => r.error);
    if (bad) {
      setErr(bad.error.message);
      return;
    }
    setRows((rs) => rs.map((r) => (edits[r.id] ? { ...r, ...clean(edits[r.id]) } : r)));
    setEdits({});
    setMsg("Changes saved.");
  }

  const locOpts = locs.map((l) => (
    <option key={l.id} value={l.name}>
      {l.name}
    </option>
  ));

  return (
    <main className="rt wide">
      <h1>Clients</h1>

      <div className="sec">Current clients</div>
      <table>
        <thead>
          <tr>
            <th>Person name</th>
            <th>Their stop</th>
            <th>Days</th>
            <th>Details</th>
            <th>End location</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sel = DAYS.filter((d) => toArr(val(r, "days")).includes(d));
            return (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  <select
                    className="in"
                    value={val(r, "stop")}
                    onChange={(e) => setField(r.id, "stop", e.target.value)}
                  >
                    <option value="">Select stop</option>
                    {locOpts}
                  </select>
                </td>
                <td>
                  <CheckPick
                    label={sel.length ? sel.map((d) => d.slice(0, 3)).join(", ") : "Select days"}
                    items={dayItems}
                    selected={sel}
                    onChange={(v) =>
                      setField(r.id, "days", DAYS.filter((d) => v.includes(d)).join(", "))
                    }
                  />
                </td>
                <td>
                  <div className="muted">Phone: {r.phone || "-"}</div>
                  <div className="muted">Parent phone: {r.parent_phone || "-"}</div>
                  <div className="muted">Start: {r.start_request || "-"}</div>
                  <div className="muted">Drop off: {r.dropoff_request || "-"}</div>
                </td>
                <td>
                  <select
                    className="in"
                    value={val(r, "end_loc")}
                    onChange={(e) => setField(r.id, "end_loc", e.target.value)}
                  >
                    <option value="">Assign end location</option>
                    {locOpts}
                  </select>
                </td>
                <td>{r.client_no ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">No clients yet.</div>}

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
        <button
          className="btn"
          style={{ marginTop: 0 }}
          onClick={save}
          disabled={saving || pending === 0}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </main>
  );
}