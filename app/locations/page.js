"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

export default function Locations() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [coords, setCoords] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState("");
  const [edits, setEdits] = useState({});
  const [checked, setChecked] = useState({});
  const [working, setWorking] = useState(false);

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

  function cancel() {
    setMode("");
    setEdits({});
    setChecked({});
    setErr("");
  }

  function startEdit() {
    setMenu(false);
    setErr("");
    setChecked({});
    setEdits(Object.fromEntries(rows.map((r) => [r.id, { name: r.name, coords: r.coords }])));
    setMode("edit");
  }

  function startDelete() {
    setMenu(false);
    setErr("");
    setEdits({});
    setChecked({});
    setMode("delete");
  }

  async function saveEdits() {
    setErr("");
    const changed = rows.filter((r) => {
      const e = edits[r.id];
      return e && (e.name.trim() !== r.name || e.coords.trim() !== r.coords);
    });
    if (!changed.length) return cancel();
    if (changed.some((r) => !edits[r.id].name.trim() || !edits[r.id].coords.trim()))
      return setErr("Names and coordinates cannot be empty.");
    setWorking(true);
    for (const r of changed) {
      const nm = edits[r.id].name.trim();
      const cd = edits[r.id].coords.trim();
      const u = await supabase
        .from("locations")
        .update({ name: nm, coords: cd })
        .eq("id", r.id)
        .select();
      if (u.error) {
        setWorking(false);
        return setErr(u.error.message);
      }
      if (!u.data || !u.data.length) {
        setWorking(false);
        return setErr("Update was blocked. Check the Supabase policies.");
      }
      if (nm !== r.name) {
        await supabase.from("clients").update({ stop: nm }).eq("stop", r.name);
        await supabase.from("clients").update({ end_loc: nm }).eq("end_loc", r.name);
      }
    }
    setWorking(false);
    cancel();
    load();
  }

  const picked = rows.filter((r) => checked[r.id]);

  async function deleteChecked() {
    if (!picked.length) return;
    if (
      !window.confirm(
        `Delete ${picked.length} location${picked.length > 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;
    setErr("");
    setWorking(true);
    const d = await supabase
      .from("locations")
      .delete()
      .in(
        "id",
        picked.map((r) => r.id)
      )
      .select();
    setWorking(false);
    if (d.error) return setErr(d.error.message);
    if (!d.data || !d.data.length) return setErr("Delete was blocked. Check the Supabase policies.");
    cancel();
    load();
  }

  const allOn = rows.length > 0 && picked.length === rows.length;

  return (
    <main className="rt">
      <h1>Locations</h1>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="sec">Current saved locations</div>
          <div style={{ position: "relative" }}>
            <button
              className="ghost"
              style={{ marginTop: 0, padding: "4px 10px" }}
              onClick={() => setMenu(!menu)}
              disabled={!!mode}
              aria-label="Location options"
            >
              {"\u22EE"}
            </button>
            {menu && (
              <>
                <div className="mo" onClick={() => setMenu(false)} />
                <div className="mlist" style={{ left: 0, right: "auto" }}>
                  <div className="mi" onClick={startEdit}>
                    Edit
                  </div>
                  <div className="mi" onClick={startDelete}>
                    Delete
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mode === "edit" && (
            <>
              <button className="btn" style={{ marginTop: 0 }} onClick={saveEdits} disabled={working}>
                {working ? "Saving..." : "Save"}
              </button>
              <button className="ghost" style={{ marginTop: 0 }} onClick={cancel}>
                Cancel
              </button>
            </>
          )}
          {mode === "delete" && (
            <>
              <button
                className="btn danger"
                style={{ marginTop: 0 }}
                onClick={deleteChecked}
                disabled={working || picked.length === 0}
              >
                {working ? "Deleting..." : `Delete${picked.length ? ` (${picked.length})` : ""}`}
              </button>
              <button className="ghost" style={{ marginTop: 0 }} onClick={cancel}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            {mode === "delete" && (
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked ? Object.fromEntries(rows.map((r) => [r.id, true])) : {}
                    )
                  }
                />
              </th>
            )}
            <th>Location name</th>
            <th>Location coordinates</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {mode === "delete" && (
                <td>
                  <input
                    type="checkbox"
                    checked={!!checked[r.id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [r.id]: e.target.checked }))}
                  />
                </td>
              )}
              <td>
                {mode === "edit" && edits[r.id] ? (
                  <input
                    className="in"
                    value={edits[r.id].name}
                    onChange={(e) =>
                      setEdits((x) => ({ ...x, [r.id]: { ...x[r.id], name: e.target.value } }))
                    }
                  />
                ) : (
                  r.name
                )}
              </td>
              <td>
                {mode === "edit" && edits[r.id] ? (
                  <input
                    className="in"
                    value={edits[r.id].coords}
                    onChange={(e) =>
                      setEdits((x) => ({ ...x, [r.id]: { ...x[r.id], coords: e.target.value } }))
                    }
                  />
                ) : (
                  r.coords
                )}
              </td>
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