"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../db";
import { cleanUser, toEmail } from "../auth";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    const user = cleanUser(u);
    if (!user || !p) return setErr("Enter your username and password.");
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(user),
      password: p,
    });
    if (error) {
      setBusy(false);
      return setErr("Wrong username or password.");
    }
    const prof = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!prof.data) {
      await supabase.auth.signOut();
      setBusy(false);
      return setErr("This account has no company set up. Contact support.");
    }
    window.location.assign(prof.data.role === "client" ? "/client" : "/");
  }

  return (
    <main className="rt" style={{ maxWidth: 420 }}>
      <h1 className="brandh">RouteIQ</h1>
      <h2 style={{ textAlign: "center", margin: "0 0 8px" }}>Log in</h2>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>Username</label>
        <input
          className="in"
          autoComplete="username"
          value={u}
          onChange={(e) => setU(e.target.value)}
        />
        <label>Password</label>
        <input
          className="in"
          type="password"
          autoComplete="current-password"
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      <p className="muted" style={{ marginTop: 22 }}>
        Client?{" "}
        <Link className="maps" href="/join">
          Join your company
        </Link>
      </p>
    </main>
  );
}