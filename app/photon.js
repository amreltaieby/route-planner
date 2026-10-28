const BIAS = "lat=30.0444&lon=31.2357";

export async function photon(q) {
  const r = await fetch(
    "https://photon.komoot.io/api/?limit=7&" + BIAS + "&q=" + encodeURIComponent(q)
  );
  if (!r.ok) throw new Error("search failed");
  const d = await r.json();
  const out = [];
  (d.features || []).forEach((f) => {
    const p = f.properties || {};
    const c = (f.geometry && f.geometry.coordinates) || [];
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const parts = [];
    [p.name, p.street, p.district, p.city, p.state, p.country].forEach((x) => {
      if (x && !parts.includes(x)) parts.push(x);
    });
    out.push({ name: p.name || parts[0] || "", label: parts.join(", "), lat, lng });
  });
  return out;
}