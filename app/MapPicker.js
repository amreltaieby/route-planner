"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MapPicker({ initial, onConfirm, onClose }) {
  const box = useRef(null);
  const st = useRef({});
  const [pin, setPin] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (dead || !box.current) return;
      const map = L.map(box.current).setView([30.0444, 31.2357], 11);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      let marker = null;
      const place = (ll) => {
        if (marker) marker.setLatLng(ll);
        else
          marker = L.circleMarker(ll, {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 1,
          }).addTo(map);
      };
      const p = (initial || "").split(",").map((s) => Number(s.trim()));
      if (p.length === 2 && p.every(Number.isFinite) && String(initial).trim() !== "") {
        place(L.latLng(p[0], p[1]));
        map.setView([p[0], p[1]], 16);
        setPin(p[0].toFixed(6) + "," + p[1].toFixed(6));
      }
      map.on("click", (e) => {
        place(e.latlng);
        setPin(e.latlng.lat.toFixed(6) + "," + e.latlng.lng.toFixed(6));
      });
      st.current = { map };
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => {
      dead = true;
      if (st.current.map) st.current.map.remove();
      st.current = {};
    };
  }, []);

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h3>Choose on map</h3>
        <p className="muted" style={{ margin: "8px 0 10px" }}>
          Tap the map to drop a pin, then press Confirm.
        </p>
        <div
          ref={box}
          style={{
            height: 340,
            borderRadius: 8,
            border: "1px solid var(--border)",
            position: "relative",
            zIndex: 0,
            isolation: "isolate",
          }}
        />
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