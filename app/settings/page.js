"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../db";

export default function Settings() {
  const [theme, setTheme] = useState("dark");
  const [company, setCompany] = useState(null);
  const [copied, setCopied] = useState(false);
  const [eu, setEu] = useState("");
  const [ep, setEp] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [l100, setL100] = useState("");
  const [price, setPrice] = useState("");
  const [fmsg, setFmsg] = useState("");
  const [ferr, setFerr] = useState("");
  const [fsaving, setFsaving] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem("routiq_theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
    supabase
      .from("companies")
      .select("name,code,fuel_l100,fuel_price")
      .maybeSingle()
      .then((r) => {
        setCompany(r.data || null);
        if (r.data) {
          setL100(r.data.fuel_l100 != null ? String(r.data.fuel_l100) : "");
          setPrice(r.data.fuel_price != null ? String(r.data.fuel_price) : "");
        }
      });
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("routiq_theme", next);
    } catch {}
    document.documentElement.setAttribute("data-theme", next);
  }

  const joinLink = company ? `${window.location.origin}/join?c=${company.code}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function saveFuel() {
    setFerr("");
    setFmsg("");
    const a = l100.trim() === "" ? null : Number(l100);
    const b = price.trim() === "" ? null : Number(price);
    if ((a !== null && !(a >= 0)) || (b !== null && !(b >= 0)))
      return setFerr("Enter numbers of zero or more.");
    setFsaving(true);
    const r = await supabase.rpc("set_fuel_settings", { p_l100: a, p_price: b });
    setFsaving(false);
    if (r.error) return setFerr(r.error.message);
    setFmsg("Saved. It applies to all trips.");
  }

  async function addEmployee() {
    setErr("");
    setMsg("");
    if (!eu.trim() || !ep) {
      setErr("Enter a username and a password.");
      return;
    }
    setSaving(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session ? s.data.session.access_token : "";
      const r = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: eu, password: ep }),
      });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else {
        setEu("");
        setEp("");
        setMsg("Employee saved.");
      }
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  const dark = theme === "dark";

  return (
    <main className="rt">
      <h1>Settings</h1>

      {company && (
        <>
          <div className="sec">Client sign-up</div>
          <div className="muted">
            Company code: <span className="acc">{company.code}</span>
          </div>
          <div className="muted" style={{ wordBreak: "break-all", marginTop: 6 }}>
            {joinLink}
          </div>
          <button className="ghost" onClick={copyLink}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </>
      )}

      <div className="sec" style={{ marginTop: 36 }}>
        Fuel
      </div>
      <p className="muted" style={{ margin: "0 0 4px" }}>
        Saved once and used for fuel and cost on every trip.
      </p>
      <label>Fuel consumption (L/100km)</label>
      <input
        className="in"
        type="number"
        min="0"
        step="0.1"
        placeholder="Optional"
        value={l100}
        onChange={(e) => setL100(e.target.value)}
      />
      <label>Fuel price per liter</label>
      <input
        className="in"
        type="number"
        min="0"
        step="0.01"
        placeholder="Optional"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button className="btn" onClick={saveFuel} disabled={fsaving}>
        {fsaving ? "Saving..." : "Save"}
      </button>
      {fmsg && <p className="muted">{fmsg}</p>}
      {ferr && <p className="err">{ferr}</p>}

      <div className="sec" style={{ marginTop: 36 }}>
        Add employee
      </div>
      <label>Username</label>
      <input
        className="in"
        autoComplete="off"
        value={eu}
        onChange={(e) => setEu(e.target.value)}
      />
      <label>Password</label>
      <input
        className="in"
        type="password"
        autoComplete="new-password"
        value={ep}
        onChange={(e) => setEp(e.target.value)}
      />
      <button className="btn" onClick={addEmployee} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
      {msg && <p className="muted">{msg}</p>}
      {err && <p className="err">{err}</p>}

      <div className="sec" style={{ marginTop: 36 }}>
        Appearance
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>Dark mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label="Dark mode"
          onClick={toggleTheme}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            border: "none",
            cursor: "pointer",
            position: "relative",
            background: dark ? "var(--accent)" : "#8a8a85",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: dark ? 25 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "left .15s",
            }}
          />
        </button>
        <span className="muted">{dark ? "On" : "Off"}</span>
      </div>

      <div className="sec" style={{ marginTop: 36 }}>
        Legal
      </div>
      <Link href="/terms" className="maps">
        View terms and policy
      </Link>

      <div className="sec" style={{ marginTop: 36 }}>
        Account
      </div>
      <button className="ghost" onClick={logout}>
        Log out
      </button>
    </main>
  );
}