"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

export default function Requests() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,phone,parent_phone,stop,destination,created_at")
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
              <td>{r.stop || "-"}</td>
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