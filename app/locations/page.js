"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";
import MapPicker from "../MapPicker";

async function renameLocation(oldName, newName) {
  await supabase.from("clients").update({ stop: newName }).eq("stop", oldName);
  await supabase.from("clients").update({ end_loc: newName }).eq("end_loc", oldName);
}

async function renameDestination(oldName, newName) {
  await supabase.from("clients").update({ destination: newName }).eq("destination", oldName);
}

function Section({ table, word, renames }) {
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
  const [mapFor, setMapFor] = useState(null);
  const cap = word.charAt(0).toUpperCase() + word.slice(1);

  async function load() {
    const { data, error } = await supabase
      .from(table)
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
      .from(table)
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
        .from(table)
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
      if (nm !== r.name) await renames(r.name, nm);
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
        `Delete ${picked.length} ${word}${picked.length > 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;
    setErr("");
    setWorking(true);
    const d = await supabase
      .from(table)
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
    <section style={{ marginBottom: 44 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="sec">{`Current saved ${word}s`}</div>
          <div style={{ position: "relative" }}>
            <button
              className="ghost"
              style={{ marginTop: 0, padding: "4px 10px" }}
              onClick={() => setMenu(!menu)}
              disabled={!!mode}
              aria-label={`${cap} options`}
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
            <th>{`${cap} name`}</th>
            <th>{`${cap} coordinates`}</th>
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
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      className="in"
                      value={edits[r.id].coords}
                      onChange={(e) =>
                        setEdits((x) => ({ ...x, [r.id]: { ...x[r.id], coords: e.target.value } }))
                      }
                    />
                    <button
                      type="button"
                      className="ghost"
                      style={{ marginTop: 0, flex: "none" }}
                      title="Choose on map"
                      aria-label="Choose on map"
                      onClick={() => setMapFor(r.id)}
                    >
                      Map
                    </button>
                  </div>
                ) : (
                  r.coords
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">{`No saved ${word}s yet.`}</div>}

      <div className="sec">{`Add new ${word}`}</div>
      <div className="row">
        <input
          className="in nm"
          placeholder={`${cap} name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="in lc"
          placeholder={`${cap} coordinates`}
          value={coords}
          onChange={(e) => setCoords(e.target.value)}
        />
        <button
          type="button"
          className="ghost"
          style={{ marginTop: 0, flex: "none" }}
          onClick={() => setMapFor("add")}
        >
          Choose on map
        </button>
      </div>
      <button className="btn" style={{ marginTop: 8 }} onClick={save} disabled={busy}>
        {busy ? "Saving..." : "Save"}
      </button>
      {err && <p className="err">{err}</p>}

      {mapFor !== null && (
        <MapPicker
          initial={mapFor === "add" ? coords : (edits[mapFor] && edits[mapFor].coords) || ""}
          onConfirm={(c) => {
            if (mapFor === "add") setCoords(c);
            else setEdits((x) => ({ ...x, [mapFor]: { ...x[mapFor], coords: c } }));
            setMapFor(null);
          }}
          onClose={() => setMapFor(null)}
        />
      )}
    </section>
  );
}

export default function Locations() {
  return (
    <main className="rt">
      <h1>Locations</h1>
      <Section table="locations" word="location" renames={renameLocation} />
      <Section table="destinations" word="destination" renames={renameDestination} />
    </main>
  );
}