"use client";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "../db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toArr = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const arr = (x) => (Array.isArray(x) ? x : []);

export default function Clients() {
  const [rows, setRows] = useState([]);
  const [trips, setTrips] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function init() {
      const [c, t] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .eq("status", "approved")
          .order("created_at", { ascending: true }),
        supabase.from("trips").select("id,name,data"),
      ]);
      if (c.error) setErr(c.error.message);
      else setRows(c.data || []);
      setTrips((t.data || []).filter((x) => x.data && x.data.day));
    }
    init();
  }, []);

  const tripName = (id) => {
    const t = trips.find((x) => x.id === id);
    return t ? t.name : null;
  };

  return (
    <main className="rt wide">
      <h1>Clients</h1>
      <p className="muted">
        Client details come from each client's own sign-up and bookings. This page is view only.
      </p>
      {err && <p className="err">{err}</p>}

      <table>
        <thead>
          <tr>
            <th>Person name</th>
            <th>Their stop</th>
            <th>Their destination</th>
            <th>Days</th>
            <th>Details</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sel = DAYS.filter((d) => toArr(r.days).includes(d));
            const tb =
              r.trips_by_day && typeof r.trips_by_day === "object" && !Array.isArray(r.trips_by_day)
                ? r.trips_by_day
                : {};
            const enr = sel
              .map((d) => ({
                d,
                names: arr(tb[d]).map(tripName).filter(Boolean),
              }))
              .filter((x) => x.names.length);
            const hasTrips = enr.length > 0;
            const nb = hasTrips ? { borderBottom: "none" } : undefined;
            return (
              <Fragment key={r.id}>
                <tr style={nb}>
                  <td style={nb}>{r.name}</td>
                  <td style={nb}>{r.stop || "-"}</td>
                  <td style={nb}>{r.destination || "-"}</td>
                  <td style={nb}>{sel.length ? sel.join(", ") : "-"}</td>
                  <td style={nb}>
                    <div className="muted">Phone: {r.phone || "-"}</div>
                    <div className="muted">Parent phone: {r.parent_phone || "-"}</div>
                  </td>
                  <td style={nb}>{r.client_no ?? "-"}</td>
                </tr>
                {hasTrips && (
                  <tr>
                    <td colSpan={6} style={{ paddingTop: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          rowGap: 6,
                        }}
                      >
                        {enr.map((x, i) => (
                          <div
                            key={x.d}
                            className="muted"
                            style={{
                              marginRight: 16,
                              paddingLeft: i ? 16 : 0,
                              borderLeft: i ? "1px solid var(--border)" : "none",
                            }}
                          >
                            {x.d}: {x.names.join(", ")}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">No clients yet.</div>}
    </main>
  );
}