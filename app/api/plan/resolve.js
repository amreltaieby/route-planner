const N = "-?\\d+(?:\\.\\d+)?";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REF = [30.05, 31.3];
const A = "23456789CFGHJMPQRVWX";
const COOKIE =
  "CONSENT=YES+cb.20210720-07-p0.en+FX+410; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiAo_CmBg";
const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

const dec = (s) => {
  let o = s;
  for (let i = 0; i < 3; i++) {
    try {
      const d = decodeURIComponent(o);
      if (d === o) break;
      o = d;
    } catch {
      break;
    }
  }
  return o;
};

async function expand(url, ua) {
  const urls = [url];
  let body = "";
  let cur = url;
  for (let i = 0; i < 8; i++) {
    const r = await fetch(cur, {
      redirect: "manual",
      headers: { "User-Agent": ua, "Accept-Language": "en", Cookie: COOKIE },
    });
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) {
      cur = new URL(loc, cur).href;
      urls.push(cur);
    } else {
      body = await r.text();
      break;
    }
  }
  return { urls, body };
}

const valid = (lat, lng) =>
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

function urlCoords(text) {
  const t = dec(text).replace(/&amp;/g, "&");
  const m =
    t.match(new RegExp(`!3d(${N})!4d(${N})`)) ||
    t.match(new RegExp(`@(${N}),(${N})`)) ||
    t.match(new RegExp(`[?&](?:q|query|ll|destination|daddr)=(${N}),\\s*(${N})`));
  if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };
  return null;
}

function prefixFor(pad) {
  let la = REF[0] + 90;
  let lo = REF[1] + 180;
  let step = 20;
  let out = "";
  for (let i = 0; i < pad; i += 2) {
    const a = Math.floor(la / step);
    const b = Math.floor(lo / step);
    out += A[a] + A[b];
    la -= a * step;
    lo -= b * step;
    step /= 20;
  }
  return out;
}

function olcDecode(full) {
  const c = full.replace("+", "");
  let lat = -90;
  let lng = -180;
  let step = 20;
  const n = Math.min(c.length, 10);
  for (let i = 0; i < n; i += 2) {
    lat += A.indexOf(c[i]) * step;
    lng += A.indexOf(c[i + 1]) * step;
    step /= 20;
  }
  let cellLat = step * 20;
  let cellLng = step * 20;
  if (c.length > 10) {
    const d = A.indexOf(c[10]);
    cellLat = (step * 20) / 5;
    cellLng = (step * 20) / 4;
    lat += Math.floor(d / 4) * cellLat;
    lng += (d % 4) * cellLng;
  }
  return { lat: lat + cellLat / 2, lng: lng + cellLng / 2 };
}

function plusCode(text) {
  const m = String(text)
    .toUpperCase()
    .match(/^([23456789CFGHJMPQRVWX]{4,8})[+ ]([23456789CFGHJMPQRVWX]{2,3})(?=\s|$)/);
  if (!m) return null;
  const pad = 8 - m[1].length;
  if (pad % 2) return null;
  const c = olcDecode(prefixFor(pad) + m[1] + "+" + m[2]);
  if (pad > 0) {
    const res = Math.pow(20, 2 - pad / 2);
    const h = res / 2;
    if (c.lat > REF[0] + h) c.lat -= res;
    else if (c.lat < REF[0] - h) c.lat += res;
    if (c.lng > REF[1] + h) c.lng -= res;
    else if (c.lng < REF[1] - h) c.lng += res;
  }
  return valid(c.lat, c.lng) ? c : null;
}

async function photon(q) {
  const r = await fetch(
    `https://photon.komoot.io/api/?limit=1&lat=${REF[0]}&lon=${REF[1]}&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": "routify/1.0" } }
  );
  if (!r.ok) return null;
  const j = await r.json();
  const f = j.features && j.features[0];
  return f ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] } : null;
}

async function nominatim(q) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": "routify/1.0" } }
  );
  const j = await r.json();
  return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null;
}

async function geocode(q) {
  const first = q.split(/[,،]/)[0].trim();
  const tries = [...new Set([q, first + ", Cairo, Egypt", first])];
  for (const t of tries) {
    try {
      const p = await photon(t);
      if (p) return p;
    } catch {}
    await sleep(1100);
    try {
      const p = await nominatim(t);
      if (p) return p;
    } catch {}
  }
  throw new Error(
    "Location not found: " + q + " (paste its lat,lng coordinates instead)"
  );
}

export async function resolve(input) {
  const s = String(input).trim();
  const m = s.match(new RegExp(`^(${N})\\s*,\\s*(${N})$`));
  if (m) return { name: s, lat: +m[1], lng: +m[2] };
  let q = s;
  let name = s;
  if (/^https?:\/\//i.test(s)) {
    let urls = [];
    let body = "";
    let title = "";
    for (const ua of UAS) {
      ({ urls, body } = await expand(s, ua));
      const tm = body.match(/<title>([^<]*?)(?: - Google Maps)?<\/title>/i);
      title = tm ? tm[1] : "";
      if (!/invalid dynamic link/i.test(title + body.slice(0, 2000))) break;
      title = "";
      body = "";
      urls = [s];
    }
    if (urls.length === 1 && !body && !title)
      throw new Error("Link not readable by server, use coordinates instead: " + s);
    const all = urls.join("\n");
    const p = dec(all).match(/\/place\/([^/@?\n]+)/);
    const full = p
      ? p[1].replace(/\+/g, " ")
      : title && !/^Google Maps$/i.test(title)
      ? title
      : "";
    name = full ? full.split(/[,،]/)[0].trim() : s;
    const c = urlCoords(all);
    if (c) return { name, ...c };
    const qm = dec(all).match(/[?&]q=([^&\n]+)/);
    if (full) q = full;
    else if (qm) q = qm[1].replace(/\+/g, " ");
    else
      throw new Error("Could not read link. Final URL: " + urls[urls.length - 1]);
  }
  const pc = plusCode(q);
  if (pc) return { name, ...pc };
  const g = await geocode(q);
  return { name, ...g };
}