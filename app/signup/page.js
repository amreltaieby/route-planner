"use client";
import { useEffect, useState } from "react";
import { supabase } from "../db";

export default function SignUp() {
  const [f, setF] = useState({
    first: "",
    middle: "",
    last: "",
    phone: "",
    parentPhone: "",
    start: "",
    drop: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const digits = (s) => s.replace(/\D/g, "").length;

  async function submit() {
    setErr("");
    if (
      !f.first.trim() ||
      !f.last.trim() ||
      !f.phone.trim() ||
      !f.parentPhone.trim() ||
      !f.start.trim() ||
      !f.drop.trim()
    ) {
      setErr("Fill all fields except middle name.");
      return;
    }
    if (digits(f.phone) < 7 || digits(f.parentPhone) < 7) {
      setErr("Enter valid phone numbers.");
      return;
    }
    const t = (s) => s.trim();
    const name = [f.first, f.middle, f.last].map(t).filter(Boolean).join(" ");
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name,
          first_name: t(f.first),
          middle_name: t(f.middle) || null,
          last_name: t(f.last),
          phone: t(f.phone),
          parent_phone: t(f.parentPhone),
          start_request: t(f.start),
          dropoff_request: t(f.drop),
        })
        .select("id,client_no,first_name")
        .single();
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      localStorage.setItem("abs_client", JSON.stringify(data));
      window.location.assign("/client");
    } catch (e) {
      setErr(String(e && e.message ? e.message : e));
      setBusy(false);
    }
  }

  return (
    <main className="rt" style={{ maxWidth: 480 }}>
      <h1 className="brandh">ABS</h1>
      <h2 style={{ textAlign: "center", margin: "0 0 8px" }}>Sign up</h2>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>First name</label>
        <input className="in" value={f.first} onChange={set("first")} />

        <label>Middle name</label>
        <input className="in" value={f.middle} onChange={set("middle")} />

        <label>Last name</label>
        <input className="in" value={f.last} onChange={set("last")} />

        <label>Phone number</label>
        <input className="in" type="tel" value={f.phone} onChange={set("phone")} />

        <label>Parent phone number</label>
        <input className="in" type="tel" value={f.parentPhone} onChange={set("parentPhone")} />

        <label>Starting location</label>
        <input className="in" value={f.start} onChange={set("start")} />

        <label>Requested drop off</label>
        <input className="in" value={f.drop} onChange={set("drop")} />

        <button className="btn" type="submit" disabled={busy || !ready}>
          {!ready ? "Loading..." : busy ? "Signing up..." : "Sign up"}
        </button>
      </form>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
    </main>
  );
}