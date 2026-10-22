"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { supabase } from "../db";
import { cleanUser, validUser, toEmail } from "../auth";

function PinMap({ value, onPick }) {
  const box = useRef(null);
  const st = useRef({});
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let dead = false;
    (async () => {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (dead || !box.current) return;
      const map = L.map(box.current).setView([30.0444, 31.2357], 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      st.current = { map, L, marker: null };
      map.on("click", (e) => {
        const s = st.current;
        const ll = e.latlng;
        if (s.marker) s.marker.setLatLng(ll);
        else
          s.marker = s.L.circleMarker(ll, {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 1,
          }).addTo(s.map);
        pick.current(ll.lat.toFixed(6) + "," + ll.lng.toFixed(6));
      });
    })();
    return () => {
      dead = true;
      if (st.current.map) st.current.map.remove();
      st.current = {};
    };
  }, []);

  useEffect(() => {
    const s = st.current;
    if (!value && s.marker) {
      s.marker.remove();
      s.marker = null;
    }
  }, [value]);

  return <div ref={box} style={{ height: 260, borderRadius: 8, border: "1px solid var(--border)" }} />;
}

export default function Join() {
  const [f, setF] = useState({
    code: "",
    username: "",
    password: "",
    first: "",
    middle: "",
    last: "",
    phone: "",
    parentPhone: "",
    stop: "",
    destination: "",
    stopCoords: "",
  });
  const [stops, setStops] = useState([]);
  const [dests, setDests] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const digits = (s) => s.replace(/\D/g, "").length;

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) setF((x) => ({ ...x, code: c.toUpperCase() }));
  }, []);

  useEffect(() => {
    const code = f.code.trim();
    if (code.length < 4) {
      setStops([]);
      setDests([]);
      return;
    }
    let alive = true;
    supabase.rpc("company_locations", { p_code: code }).then((r) => {
      if (alive) setStops((r.data || []).map((x) => x.name));
    });
    supabase.rpc("company_destinations", { p_code: code }).then((r) => {
      if (alive) setDests((r.data || []).map((x) => x.name));
    });
    return () => {
      alive = false;
    };
  }, [f.code]);

  async function submit() {
    setErr("");
    const user = cleanUser(f.username);
    if (!f.code.trim()) return setErr("Enter your company code.");
    if (!validUser(user))
      return setErr("Username: 3 to 30 characters, letters, numbers, dot, dash or underscore.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (!f.first.trim() || !f.last.trim()) return setErr("Enter your first and last name.");
    if (digits(f.phone) < 7) return setErr("Enter a valid phone number.");
    if (f.parentPhone.trim() && digits(f.parentPhone) < 7)
      return setErr("Enter a valid parent phone number or leave it empty.");
    if (stops.length > 0 && !f.stop) return setErr("Pick your stop.");
    if (dests.length > 0 && !f.destination) return setErr("Pick your destination.");
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
    const r = await supabase.rpc("join_company", {
      p_code: f.code.trim(),
      p_username: user,
      p_first: f.first.trim(),
      p_middle: f.middle.trim(),
      p_last: f.last.trim(),
      p_phone: f.phone.trim(),
      p_parent_phone: f.parentPhone.trim(),
      p_stop: f.stop,
      p_destination: f.destination,
      p_stop_coords: f.stopCoords || null,
    });
    if (r.error) {
      await supabase.auth.signOut();
      setBusy(false);
      return setErr(r.error.message);
    }
    window.location.assign("/client");
  }

  const stopOpts = stops.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ));
  const destOpts = dests.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ));
  const stopHint = stops.length ? "Select" : "Enter a valid company code first";
  const destHint = dests.length ? "Select" : "Enter a valid company code first";

  return (
    <main className="rt" style={{ maxWidth: 480 }}>
      <h1 className="brandh">Routiq</h1>
      <h2 style={{ textAlign: "center", margin: "0 0 8px" }}>Join your company</h2>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>Company code</label>
        <input className="in" value={f.code} onChange={set("code")} />

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

        <label>First name</label>
        <input className="in" value={f.first} onChange={set("first")} />

        <label>Middle name (optional)</label>
        <input className="in" value={f.middle} onChange={set("middle")} />

        <label>Last name</label>
        <input className="in" value={f.last} onChange={set("last")} />

        <label>Phone number</label>
        <input className="in" type="tel" value={f.phone} onChange={set("phone")} />

        <label>Parent phone number (optional)</label>
        <input className="in" type="tel" value={f.parentPhone} onChange={set("parentPhone")} />

        <label>Your stop</label>
        <select className="in" value={f.stop} onChange={set("stop")}>
          <option value="">{stops.length ? "Select your stop" : stopHint}</option>
          {stopOpts}
        </select>

        <label>Drop a pin on your exact stop (optional)</label>
        <PinMap value={f.stopCoords} onPick={(v) => setF((x) => ({ ...x, stopCoords: v }))} />
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {f.stopCoords ? "Pin: " + f.stopCoords + " " : "Tap the map to place a pin. "}
          {f.stopCoords && (
            <button
              type="button"
              className="ghost"
              onClick={() => setF((x) => ({ ...x, stopCoords: "" }))}
            >
              Clear pin
            </button>
          )}
        </p>

        <label>Your destination</label>
        <select className="in" value={f.destination} onChange={set("destination")}>
          <option value="">{dests.length ? "Select your destination" : destHint}</option>
          {destOpts}
        </select>

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Signing up..." : "Sign up"}
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