import { resolve } from "./resolve.js";

export const maxDuration = 60;

function solve(D) {
  const n = D.length;
  const m = n - 2;
  if (m <= 0) return [0, n - 1];
  const FULL = 1 << m;
  const dp = Array.from({ length: FULL }, () => new Array(m).fill(Infinity));
  const par = Array.from({ length: FULL }, () => new Array(m).fill(-1));
  for (let i = 0; i < m; i++) dp[1 << i][i] = D[0][i + 1];
  for (let mask = 1; mask < FULL; mask++) {
    for (let i = 0; i < m; i++) {
      if (!(mask & (1 << i)) || dp[mask][i] === Infinity) continue;
      for (let j = 0; j < m; j++) {
        if (mask & (1 << j)) continue;
        const nm = mask | (1 << j);
        const v = dp[mask][i] + D[i + 1][j + 1];
        if (v < dp[nm][j]) {
          dp[nm][j] = v;
          par[nm][j] = i;
        }
      }
    }
  }
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < m; i++) {
    const v = dp[FULL - 1][i] + D[i + 1][n - 1];
    if (v < best) {
      best = v;
      bi = i;
    }
  }
  const seq = [];
  let mask = FULL - 1;
  let i = bi;
  while (i !== -1) {
    seq.push(i + 1);
    const p = par[mask][i];
    mask ^= 1 << i;
    i = p;
  }
  seq.reverse();
  return [0, ...seq, n - 1];
}

async function legsFor(ordered, mode) {
  const c = ordered.map((p) => `${p.lng},${p.lat}`).join(";");
  const r = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${c}?overview=false&steps=false&continue_straight=${mode}`
  );
  const d = await r.json();
  if (d.code !== "Ok" || !d.routes || !d.routes[0]) return null;
  return d.routes[0].legs.map((l) => ({ sec: l.duration, m: l.distance }));
}

export async function POST(req) {
  try {
    const { stops, start, end, arrivalMs, stopMin, traffic } = await req.json();
    if (stops.length > 12) throw new Error("Max 12 stops.");
    const free = !start;
    if (free && !stops.length) throw new Error("Add at least one stop.");
    const sm = Math.max(0, Number(stopMin) || 0);
    const f = Number(traffic) > 0 ? Number(traffic) : 1;

    const list = free ? [...stops, end] : [start, ...stops, end];
    const pts = [];
    for (const x of list) pts.push(await resolve(x));

    const seen = {};
    for (const p of pts) {
      const k = p.lat.toFixed(5) + "," + p.lng.toFixed(5);
      if (seen[k]) throw new Error(`Same coordinates (${k}) used twice. Check your locations.`);
      seen[k] = true;
    }

    const coords = pts.map((p) => `${p.lng},${p.lat}`).join(";");
    const r = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`
    );
    const d = await r.json();
    if (d.code !== "Ok") throw new Error("Routing failed: " + (d.message || d.code));
    const T = d.durations;
    const M = d.distances;
    const bad = (X) => X.some((row) => row.some((v) => v === null));
    if (bad(T) || bad(M)) throw new Error("A location is not reachable by road.");

    const n = pts.length;
    let seq;
    if (free) {
      const big = 1e12;
      const M2 = Array.from({ length: n + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => {
          if (i === 0) return j === 0 || j === n ? big : 0;
          if (j === 0) return big;
          return M[i - 1][j - 1];
        })
      );
      seq = solve(M2)
        .slice(1)
        .map((i) => i - 1);
    } else {
      seq = solve(M);
    }
    const ordered = seq.map((i) => pts[i]);

    let legs =
      (await legsFor(ordered, "true")) || (await legsFor(ordered, "default"));
    if (!legs)
      legs = seq.slice(0, -1).map((a, k) => ({
        sec: T[a][seq[k + 1]],
        m: M[a][seq[k + 1]],
      }));

    const legSec = legs.map((l) => l.sec * f);
    const driveSec = legSec.reduce((a, b) => a + b, 0);
    const meters = legs.reduce((a, l) => a + l.m, 0);

    const stopSec = sm * 60;
    const mid = Math.max(0, n - 2);
    const totalSec = driveSec + mid * stopSec;
    const startMs = Number(arrivalMs) - totalSec * 1000;

    let t = startMs;
    const order = [
      { idx: seq[0], lat: ordered[0].lat, lng: ordered[0].lng, arriveMs: t, departMs: t },
    ];
    for (let i = 1; i < ordered.length; i++) {
      t += legSec[i - 1] * 1000;
      const arriveMs = t;
      if (i < ordered.length - 1) t += stopSec * 1000;
      order.push({
        idx: seq[i],
        lat: ordered[i].lat,
        lng: ordered[i].lng,
        arriveMs,
        departMs: t,
      });
    }

    const ll = (p) => `${p.lat},${p.lng}`;
    const last = ordered.length - 1;
    const midPts = ordered.slice(1, last).map(ll).join("|");
    const mapsUrl =
      "https://www.google.com/maps/dir/?api=1&travelmode=driving" +
      "&origin=" + encodeURIComponent(ll(ordered[0])) +
      "&destination=" + encodeURIComponent(ll(ordered[last])) +
      "&waypoints=" + encodeURIComponent(midPts);

    return Response.json({
      order,
      startMs,
      distanceKm: meters / 1000,
      driveMin: driveSec / 60,
      totalMin: totalSec / 60,
      mapsUrl,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}