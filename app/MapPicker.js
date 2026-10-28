"use client";
import { useState } from "react";
import MapBox from "./MapBox";

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function startPin(initial) {
  const p = (initial || "").split(",").map((s) => Number(s.trim()));
  if (p.length === 2 && p.every(Number.isFinite) && String(initial).trim() !== "")
    return p[0].toFixed(6) + "," + p[1].toFixed(6);
  return "";
}

export default function MapPicker({ initial, onConfirm, onClose }) {
  const [pin, setPin] = useState(() => startPin(initial));

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h3>Choose on map</h3>
        <p className="muted" style={{ margin: "8px 0 10px" }}>
          Tap the map to drop a pin, then press Confirm.
        </p>
        <MapBox initial={initial} value={pin} onPick={setPin} height={340} />
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {pin ? "Pin: " + pin : "No pin placed yet."}
        </p>
        <div className="mbtns">
          <button className="btn" disabled={!pin} onClick={() => onConfirm(pin)}>
            Confirm
          </button>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}