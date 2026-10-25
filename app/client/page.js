"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAXT = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const typeOf = (t) => (t && t.data && t.data.type === "return" ? "return" : "arrival");
const tword = (ty) => (ty === "return" ? "Return" : "Arrival");
const placeOf = (t) => {
  const p = typeOf(t) === "return" ? t.data.start : t.data.end;
  return (p && p.name) || t.name;
};
const norm = (s) => (s || "").trim().toLowerCase();

function lockedNow(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday").value;
    const hr = Number(parts.find((p) => p.type === "hour").value);
    const out = [wd];
    if (hr >= 21) out.push(DAYS[(DAYS.indexOf(wd) + 1) % 7]);
    return out;
  } catch {
    return [];
  }
}

export default function ClientHome() {
  const [me, setMe] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [trips, setTrips] = useState([]);
  const [tz, setTz] = useState("Africa/Cairo");
  const [sel, setSel] = useState([]);
  const [joined, setJoined] = useState({});
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState(null);
  const [note, setNote] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    async function fetchMe(uid) {
      return supabase
        .from("clients")
        .select("id,first_name,status,days,trips_by_day,destination")
        .eq("user_id", uid)
        .maybeSingle();
    }

    async function init() {
      const s = await supabase.auth.getSession();
      const uid = s.data.session && s.data.session.user.id;
      if (!uid) {
        setNoSession(true);
        setReady(true);
        return;
      }
      let c = await fetchMe(uid);
      if (!c.data) {
        await sleep(800);
        c = await fetchMe(uid);
      }
      if (c.data) {
        setMe(c.data);
        setSel(DAYS.filter((d) => toArr(c.data.days).includes(d)));
        const tb =
          c.data.trips_by_day &&
          typeof c.data.trips_by_day === "object" &&
          !Array.isArray(c.data.trips_by_day)
            ? c.data.trips_by_day
            : {};
        const j = {};
        Object.keys(tb).forEach((k) => {
          if (Array.isArray(tb[k])) j[k] = tb[k];
        });
        setJoined(j);
        const [t, co] = await Promise.all([
          supabase.from("trips").select("id,name,data"),
          supabase.from("companies").select("tz").maybeSingle(),
        ]);
        setTrips((t.data || []).filter((x) => x.data && x.data.day));
        if (co.data && co.data.tz) setTz(co.data.tz);
      }
      setReady(true);
    }
    init();
  }, []);

  const locked = lockedNow(tz);

  const myDest = norm(me && me.destination);
  const tripsFor = (d) =>
    trips
      .filter(
        (t) =>
          t.data.day === d &&
          (!myDest || norm(placeOf(t)) === myDest || (joined[d] || []).includes(t.id))
      )
      .sort((a, b) => (a.data.arrival || "99:99").localeCompare(b.data.arrival || "99:99"));

  const sameTypeJoined = (ids, ty) =>
    ids.some((id) => {
      const o = trips.find((x) => x.id === id);
      return o && typeOf(o) === ty;
    });

  async function apply(nextSel, nextJoined) {
    const prev = { sel, joined };
    setErr("");
    setMsg("");
    setSel(nextSel);
    setJoined(nextJoined);
    setSaving(true);
    const tb = {};
    nextSel.forEach((d) => {
      const ids = nextJoined[d] || [];
      if (ids.length) tb[d] = ids;
    });
    const r = await supabase.rpc("book_trips", {
      p_days: DAYS.filter((d) => nextSel.includes(d)).join(", "),
      p_trips: tb,
    });
    setSaving(false);
    if (r.error) {
      setSel(prev.sel);
      setJoined(prev.joined);
      setErr(r.error.message);
      return;
    }
    setMsg("Saved.");
  }

  function pickDay(d) {
    if (saving || locked.includes(d)) return;
    if (sel.includes(d)) {
      const n = (joined[d] || []).length;
      setAsk({
        text: n
          ? `Unselect ${d}? This will also remove your ${n} trip${n > 1 ? "s" : ""} on that day.`
          : `Unselect ${d}?`,
        yes: () => {
          const nj = { ...joined };
          delete nj[d];
          apply(
            sel.filter((x) => x !== d),
            nj
          );
        },
      });
    } else apply([...sel, d], joined);
  }

  function pickTrip(d, t) {
    if (saving || locked.includes(d)) return;
    const list = joined[d] || [];
    const ty = typeOf(t);
    if (list.includes(t.id)) {
      setAsk({
        text: `Leave "${placeOf(t)} | ${tword(ty)}" on ${d}?`,
        yes: () => apply(sel, { ...joined, [d]: list.filter((x) => x !== t.id) }),
      });
    } else if (sameTypeJoined(list, ty)) {
      setNote(
        `You already joined a ${ty} trip on ${d}. Joining another one would exceed the limit of one arrival trip and one return trip per day. To switch, leave your current ${ty} trip first.`
      );
    } else apply(sel, { ...joined, [d]: [...list, t.id] });
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (!ready) return null;

  const approved = me && me.status === "approved";

  return (
    <main className="rt" style={{ maxWidth: 520 }}>
      <h1 className="brandh">Routiq</h1>

      {noSession && (
        <p className="muted" style={{ textAlign: "center" }}>
          You are not logged in.{" "}
          <Link className="maps" href="/login">
            Log in
          </Link>
        </p>
      )}

      {!noSession && !me && (
        <section className="card" style={{ marginTop: 0 }}>
          <div>
            Your client profile was not found. If you just signed up, try again in a moment.
            Otherwise contact your company.
          </div>
          <div className="mbtns">
            <button className="btn" onClick={() => window.location.reload()}>
              Try again
            </button>
            <button className="ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </section>
      )}

      {me && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            Welcome, <span className="acc">{me.first_name}</span>
          </div>
          <button className="ghost" style={{ marginTop: 0 }} onClick={logout}>
            Log out
          </button>
        </div>
      )}

      {me && me.status === "pending" && (
        <section className="card">
          <div className="sec" style={{ margin: "0 0 8px" }}>
            Request sent
          </div>
          <div>
            The last step is for your company to approve your join request. You will be able to
            book trips once it is approved.
          </div>
        </section>
      )}

      {me && me.status === "rejected" && (
        <section className="card">
          <div>Your join request was declined. Please contact your company.</div>
        </section>
      )}

      {approved && (
        <>
          <div className="sec" style={{ marginTop: 28 }}>
            Book trips
          </div>
          <p className="muted" style={{ margin: "0 0 4px" }}>
            book your trip early, booking a trip closes at 9pm on the day before the trip
          </p>

          <label>1. Pick your days</label>
          <div className="daygrid">
            {DAYS.map((d) => {
              const lk = locked.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={sel.includes(d) ? "daybtn on" : "daybtn"}
                  style={lk ? { opacity: 0.5, cursor: "default" } : undefined}
                  disabled={saving || lk}
                  onClick={() => pickDay(d)}
                >
                  {d}
                  {lk ? " (closed)" : ""}
                </button>
              );
            })}
          </div>

          <label>2. Join trips (one arrival and one return per day)</label>
          {sel.length === 0 && <div className="muted">Pick a day to see its trips.</div>}
          {DAYS.filter((d) => sel.includes(d)).map((d) => {
            const list = tripsFor(d);
            const mine = joined[d] || [];
            const lk = locked.includes(d);
            return (
              <div key={d} style={{ marginBottom: 14 }}>
                <div className="sec" style={{ margin: "14px 0 0", fontSize: 15 }}>
                  {d}{" "}
                  <span className="muted">
                    ({mine.length}/{MAXT} trips)
                  </span>
                </div>
                {lk && <div className="muted">Booking for this day is closed.</div>}
                {list.length === 0 && <div className="muted">No trips available.</div>}
                {list.map((t) => {
                  const ty = typeOf(t);
                  const on = mine.includes(t.id);
                  const full = !on && sameTypeJoined(mine, ty);
                  return (
                    <div className="tripr" key={t.id}>
                      <div>
                        <div>{placeOf(t) + " | " + tword(ty)}</div>
                        <div className="muted">
                          {t.data.arrival ? `${tword(ty)} ${t.data.arrival}` : "No time set"}
                        </div>
                      </div>
                      <button
                        className={on ? "btn" : "ghost"}
                        style={{ marginTop: 0, ...(full ? { opacity: 0.5 } : {}) }}
                        disabled={saving || lk}
                        onClick={() => pickTrip(d, t)}
                      >
                        {on ? "Joined" : "Join"}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{ minHeight: 22, marginTop: 8 }}>
            {saving && <span className="muted">Saving...</span>}
            {!saving && msg && <span className="muted">{msg}</span>}
          </div>
          {err && <p className="err">{err}</p>}
        </>
      )}

      <p className="muted" style={{ marginTop: 28 }}>
        <Link className="maps" href="/terms">
          Terms and policy
        </Link>
      </p>

      {ask && (
        <div className="ov" onClick={() => setAsk(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {ask.text}
            </p>
            <div className="mbtns">
              <button
                className="btn"
                onClick={() => {
                  const y = ask.yes;
                  setAsk(null);
                  y();
                }}
              >
                Yes
              </button>
              <button className="ghost" onClick={() => setAsk(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {note && (
        <div className="ov" onClick={() => setNote("")}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Trip limit reached</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {note}
            </p>
            <div className="mbtns">
              <button className="btn" onClick={() => setNote("")}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}