"use client";
import { useState } from "react";

export default function CheckPick({ label, items, selected, onChange, disabled, cls }) {
  const [open, setOpen] = useState(false);
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className={"pk " + (cls || "")}>
      <button
        type="button"
        className="in cp"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="mo" onClick={() => setOpen(false)} />
          <div className="mlist">
            {items.length === 0 && <div className="mi muted">None available</div>}
            {items.map((it) => (
              <label key={it.id} className="ck">
                <input
                  type="checkbox"
                  checked={selected.includes(it.id)}
                  onChange={() => toggle(it.id)}
                />
                {it.label}
              </label>
            ))}
            <button type="button" className="btn dn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}