"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../db";
import { useLang, DAYS } from "../lang";
import ClientNav from "../ClientNav";

const MAXT = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const typeOf = (t) => (t && t.data && t.data.type === "return" ? "return" : "arrival");
const placeOf = (t) => {
  const p = typeOf(t) === "return" ? t.data.start : t.data.end;
  return (p && p.name) || t.name;
};
const norm = (s) => (s || "").trim().toLowerCase();
const FIELD_KEYS = ["first_name", "last_name", "phone", "parent_phone", "stop", "destination", "days"];

function clockIn(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const g = (k) => parts.find((p) => p.type === k).value;
    return { wd: g("weekday"), hr: Number(g("hour")), min: Number(g("minute")) };
  } catch {
    return null;
  }
}

function dayState(d, ck) {
  if (!ck) return { locked: false };
  const nextD = DAYS[(DAYS.indexOf(ck.wd) + 1) % 7];
  if (d === ck.wd) return { locked: true, kind: "tom" };
  if (d === nextD) {
    if (ck.hr >= 21) return { locked: true, kind: "later" };
    return { locked: false, left: 21 * 60 - (ck.hr * 60 + ck.min) };
  }
  return { locked: false };
}

export default function ClientHome() {
  const { t: L, dir } = useLang();
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
  const [answering, setAnswering] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    async function fetchMe(uid) {
      return supabase
        .from("clients")
        .select(
          "id,first_name,last_name,phone,parent_phone,stop,status,days,trips_by_day,destination,pending_edit"
        )
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

  const ck = clockIn(tz);
  const isLocked = (d) => dayState(d, ck).locked;

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
    setMsg(L.saved);
  }

  function pickDay(d) {
    if (saving || isLocked(d)) return;
    if (sel.includes(d)) {
      const n = (joined[d] || []).length;
      setAsk({
        text: L.unselect(L.days[d], n),
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
    if (saving || isLocked(d)) return;
    const list = joined[d] || [];
    const ty = typeOf(t);
    if (list.includes(t.id)) {
      setAsk({
        text: L.leave(placeOf(t), L.ty[ty], L.days[d]),
        yes: () => apply(sel, { ...joined, [d]: list.filter((x) => x !== t.id) }),
      });
    } else if (sameTypeJoined(list, ty)) {
      setNote(L.limitNote(L.ty[ty], L.days[d]));
    } else apply(sel, { ...joined, [d]: [...list, t.id] });
  }

  async function respond(ok) {
    setEditErr("");
    setAnswering(true);
    const r = await supabase.rpc("client_respond_edit", { p_approve: ok });
    if (r.error) {
      setAnswering(false);
      setEditErr(r.error.message);
      return;
    }
    window.location.reload();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (!ready) return null;

  const showVal = (k, v) => {
    if (k === "days") {
      const l = DAYS.filter((d) => toArr(v).includes(d));
      return l.length ? l.map((d) => L.days[d]).join(", ") : "-";
    }
    return v ? String(v) : "-";
  };

  const approved = me && me.status === "approved";
  const changes =
    approved && me.pending_edit && me.pending_edit.changes ? me.pending_edit.changes : null;
  const changeKeys = changes ? Object.keys(changes).filter((k) => FIELD_KEYS.includes(k)) : [];

  return (
    <main className="rt cl" dir={dir} style={{ maxWidth: 520 }}>
      <h1 className="brandh">Routiq</h1>

      {noSession && (
        <p className="muted" style={{ textAlign: "center" }}>
          {L.notLoggedIn}{" "}
          <Link className="maps" href="/login">
            {L.login}
          </Link>
        </p>
      )}

      {!noSession && !me && (
        <section className="card" style={{ marginTop: 0 }}>
          <div>{L.notFound}</div>
          <div className="mbtns">
            <button className="btn" onClick={() => window.location.reload()}>
              {L.tryAgain}
            </button>
            <button className="ghost" onClick={logout}>
              {L.logout}
            </button>
          </div>
        </section>
      )}

      {me && (
        <div>
          {L.welcome} <span className="acc">{me.first_name}</span>
        </div>
      )}

      {me && me.status === "pending" && (
        <section className="card">
          <div className="sec" style={{ margin: "0 0 8px" }}>
            {L.requestSent}
          </div>
          <div>{L.pendingText}</div>
        </section>
      )}

      {me && me.status === "rejected" && (
        <section className="card">
          <div>{L.declined}</div>
        </section>
      )}

      {approved && (
        <>
          <div className="sec" style={{ marginTop: 28 }}>
            {L.book}
          </div>
          <p className="muted" style={{ margin: "0 0 4px" }}>
            {L.bookNote}
          </p>

          <label>{L.step1}</label>
          <div className="daygrid">
            {DAYS.map((d) => {
              const st = dayState(d, ck);
              let sfx = "";
              if (st.locked) sfx = ` (${st.kind === "tom" ? L.closedTom : L.closedLater})`;
              else if (st.left != null)
                sfx = ` (${L.closesIn(Math.floor(st.left / 60), st.left % 60)})`;
              return (
                <button
                  key={d}
                  type="button"
                  className={sel.includes(d) ? "daybtn on" : "daybtn"}
                  style={st.locked ? { opacity: 0.5, cursor: "default" } : undefined}
                  disabled={saving || st.locked}
                  onClick={() => pickDay(d)}
                >
                  {L.days[d]}
                  {sfx}
                </button>
              );
            })}
          </div>

          <label>{L.step2}</label>
          {sel.length === 0 && <div className="muted">{L.pickHint}</div>}
          {DAYS.filter((d) => sel.includes(d)).map((d) => {
            const list = tripsFor(d);
            const mine = joined[d] || [];
            const lk = isLocked(d);
            return (
              <div key={d} style={{ marginBottom: 14 }}>
                <div className="sec" style={{ margin: "14px 0 0", fontSize: 15 }}>
                  {L.days[d]}{" "}
                  <span className="muted">
                    ({mine.length}/{MAXT} {L.tripsWord})
                  </span>
                </div>
                {lk && <div className="muted">{L.dayClosed}</div>}
                {list.length === 0 && <div className="muted">{L.noTrips}</div>}
                {list.map((t) => {
                  const ty = typeOf(t);
                  const on = mine.includes(t.id);
                  const full = !on && sameTypeJoined(mine, ty);
                  return (
                    <div className="tripr" key={t.id}>
                      <div>
                        <div>{placeOf(t) + " | " + L.ty[ty]}</div>
                        <div className="muted">
                          {t.data.arrival ? `${L.ty[ty]} ${t.data.arrival}` : L.noTime}
                        </div>
                      </div>
                      <button
                        className={on ? "btn" : "ghost"}
                        style={{ marginTop: 0, ...(full ? { opacity: 0.5 } : {}) }}
                        disabled={saving || lk}
                        onClick={() => pickTrip(d, t)}
                      >
                        {on ? L.joined : L.join}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{ minHeight: 22, marginTop: 8 }}>
            {saving && <span className="muted">{L.saving}</span>}
            {!saving && msg && <span className="muted">{msg}</span>}
          </div>
          {err && <p className="err">{err}</p>}
        </>
      )}

      <p className="muted" style={{ marginTop: 28 }}>
        <Link className="maps" href="/terms">
          {L.terms}
        </Link>
      </p>

      {ask && (
        <div className="ov" onClick={() => setAsk(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{L.sure}</h3>
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
                {L.yes}
              </button>
              <button className="ghost" onClick={() => setAsk(null)}>
                {L.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {note && (
        <div className="ov" onClick={() => setNote("")}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{L.limitTitle}</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {note}
            </p>
            <div className="mbtns">
              <button className="btn" onClick={() => setNote("")}>
                {L.ok}
              </button>
            </div>
          </div>
        </div>
      )}

      {changes && changeKeys.length > 0 && (
        <div className="ov">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{L.changeTitle}</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {L.changeSub}
            </p>
            <div style={{ marginTop: 10 }}>
              {changeKeys.map((k) => (
                <div key={k} style={{ margin: "8px 0" }}>
                  <div className="muted">{L.f[k]}</div>
                  <div>
                    {showVal(k, me[k]) + " \u2192 "}
                    <b>{showVal(k, changes[k])}</b>
                  </div>
                </div>
              ))}
            </div>
            {changeKeys.includes("days") && <p className="muted">{L.daysNote}</p>}
            {editErr && <p className="err">{editErr}</p>}
            <div className="mbtns">
              <button className="btn" onClick={() => respond(true)} disabled={answering}>
                {answering ? L.saving : L.agree}
              </button>
              <button className="ghost" onClick={() => respond(false)} disabled={answering}>
                {L.decline}
              </button>
            </div>
          </div>
        </div>
      )}

      {me && <ClientNav />}
    </main>
  );
}