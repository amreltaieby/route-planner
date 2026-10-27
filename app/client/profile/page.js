"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../db";
import { useLang } from "../../lang";
import ClientNav from "../../ClientNav";

const digits = (s) => (s || "").replace(/\D/g, "").length;
const opts = (list, cur) => {
  const a = [...list];
  if (cur && !a.some((x) => x.toLowerCase() === cur.toLowerCase())) a.push(cur);
  return a.sort((x, y) => x.localeCompare(y));
};

export default function Profile() {
  const { t: L, dir } = useLang();
  const [me, setMe] = useState(null);
  const [username, setUsername] = useState("");
  const [stops, setStops] = useState([]);
  const [dests, setDests] = useState([]);
  const [ready, setReady] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function load() {
    const s = await supabase.auth.getSession();
    const uid = s.data.session && s.data.session.user.id;
    if (!uid) {
      setReady(true);
      return;
    }
    const [c, p, co] = await Promise.all([
      supabase
        .from("clients")
        .select("first_name,last_name,phone,parent_phone,stop,destination")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase.from("profiles").select("username").eq("user_id", uid).maybeSingle(),
      supabase.from("companies").select("code").maybeSingle(),
    ]);
    setMe(c.data || null);
    setUsername(p.data ? p.data.username : "");
    if (co.data && co.data.code) {
      const [a, b] = await Promise.all([
        supabase.rpc("company_locations", { p_code: co.data.code }),
        supabase.rpc("company_destinations", { p_code: co.data.code }),
      ]);
      setStops((a.data || []).map((x) => x.name));
      setDests((b.data || []).map((x) => x.name));
    }
    setReady(true);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit() {
    setErr("");
    setF({
      first: me.first_name || "",
      last: me.last_name || "",
      phone: me.phone || "",
      parent: me.parent_phone || "",
      stop: me.stop || "",
      dest: me.destination || "",
    });
    setEdit(true);
  }

  async function save() {
    setErr("");
    if (!f.first.trim() || !f.last.trim()) return setErr(L.nameReq);
    if (digits(f.phone) < 7) return setErr(L.phoneBad);
    if (f.parent.trim() && digits(f.parent) < 7) return setErr(L.parentBad);
    if (stops.length > 0 && !f.stop) return setErr(L.pickStop);
    if (dests.length > 0 && !f.dest) return setErr(L.pickDest);
    setBusy(true);
    const r = await supabase.rpc("update_my_profile", {
      p_first: f.first.trim(),
      p_last: f.last.trim(),
      p_phone: f.phone.trim(),
      p_parent_phone: f.parent.trim(),
      p_stop: f.stop,
      p_destination: f.dest,
    });
    if (r.error) {
      setBusy(false);
      return setErr(r.error.message);
    }
    await load();
    setBusy(false);
    setEdit(false);
  }

  if (!ready) return null;

  const row = (label, value) => (
    <div className="prow">
      <div className="muted">{label}</div>
      <div>{value || "-"}</div>
    </div>
  );

  return (
    <main className="rt cl" dir={dir} style={{ maxWidth: 520 }}>
      <h1 className="brandh">Routiq</h1>

      {me && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div className="muted">{L.username}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{username}</div>
            </div>
            {!edit && (
              <button className="ghost" style={{ marginTop: 0 }} onClick={startEdit}>
                {L.editProfile}
              </button>
            )}
          </div>

          {!edit && (
            <div style={{ marginTop: 10 }}>
              {row(L.name, (me.first_name || "") + " " + (me.last_name || ""))}
              {row(L.phoneNo, me.phone)}
              {row(L.parentPhoneNo, me.parent_phone)}
              {row(L.f.stop, me.stop)}
              {row(L.f.destination, me.destination)}
            </div>
          )}

          {edit && (
            <div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label>{L.f.first_name}</label>
                  <input className="in" value={f.first} onChange={set("first")} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label>{L.f.last_name}</label>
                  <input className="in" value={f.last} onChange={set("last")} />
                </div>
              </div>

              <label>{L.phoneNo}</label>
              <input className="in" type="tel" value={f.phone} onChange={set("phone")} />

              <label>{L.parentPhoneNo}</label>
              <input className="in" type="tel" value={f.parent} onChange={set("parent")} />

              <label>{L.f.stop}</label>
              <select className="in" value={f.stop} onChange={set("stop")}>
                <option value="">{L.select}</option>
                {opts(stops, me.stop).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <label>{L.f.destination}</label>
              <select className="in" value={f.dest} onChange={set("dest")}>
                <option value="">{L.select}</option>
                {opts(dests, me.destination).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {err && <p className="err">{err}</p>}
              <div className="mbtns">
                <button className="btn" onClick={save} disabled={busy}>
                  {busy ? L.saving : L.save}
                </button>
                <button className="ghost" onClick={() => setEdit(false)} disabled={busy}>
                  {L.cancel}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {me && <ClientNav />}
    </main>
  );
}