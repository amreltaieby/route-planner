"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { photon } from "./photon";

const CAIRO = [30.0444, 31.2357];
const STREET = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATLAB =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

export default function MapBox({ initial, value, onPick, height = 300 }) {
  const box = useRef(null);
  const st = useRef({});
  const pick = useRef(onPick);
  const init = useRef(initial);
  pick.current = onPick;
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (dead || !box.current) return;
      const map = L.map(box.current).setView(CAIRO, 11);
      const street = L.tileLayer(STREET, {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      });
      let errs = 0;
      let fell = false;
      street.on("tileerror", () => {
        errs += 1;
        if (errs >= 4 && !fell) {
          fell = true;
          street.setUrl(OSM);
        }
      });
      const sat = L.layerGroup([
        L.tileLayer(SAT, { maxZoom: 19, attribution: "Tiles &copy; Esri" }),
        L.tileLayer(SATLAB, { maxZoom: 19 }),
      ]);
      street.addTo(map);
      L.control.layers({ Map: street, Satellite: sat }, null, { position: "topright" }).addTo(map);
      st.current = { map, L, marker: null, view: null };
      const place = (ll) => {
        const s = st.current;
        if (s.marker) s.marker.setLatLng(ll);
        else
          s.marker = s.L.circleMarker(ll, {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 1,
          }).addTo(s.map);
      };
      if (init.current) {
        const p = String(init.current).split(",").map((x) => Number(x.trim()));
        if (p.length === 2 && p.every(Number.isFinite)) {
          place(L.latLng(p[0], p[1]));
          map.setView([p[0], p[1]], 16);
        }
      }
      map.on("click", (e) => {
        place(e.latlng);
        pick.current(e.latlng.lat.toFixed(6) + "," + e.latlng.lng.toFixed(6));
      });
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => {
      dead = true;
      if (st.current.map) st.current.map.remove();
      st.current = {};
    };
  }, []);

  useEffect(() => {
    const s = st.current;
    if (!value && s.marker) {
      s.marker.remove();
      s.marker = null;
    }
  }, [value]);

  async function search() {
    const s = q.trim();
    if (s.length < 2) return;
    setBusy(true);
    setMsg("");
    setRes(null);
    try {
      const l = await photon(s);
      setRes(l);
      if (!l.length) setMsg("No results.");
    } catch {
      setMsg("Search failed. Try again.");
    }
    setBusy(false);
  }

  function view(x) {
    const s = st.current;
    if (!s.map) return;
    const ll = [x.lat, x.lng];
    if (s.view) s.view.setLatLng(ll);
    else
      s.view = s.L.circleMarker(ll, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#f59e0b",
        fillOpacity: 1,
      }).addTo(s.map);
    s.view.unbindTooltip();
    s.view.bindTooltip(x.label || x.name, { permanent: true, direction: "top", offset: [0, -8] });
    s.map.flyTo(ll, 17);
    setRes(null);
    setMsg("Viewing only. Tap the map to drop your pin.");
  }

  return (
    <div className="msr">
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="in"
          placeholder="Search a place (shop, landmark...)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              search();
            }
          }}
        />
        <button
          type="button"
          className="ghost"
          style={{ marginTop: 0 }}
          onClick={search}
          disabled={busy}
        >
          {busy ? "..." : "Search"}
        </button>
      </div>
      {res && res.length > 0 && (
        <div
          style={{
            maxHeight: 190,
            overflow: "auto",
            marginBottom: 8,
            background: "var(--panel)",
            border: "1px solid var(--edge)",
            borderRadius: 8,
          }}
        >
          {res.map((x, i) => (
            <div key={i} className="mi" onClick={() => view(x)}>
              {x.label || x.name}
            </div>
          ))}
        </div>
      )}
      {msg && (
        <p className="muted" style={{ margin: "0 0 8px" }}>
          {msg}
        </p>
      )}
      <div
        ref={box}
        style={{
          height,
          borderRadius: 8,
          border: "1px solid var(--border)",
          position: "relative",
          zIndex: 0,
          isolation: "isolate",
        }}
      />
    </div>
  );
}