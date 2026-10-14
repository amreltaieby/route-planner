"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ClientHome() {
  const [c, setC] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setC(JSON.parse(localStorage.getItem("abs_client")));
    } catch {}
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <main className="rt" style={{ maxWidth: 480 }}>
      <h1 className="brandh">ABS</h1>
      <h2 style={{ textAlign: "center", margin: "0 0 18px" }}>Client home</h2>
      {c ? (
        <div className="card" style={{ marginTop: 0 }}>
          <div>
            Welcome, <span className="acc">{c.first_name}</span>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Your client ID: {c.client_no}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ textAlign: "center" }}>
          No client found on this device.{" "}
          <Link className="maps" href="/signup">
            Sign up
          </Link>
        </p>
      )}
    </main>
  );
}
