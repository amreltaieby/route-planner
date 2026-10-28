"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../db";
import { cleanUser, validUser, toEmail } from "../auth";

export default function SignUp() {
  const [f, setF] = useState({ username: "", password: "", company: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const digits = (s) => s.replace(/\D/g, "").length;

  async function submit() {
    setErr("");
    const user = cleanUser(f.username);
    if (!validUser(user))
      return setErr("Username: 3 to 30 characters, letters, numbers, dot, dash or underscore.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (!f.company.trim()) return setErr("Enter the company name.");
    if (digits(f.phone) < 7) return setErr("Enter a valid phone number.");
    setBusy(true);
    const su = await supabase.auth.signUp({ email: toEmail(user), password: f.password });
    if (su.error) {
      setBusy(false);
      return setErr(
        /already/i.test(su.error.message) ? "That username is taken." : su.error.message
      );
    }
    if (!su.data.session) {
      setBusy(false);
      return setErr("Email confirmation is still on in Supabase. Turn it off and try again.");
    }
    const r = await supabase.rpc("create_company", {
      p_username: user,
      p_company: f.company.trim(),
      p_phone: f.phone.trim(),
    });
    if (r.error) {
      setBusy(false);
      return setErr(r.error.message);
    }
    window.location.assign("/");
  }

  return (
    <main className="rt" style={{ maxWidth: 420 }}>
      <h1 className="brandh">RouteIQ</h1>
      <h2 style={{ textAlign: "center", margin: "0 0 8px" }}>Create company account</h2>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>Username</label>
        <input className="in" autoComplete="username" value={f.username} onChange={set("username")} />

        <label>Password</label>
        <input
          className="in"
          type="password"
          autoComplete="new-password"
          value={f.password}
          onChange={set("password")}
        />

        <label>Company name</label>
        <input className="in" value={f.company} onChange={set("company")} />

        <label>Phone number</label>
        <input className="in" type="tel" value={f.phone} onChange={set("phone")} />

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Sign up"}
        </button>
      </form>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      <p className="muted" style={{ marginTop: 22 }}>
        By signing up you accept the{" "}
        <Link className="maps" href="/terms">
          terms and policy
        </Link>
        .
      </p>
      <p className="muted">
        Already have an account?{" "}
        <Link className="maps" href="/login">
          Log in
        </Link>
      </p>
    </main>
  );
}