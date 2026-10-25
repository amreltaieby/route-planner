"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_STOP_MIN = 3;
const typeOf = (t) => (t.data && t.data.type === "return" ? "return" : "arrival");
const timeWord = (ty) => (ty === "return" ? "Leave time" : "Arrival time");
const nameFor = (ty, s, e) =>
  ty === "return" ? (s ? s + " | Return" : "") : e ? e + " | Arrival" : "";
const mk = (arr) =>
  arr.map((l) => (
    <option key={l.id} value={l.id}>
      {l.name}
    </option>
  ));

export default function Trips() {
  const [locs, setLocs] = useState([]);
  const [dests, setDests] = useState([]);
  const [trips, setTrips] = useState([]);
  const [type, setType] = useState("");
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [day, setDay] = useState("");
  const [arrival, setArrival] = useState("");
  const [stopMin, setStopMin] = useState(String(DEFAULT_STOP_MIN));
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState({ startId: "", endId: "", arrival: "" });
  const [listErr, setListErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [menu, setMenu] = useState(null);
  const [askDel, setAskDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAll() {
    const [l, d, t] = await Promise.all([
      supabase.from("locations").select("id,name,coords").order("name"),
      supabase.from("destinations").select("id,name,coords").order("name"),
      supabase.from("trips").select("id,name,data"),
    ]);
    setLocs(l.data || []);
    setDests(d.data || []);
    setTrips((t.data || []).filter((x) => x.data && x.data.day));
  }

  useEffect(() => {
    loadAll();
  }, []);

  const locOpts = mk(locs);
  const destOpts = mk(dests);
  const startOptsFor = (ty) => (ty === "return" ? destOpts : locOpts);
  const endOptsFor = (ty) => (ty === "return" ? locOpts : destOpts);
  const startListFor = (ty) => (ty === "return" ? dests : locs);
  const endListFor = (ty) => (ty === "return" ? locs : dests);

  const sorted = [...trips].sort(
    (a, b) =>
      DAYS.indexOf(a.data.day) - DAYS.indexOf(b.data.day) ||
      (a.data.arrival || "99:99").localeCompare(b.data.arrival || "99:99") ||
      a.name.localeCompare(b.name)
  );

  function pickType(v) {
    setType(type === v ? "" : v);
    setStartId("");
    setEndId("");
  }

  function beginEdit(t) {
    const ty = typeOf(t);
    const find = (arr, x) => {
      const l = arr.find((q) => q.name === (x && x.name));
      return l ? l.id : "";
    };
    setListErr("");
    setMenu(null);
    setEditId(t.id);
    setEd({
      startId: find(startListFor(ty), t.data.start),
      endId: find(endListFor(ty), t.data.end),
      arrival: t.data.arrival || "",
    });
  }

  async function saveEdit(t) {
    setListErr("");
    const ty = typeOf(t);
    if (!ed.arrival) return setListErr(timeWord(ty) + " is required.");
    const s = startListFor(ty).find((l) => l.id === ed.startId);
    const e = endListFor(ty).find((l) => l.id === ed.endId);
    const data = { ...t.data, arrival: ed.arrival };
    if (s) data.start = { name: s.name, loc: s.coords };
    if (e) data.end = { name: e.name, loc: e.coords };
    const name =
      nameFor(ty, data.start && data.start.name, data.end && data.end.name) || t.name;
    setEditSaving(true);
    const res = await supabase.from("trips").update({ data, name }).eq("id", t.id).select();
    setEditSaving(false);
    if (res.error) return setListErr(res.error.message);
    if (!res.data || !res.data.length)
      return setListErr("Update was blocked. Check the Supabase policies.");
    setTrips((ts) => ts.map((x) => (x.id === t.id ? { ...x, data, name } : x)));
    setEditId(null);
  }

  async function doDelete() {
    const t = askDel;
    setListErr("");
    setDeleting(true);
    const res = await supabase.rpc("operator_delete_trip", { p_trip_id: String(t.id) });
    setDeleting(false);
    setAskDel(null);
    if (res.error) return setListErr(res.error.message);
    setTrips((ts) => ts.filter((x) => x.id !== t.id));
  }

  async function save() {
    setErr("");
    setMsg("");
    if (!type) {
      setErr("Choose arrival trip or return trip.");
      return;
    }
    const s = startListFor(type).find((l) => l.id === startId);
    const e = endListFor(type).find((l) => l.id === endId);
    if (!s) {
      setErr("Select the start location.");
      return;
    }
    if (!e) {
      setErr("Select the end location.");
      return;
    }
    if (!day) {
      setErr("Select a day.");
      return;
    }
    if (!arrival) {
      setErr("Enter the " + timeWord(type).toLowerCase() + ".");
      return;
    }
    const sm = Number(stopMin) || 0;
    if (sm < 0) {
      setErr("Time per stop cannot be negative.");
      return;
    }
    const data = {
      type,
      start: { name: s.name, loc: s.coords },
      end: { name: e.name, loc: e.coords },
      day,
      arrival,
      stopMin: sm,
    };
    setSaving(true);
    const { error } = await supabase
      .from("trips")
      .insert({ name: nameFor(type, s.name, e.name), time_min: null, distance_km: null, data });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setType("");
    setStartId("");
    setEndId("");
    setDay("");
    setArrival("");
    setStopMin(String(DEFAULT_STOP_MIN));
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
              <div style={{ display: "flex", gap: 24 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={type === "arrival"}
                    onChange={() => pickType("arrival")}
                  />
                  Arrival trip
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={type === "return"}
                    onChange={() => pickType("return")}
                  />
                  Return trip
                </label>
              </div>

              {type && (
                <>
                  <label>Start</label>
                  <select className="in" value={startId} onChange={(e) => setStartId(e.target.value)}>
                    <option value="">Select start</option>
                    {startOptsFor(type)}
                  </select>

                  <label>End</label>
                  <select className="in" value={endId} onChange={(e) => setEndId(e.target.value)}>
                    <option value="">Select end</option>
                    {endOptsFor(type)}
                  </select>
                </>
              )}

              <label>Day</label>
              <select className="in" value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">Select day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <label>{timeWord(type)}</label>
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
            <th>Type</th>
            <th>Trip</th>
            <th>Start location</th>
            <th>End location</th>
            <th>Arrival / Leave time</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const editing = editId === t.id;
            const ty = typeOf(t);
            return (
              <tr key={t.id}>
                <td>{t.data.day}</td>
                <td>{ty === "return" ? "Return" : "Arrival"}</td>
                <td>
                  <Link className="maps" href={"/trips/" + t.id}>
                    {t.name}
                  </Link>
                </td>
                <td>
                  {editing ? (
                    <select
                      className="in"
                      value={ed.startId}
                      onChange={(e) => setEd({ ...ed, startId: e.target.value })}
                    >
                      <option value="">{(t.data.start && t.data.start.name) || "Select start"}</option>
                      {startOptsFor(ty)}
                    </select>
                  ) : (
                    (t.data.start && t.data.start.name) || "-"
                  )}
                </td>
                <td>
                  {editing ? (
                    <select
                      className="in"
                      value={ed.endId}
                      onChange={(e) => setEd({ ...ed, endId: e.target.value })}
                    >
                      <option value="">{(t.data.end && t.data.end.name) || "Select end"}</option>
                      {endOptsFor(ty)}
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
                  {editing ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <button
                        className="ghost"
                        title="Trip options"
                        aria-label="Trip options"
                        onClick={() => setMenu(menu === t.id ? null : t.id)}
                      >
                        {"\u22EE"}
                      </button>
                      {menu === t.id && (
                        <>
                          <div
                            style={{ position: "fixed", inset: 0, zIndex: 4 }}
                            onClick={() => setMenu(null)}
                          />
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              zIndex: 5,
                              minWidth: 130,
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              className="mi"
                              style={{ cursor: "pointer", padding: "10px 14px" }}
                              onClick={() => beginEdit(t)}
                            >
                              Edit
                            </div>
                            <div
                              className="mi"
                              style={{ cursor: "pointer", padding: "10px 14px", color: "var(--err)" }}
                              onClick={() => {
                                setMenu(null);
                                setAskDel(t);
                              }}
                            >
                              Delete
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="empty">No trips yet.</div>}
      {listErr && <p className="err">{listErr}</p>}

      {askDel && (
        <div className="ov" onClick={() => !deleting && setAskDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {"Delete \"" +
                askDel.name +
                "\" on " +
                askDel.data.day +
                "? Clients who joined it will be removed from it. This cannot be undone."}
            </p>
            <div className="mbtns">
              <button className="btn" onClick={doDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button className="ghost" onClick={() => setAskDel(null)} disabled={deleting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}