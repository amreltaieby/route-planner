"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

const COORDS = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

export default function Requests() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,phone,parent_phone,stop,stop_coords,destination,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    setRows(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(r, status) {
    if (status === "rejected" && !window.confirm(`Reject ${r.name}'s request?`)) return;
    setErr("");
    setBusyId(r.id);
    const u = await supabase.from("clients").update({ status }).eq("id", r.id).select();
    setBusyId(null);
    if (u.error) return setErr(u.error.message);
    if (!u.data || !u.data.length)
      return setErr("Update was blocked. Check the Supabase policies.");
    setRows((rs) => rs.filter((x) => x.id !== r.id));
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

  return (
    <main className="rt wide">
      <h1>Client requests</h1>
      <p className="muted">Clients who signed up with your company code and are waiting for approval.</p>
      {err && <p className="err">{err}</p>}

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
          {rows.map((r) => (
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
      {loaded && rows.length === 0 && <div className="empty">No pending requests.</div>}
    </main>
  );
}