"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

export default function Locations() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [coords, setCoords] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    else setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setErr("");
    if (!name.trim() || !coords.trim()) {
      setErr("Fill both fields.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("locations")
      .insert({ name: name.trim(), coords: coords.trim() });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setName("");
    setCoords("");
    load();
  }

  return (
    <main className="rt">
      <h1>Locations</h1>

      <div className="sec">Current saved locations</div>
      <table>
        <thead>
          <tr>
            <th>Location name</th>
            <th>Location coordinates</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.coords}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">No saved locations yet.</div>}

      <div className="sec">Add new location</div>
      <div className="row">
        <input
          className="in nm"
          placeholder="Location name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="in lc"
          placeholder="Location coordinates"
          value={coords}
          onChange={(e) => setCoords(e.target.value)}
        />
      </div>
      <button className="btn" style={{ marginTop: 8 }} onClick={save} disabled={busy}>
        {busy ? "Saving..." : "Save"}
      </button>
      {err && <p className="err">{err}</p>}
    </main>
  );
}