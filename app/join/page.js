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
  const init = useRef(value);
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
      const place = (ll) => {
        const s = st.current;
        if (s.marker) s.marker.setLatLng(ll);
        else
          s.marker = s.L.circleMarker(ll, {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 1,
          }).addTo(s.map);
      };
      if (init.current) {
        const p = init.current.split(",").map(Number);
        if (p.length === 2 && p.every(Number.isFinite)) {
          place(L.latLng(p[0], p[1]));
          map.setView([p[0], p[1]], 16);
        }
      }
      map.on("click", (e) => {
        place(e.latlng);
        pick.current(e.latlng.lat.toFixed(6) + "," + e.latlng.lng.toFixed(6));
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

function StopPicker({ disabled, stops, mode, value, onList, onMap }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = [...stops]
    .sort((a, b) => a.localeCompare(b))
    .filter((s) => s.toLowerCase().includes(q.trim().toLowerCase()));
  const label = mode === "map" ? "Chosen on map" : value || "Select your stop";

  function close() {
    setOpen(false);
    setQ("");
  }

  return (
    <div className="pk">
      <button type="button" className="in cp" disabled={disabled} onClick={() => setOpen(!open)}>
        {disabled ? "Enter your company code first" : label}
      </button>
      {open && (
        <>
          <div className="mo" onClick={close} />
          <div
            className="mlist"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              maxHeight: 300,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
              <input
                className="in"
                placeholder="Search for your stop"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div style={{ overflow: "auto" }}>
              <div
                className="mi"
                style={{ color: "var(--cyan)", fontWeight: 600 }}
                onClick={() => {
                  onMap();
                  close();
                }}
              >
                Choose on map
              </div>
              {list.map((s) => (
                <div
                  className="mi"
                  key={s}
                  onClick={() => {
                    onList(s);
                    close();
                  }}
                >
                  {s}
                </div>
              ))}
              {list.length === 0 && <div className="mi muted">No matches</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
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
    pinName: "",
    destination: "",
    stopCoords: "",
  });
  const [mode, setMode] = useState("");
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
    const isMap = mode === "map";
    const stopName = isMap ? f.pinName.trim() : f.stop;
    if (!f.code.trim()) return setErr("Enter your company code.");
    if (!validUser(user))
      return setErr("Username: 3 to 30 characters, letters, numbers, dot, dash or underscore.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (!f.first.trim() || !f.last.trim()) return setErr("Enter your first and last name.");
    if (digits(f.phone) < 7) return setErr("Enter a valid phone number.");
    if (f.parentPhone.trim() && digits(f.parentPhone) < 7)
      return setErr("Enter a valid parent phone number or leave it empty.");
    if (isMap) {
      if (!f.stopCoords) return setErr("Tap the map to drop your pin.");
      if (!stopName) return setErr("Name your stop.");
      if (stops.some((s) => s.toLowerCase() === stopName.toLowerCase()))
        return setErr("A stop with that name already exists. Pick it from the list or use a different name.");
    } else if (stops.length > 0 && !f.stop) return setErr("Pick your stop.");
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
      p_stop: stopName,
      p_destination: f.destination,
      p_stop_coords: isMap ? f.stopCoords : null,
    });
    if (r.error) {
      await supabase.auth.signOut();
      setBusy(false);
      return setErr(r.error.message);
    }
    window.location.assign("/client");
  }

  const destOpts = dests.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ));
  const destHint = dests.length ? "Select your destination" : "Enter a valid company code first";

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
        <StopPicker
          disabled={f.code.trim().length < 4}
          stops={stops}
          mode={mode}
          value={f.stop}
          onList={(s) => {
            setMode("list");
            setF((x) => ({ ...x, stop: s, stopCoords: "", pinName: "" }));
          }}
          onMap={() => {
            setMode("map");
            setF((x) => ({ ...x, stop: "" }));
          }}
        />

        {mode === "map" && (
          <>
            <label>Tap the map to drop a pin on your exact stop</label>
            <PinMap value={f.stopCoords} onPick={(v) => setF((x) => ({ ...x, stopCoords: v }))} />
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {f.stopCoords ? "Pin placed: " + f.stopCoords + " " : "No pin placed yet. "}
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

            <label>Name this stop</label>
            <input
              className="in"
              placeholder="Lake View Compound Gate 3"
              value={f.pinName}
              onChange={set("pinName")}
            />
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {"Name the place, for example \"Lake View Compound Gate 3\". Do not use a personal name such as \"Doe's house\"."}
            </p>
          </>
        )}

        <label>Your destination</label>
        <select className="in" value={f.destination} onChange={set("destination")}>
          <option value="">{destHint}</option>
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