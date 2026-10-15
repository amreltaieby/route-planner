import { resolve } from "./resolve.js";

export const maxDuration = 60;

function fill(D) {
  const n = D.length;
  const m = n - 2;
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
  return { dp, par, m, n, FULL };
}

function pathFor(t, mask, D) {
  const { dp, par, m, n } = t;
  let best = Infinity;
  let bi = -1;
  for (let i = 0; i < m; i++) {
    if (!(mask & (1 << i))) continue;
    const v = dp[mask][i] + D[i + 1][n - 1];
    if (v < best) {
      best = v;
      bi = i;
    }
  }
  const seq = [];
  let mk = mask;
  let i = bi;
  while (i !== -1) {
    seq.push(i + 1);
    const p = par[mk][i];
    mk ^= 1 << i;
    i = p;
  }
  seq.reverse();
  return { cost: best, seq: [0, ...seq, n - 1] };
}

function solve(D) {
  const n = D.length;
  const m = n - 2;
  if (m <= 0) return [0, n - 1];
  const t = fill(D);
  return pathFor(t, t.FULL - 1, D).seq;
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
    const {
      stops,
      start,
      end,
      start2,
      end2,
      arrivalMs,
      stopMin,
      traffic,
      cars,
      capacity,
      people,
    } = await req.json();
    if (stops.length > 12) throw new Error("Max 12 stops.");
    const free = !start;
    if (free && !stops.length) throw new Error("Add at least one stop.");
    const sm = Math.max(0, Number(stopMin) || 0);
    const f = Number(traffic) > 0 ? Number(traffic) : 1;

    const nCars = free ? 1 : Math.min(2, Math.max(1, Math.floor(Number(cars)) || 1));
    if (nCars === 2 && (!start2 || !end2))
      throw new Error("Car 2 needs a start and an end location.");
    const cap = Number(capacity) > 0 ? Math.floor(Number(capacity)) : 0;
    const ppl = stops.map((_, i) =>
      Math.max(1, Math.floor(Number(people && people[i])) || 1)
    );
    if (cap > 0 && !free) {
      if (ppl.some((p) => p > cap))
        throw new Error("A stop has more people than one car holds.");
      if (ppl.reduce((a, b) => a + b, 0) > nCars * cap)
        throw new Error("Too many people for the number of cars and capacity.");
    }

    const list = free ? [...stops, end] : [start, ...stops, end];
    const base = list.length;
    if (nCars === 2) list.push(start2, end2);

    const cache = {};
    const pts = [];
    for (const x of list) {
      if (!cache[x]) cache[x] = await resolve(x);
      pts.push(cache[x]);
    }

    const key = (p) => p.lat.toFixed(5) + "," + p.lng.toFixed(5);
    const seen = {};
    for (const p of pts.slice(0, base)) {
      const k = key(p);
      if (seen[k]) throw new Error(`Same coordinates (${k}) used twice. Check your locations.`);
      seen[k] = true;
    }
    if (nCars === 2) {
      const s2 = key(pts[base]);
      const e2 = key(pts[base + 1]);
      if (s2 === e2) throw new Error("Car 2 start and end are the same.");
      for (let i = 1; i <= stops.length; i++) {
        const k = key(pts[i]);
        if (k === s2 || k === e2)
          throw new Error(`A stop shares coordinates (${k}) with car 2's start or end.`);
      }
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

    async function make(seq) {
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
      const mid = Math.max(0, ordered.length - 2);
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

      return {
        order,
        startMs,
        distanceKm: meters / 1000,
        driveMin: driveSec / 60,
        totalMin: totalSec / 60,
        mapsUrl,
      };
    }

    if (nCars === 2 && stops.length > 0) {
      const m = stops.length;
      const FULL = 1 << m;
      const mids = Array.from({ length: m }, (_, i) => i + 1);
      const L1 = [0, ...mids, m + 1];
      const L2 = [m + 2, ...mids, m + 3];
      const sub = (L) => L.map((a) => L.map((b) => M[a][b]));
      const D1 = sub(L1);
      const D2 = sub(L2);
      const t1 = fill(D1);
      const t2 = fill(D2);
      const sum = (mask) => {
        let s = 0;
        for (let k = 0; k < m; k++) if (mask & (1 << k)) s += ppl[k];
        return s;
      };
      let bestCost = Infinity;
      let bestA = -1;
      for (let a = 0; a < FULL; a++) {
        const b = (FULL - 1) ^ a;
        if (cap > 0 && (sum(a) > cap || sum(b) > cap)) continue;
        const c =
          (a ? pathFor(t1, a, D1).cost : 0) + (b ? pathFor(t2, b, D2).cost : 0);
        if (c < bestCost) {
          bestCost = c;
          bestA = a;
        }
      }
      if (bestA === -1) throw new Error("No way to split the people between the two cars.");
      const plans = [
        [bestA, t1, D1, L1, 1],
        [(FULL - 1) ^ bestA, t2, D2, L2, 2],
      ];
      const routes = [];
      for (const [mask, t, D, L, car] of plans) {
        if (!mask) continue;
        const seq = pathFor(t, mask, D).seq.map((i) => L[i]);
        const rt = await make(seq);
        routes.push({ ...rt, car, people: sum(mask) });
      }
      return Response.json({ routes });
    }

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
    return Response.json(await make(seq));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}