"use client";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "../db";
import CheckPick from "../CheckPick";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayItems = DAYS.map((d) => ({ id: d, label: d }));
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const arr = (x) => (Array.isArray(x) ? x : []);

export default function Clients() {
  const [rows, setRows] = useState([]);
  const [locs, setLocs] = useState([]);
  const [trips, setTrips] = useState([]);
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
      const t = await supabase.from("trips").select("id,name,data").order("name");
      setTrips((t.data || []).filter((x) => x.data && x.data.day));
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
  const tbd = (r) => {
    const v =
      edits[r.id] && "trips_by_day" in edits[r.id]
        ? edits[r.id].trips_by_day
        : r.trips_by_day;
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  };
  const tripItems = (d) =>
    trips.filter((t) => t.data.day === d).map((t) => ({ id: t.id, label: t.name }));
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div className="sec">Current clients</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
      </div>
      {err && <p className="err">{err}</p>}

      <table>
        <thead>
          <tr>
            <th>Person name</th>
            <th>Their stop</th>
            <th>Days</th>
            <th>Details</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sel = DAYS.filter((d) => toArr(val(r, "days")).includes(d));
            const tb = tbd(r);
            const hasTrips = sel.length > 0;
            const nb = hasTrips ? { borderBottom: "none" } : undefined;
            return (
              <Fragment key={r.id}>
                <tr style={nb}>
                  <td style={nb}>{r.name}</td>
                  <td style={nb}>
                    <select
                      className="in"
                      value={val(r, "stop")}
                      onChange={(e) => setField(r.id, "stop", e.target.value)}
                    >
                      <option value="">Select stop</option>
                      {locOpts}
                    </select>
                  </td>
                  <td style={nb}>
                    <CheckPick
                      label={sel.length ? sel.map((d) => d.slice(0, 3)).join(", ") : "Select days"}
                      items={dayItems}
                      selected={sel}
                      onChange={(v) => {
                        const nextDays = DAYS.filter((d) => v.includes(d));
                        setField(r.id, "days", nextDays.join(", "));
                        const kept = {};
                        nextDays.forEach((d) => {
                          if (arr(tb[d]).length) kept[d] = arr(tb[d]);
                        });
                        setField(r.id, "trips_by_day", kept);
                      }}
                    />
                  </td>
                  <td style={nb}>
                    <div className="muted">Phone: {r.phone || "-"}</div>
                    <div className="muted">Parent phone: {r.parent_phone || "-"}</div>
                    <div className="muted">Start: {r.start_request || "-"}</div>
                    <div className="muted">Drop off: {r.dropoff_request || "-"}</div>
                  </td>
                  <td style={nb}>{r.client_no ?? "-"}</td>
                </tr>
                {hasTrips && (
                  <tr>
                    <td colSpan={5} style={{ paddingTop: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          rowGap: 8,
                        }}
                      >
                        {sel.map((d, i) => {
                          const items = tripItems(d);
                          const chosen = arr(tb[d]);
                          const names = items
                            .filter((x) => chosen.includes(x.id))
                            .map((x) => x.label);
                          return (
                            <div
                              key={d}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginRight: 16,
                                paddingLeft: i ? 16 : 0,
                                borderLeft: i ? "1px solid #3a3a38" : "none",
                              }}
                            >
                              <span className="muted">{d}</span>
                              <CheckPick
                                label={names.length ? names.join(", ") : "Select trips"}
                                items={items}
                                selected={chosen}
                                onChange={(v) => {
                                  const next = { ...tb, [d]: v };
                                  if (!v.length) delete next[d];
                                  setField(r.id, "trips_by_day", next);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">No clients yet.</div>}
    </main>
  );
}