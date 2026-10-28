"use client";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "../db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COORDS = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const arr = (x) => (Array.isArray(x) ? x : []);
const digits = (s) => (s || "").replace(/\D/g, "").length;

export default function Clients() {
  const [rows, setRows] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [reqLoaded, setReqLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [locs, setLocs] = useState([]);
  const [dests, setDests] = useState([]);
  const [users, setUsers] = useState({});
  const [err, setErr] = useState("");
  const [reqErr, setReqErr] = useState("");
  const [menu, setMenu] = useState(null);
  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [askDel, setAskDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadClients() {
    const [c, u] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: true }),
      supabase.rpc("operator_client_usernames"),
    ]);
    if (c.error) setErr(c.error.message);
    else setRows(c.data || []);
    const m = {};
    (u.data || []).forEach((x) => {
      m[x.client_id] = x.username;
    });
    setUsers(m);
  }

  async function loadReqs() {
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,phone,parent_phone,stop,stop_coords,destination,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) setReqErr(error.message);
    setReqs(data || []);
    setReqLoaded(true);
  }

  useEffect(() => {
    async function init() {
      const [t, l, d] = await Promise.all([
        supabase.from("trips").select("id,name,data"),
        supabase.from("locations").select("name").order("name"),
        supabase.from("destinations").select("name").order("name"),
      ]);
      setTrips((t.data || []).filter((x) => x.data && x.data.day));
      setLocs((l.data || []).map((x) => x.name));
      setDests((d.data || []).map((x) => x.name));
      await Promise.all([loadClients(), loadReqs()]);
    }
    init();
  }, []);

  const tripName = (id) => {
    const t = trips.find((x) => x.id === id);
    return t ? t.name : null;
  };

  async function decide(r, status) {
    if (status === "rejected" && !window.confirm(`Reject ${r.name}'s request?`)) return;
    setReqErr("");
    setBusyId(r.id);
    const u = await supabase.from("clients").update({ status }).eq("id", r.id).select();
    setBusyId(null);
    if (u.error) return setReqErr(u.error.message);
    if (!u.data || !u.data.length)
      return setReqErr("Update was blocked. Check the Supabase policies.");
    setReqs((rs) => rs.filter((x) => x.id !== r.id));
    if (status === "approved") {
      const l = await supabase.from("locations").select("name").order("name");
      setLocs((l.data || []).map((x) => x.name));
      await loadClients();
    }
  }

  function stopCell(r) {
    if (!r.stop) return "-";
    const c = (r.stop_coords || "").trim();
    if (c && COORDS.test(c)) {
      return (
        <a
          className="maps"
          href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {r.stop}
        </a>
      );
    }
    return r.stop;
  }

  function beginEdit(r) {
    const parts = (r.name || "").split(" ");
    setEditErr("");
    setMenu(null);
    setEditId(r.id);
    setEd({
      first: r.first_name || (r.last_name ? "" : parts[0] || ""),
      last: r.last_name || (r.first_name ? "" : parts.slice(1).join(" ")),
      phone: r.phone || "",
      parent: r.parent_phone || "",
      stop: r.stop || "",
      destination: r.destination || "",
      days: DAYS.filter((d) => toArr(r.days).includes(d)),
    });
  }

  async function saveEdit(r) {
    setEditErr("");
    if (!ed.first.trim() || !ed.last.trim()) return setEditErr("First and last name are required.");
    if (digits(ed.phone) < 7) return setEditErr("Enter a valid phone number.");
    if (ed.parent.trim() && digits(ed.parent) < 7)
      return setEditErr("Enter a valid parent phone number or leave it empty.");
    const ch = {};
    if (ed.first.trim() !== (r.first_name || "")) ch.first_name = ed.first.trim();
    if (ed.last.trim() !== (r.last_name || "")) ch.last_name = ed.last.trim();
    if (ed.phone.trim() !== (r.phone || "")) ch.phone = ed.phone.trim();
    if (ed.parent.trim() !== (r.parent_phone || "")) ch.parent_phone = ed.parent.trim();
    if (ed.stop !== (r.stop || "")) ch.stop = ed.stop;
    if (ed.destination !== (r.destination || "")) ch.destination = ed.destination;
    const nd = DAYS.filter((d) => ed.days.includes(d)).join(", ");
    const od = DAYS.filter((d) => toArr(r.days).includes(d)).join(", ");
    if (nd !== od) ch.days = nd;
    if (Object.keys(ch).length === 0) {
      setEditId(null);
      return;
    }
    setSaving(true);
    const res = await supabase.rpc("operator_propose_client_edit", {
      p_client_id: String(r.id),
      p_changes: ch,
    });
    setSaving(false);
    if (res.error) return setEditErr(res.error.message);
    setRows((rs) =>
      rs.map((x) =>
        x.id === r.id ? { ...x, pending_edit: { changes: ch }, edit_result: null } : x
      )
    );
    setEditId(null);
  }

  async function doDelete() {
    const r = askDel;
    setDeleting(true);
    const res = await supabase.rpc("operator_delete_client", { p_client_id: String(r.id) });
    setDeleting(false);
    setAskDel(null);
    if (res.error) return setErr(res.error.message);
    setRows((rs) => rs.filter((x) => x.id !== r.id));
  }

  const optsFor = (list, cur) => {
    const l = cur && !list.includes(cur) ? [cur, ...list] : list;
    return l.map((n) => (
      <option key={n} value={n}>
        {n}
      </option>
    ));
  };

  return (
    <main className="rt wide">
      <h1>Clients</h1>
      <p className="muted">
        Edits you make here are not saved right away. The client sees them when they next log in
        and they are applied only if the client agrees.
      </p>
      {err && <p className="err">{err}</p>}

      <table>
        <thead>
          <tr>
            <th>Person name</th>
            <th>Username</th>
            <th>Their stop</th>
            <th>Their destination</th>
            <th>Days</th>
            <th>Details</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const editing = editId === r.id;
            const sel = DAYS.filter((d) => toArr(r.days).includes(d));
            const tb =
              r.trips_by_day && typeof r.trips_by_day === "object" && !Array.isArray(r.trips_by_day)
                ? r.trips_by_day
                : {};
            const enr = sel
              .map((d) => ({
                d,
                names: arr(tb[d]).map(tripName).filter(Boolean),
              }))
              .filter((x) => x.names.length);
            const hasTrips = enr.length > 0 && !editing;
            const nb = hasTrips ? { borderBottom: "none" } : undefined;
            return (
              <Fragment key={r.id}>
                <tr style={nb}>
                  <td style={nb}>
                    {editing ? (
                      <>
                        <input
                          className="in"
                          placeholder="First name"
                          value={ed.first}
                          onChange={(e) => setEd({ ...ed, first: e.target.value })}
                        />
                        <input
                          className="in"
                          style={{ marginTop: 6 }}
                          placeholder="Last name"
                          value={ed.last}
                          onChange={(e) => setEd({ ...ed, last: e.target.value })}
                        />
                      </>
                    ) : (
                      <>
                        <div>{r.name}</div>
                        {r.pending_edit && (
                          <div className="muted">Waiting for client approval</div>
                        )}
                        {!r.pending_edit && r.edit_result === "approved" && (
                          <div className="muted">Client approved the last edit</div>
                        )}
                        {!r.pending_edit && r.edit_result === "declined" && (
                          <div className="muted">Client declined the last edit</div>
                        )}
                      </>
                    )}
                  </td>
                  <td style={nb}>{users[String(r.id)] || "-"}</td>
                  <td style={nb}>
                    {editing ? (
                      <select
                        className="in"
                        value={ed.stop}
                        onChange={(e) => setEd({ ...ed, stop: e.target.value })}
                      >
                        <option value="">No stop</option>
                        {optsFor(locs, ed.stop)}
                      </select>
                    ) : (
                      r.stop || "-"
                    )}
                  </td>
                  <td style={nb}>
                    {editing ? (
                      <select
                        className="in"
                        value={ed.destination}
                        onChange={(e) => setEd({ ...ed, destination: e.target.value })}
                      >
                        <option value="">No destination</option>
                        {optsFor(dests, ed.destination)}
                      </select>
                    ) : (
                      r.destination || "-"
                    )}
                  </td>
                  <td style={nb}>
                    {editing ? (
                      <div>
                        {DAYS.map((d) => (
                          <label
                            key={d}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              margin: "2px 0",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={ed.days.includes(d)}
                              onChange={() =>
                                setEd({
                                  ...ed,
                                  days: ed.days.includes(d)
                                    ? ed.days.filter((x) => x !== d)
                                    : [...ed.days, d],
                                })
                              }
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                    ) : sel.length ? (
                      sel.join(", ")
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={nb}>
                    {editing ? (
                      <>
                        <input
                          className="in"
                          type="tel"
                          placeholder="Phone"
                          value={ed.phone}
                          onChange={(e) => setEd({ ...ed, phone: e.target.value })}
                        />
                        <input
                          className="in"
                          style={{ marginTop: 6 }}
                          type="tel"
                          placeholder="Parent phone"
                          value={ed.parent}
                          onChange={(e) => setEd({ ...ed, parent: e.target.value })}
                        />
                      </>
                    ) : (
                      <>
                        <div className="muted">Phone: {r.phone || "-"}</div>
                        <div className="muted">Parent phone: {r.parent_phone || "-"}</div>
                      </>
                    )}
                  </td>
                  <td style={nb}>{r.client_no ?? "-"}</td>
                  <td style={nb}>
                    {editing ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          className="btn"
                          style={{ marginTop: 0 }}
                          onClick={() => saveEdit(r)}
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="ghost"
                          onClick={() => {
                            setEditId(null);
                            setEditErr("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: "relative" }}>
                        <button
                          className="ghost"
                          title="Client options"
                          aria-label="Client options"
                          onClick={() => setMenu(menu === r.id ? null : r.id)}
                        >
                          {"\u22EE"}
                        </button>
                        {menu === r.id && (
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
                                minWidth: 150,
                                background: "var(--panel)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                className="mi"
                                style={{ cursor: "pointer", padding: "10px 14px" }}
                                onClick={() => beginEdit(r)}
                              >
                                Edit entries
                              </div>
                              <div
                                className="mi"
                                style={{
                                  cursor: "pointer",
                                  padding: "10px 14px",
                                  color: "var(--err)",
                                }}
                                onClick={() => {
                                  setMenu(null);
                                  setAskDel(r);
                                }}
                              >
                                Delete client
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {editing && editErr && (
                  <tr>
                    <td colSpan={8}>
                      <p className="err" style={{ margin: 0 }}>
                        {editErr}
                      </p>
                    </td>
                  </tr>
                )}
                {hasTrips && (
                  <tr>
                    <td colSpan={8} style={{ paddingTop: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          rowGap: 6,
                        }}
                      >
                        {enr.map((x, i) => (
                          <div
                            key={x.d}
                            className="muted"
                            style={{
                              marginRight: 16,
                              paddingLeft: i ? 16 : 0,
                              borderLeft: i ? "1px solid var(--border)" : "none",
                            }}
                          >
                            {x.d}: {x.names.join(", ")}
                          </div>
                        ))}
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

      <div className="sec" style={{ marginTop: 44 }}>
        Client requests
      </div>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Clients who signed up with your company code and are waiting for approval.
      </p>
      {reqErr && <p className="err">{reqErr}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Parent phone</th>
            <th>Stop</th>
            <th>Destination</th>
            <th>Requested</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.phone || "-"}</td>
              <td>{r.parent_phone || "-"}</td>
              <td>{stopCell(r)}</td>
              <td>{r.destination || "-"}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn"
                    style={{ marginTop: 0 }}
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="ghost"
                    style={{ marginTop: 0 }}
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reqLoaded && reqs.length === 0 && <div className="empty">No pending requests.</div>}

      {askDel && (
        <div className="ov" onClick={() => !deleting && setAskDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {"Delete " +
                askDel.name +
                (users[String(askDel.id)] ? " (" + users[String(askDel.id)] + ")" : "") +
                "? Their account and bookings will be removed. This cannot be undone."}
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