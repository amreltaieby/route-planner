"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const publicPaths = ["/signup", "/login", "/join", "/client", "/terms"];

const items = [
  {
    href: "/",
    label: "Home",
    icon: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  },
  {
    href: "/locations",
    label: "Locations",
    icon: (
      <>
        <path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 21c0-3-2-4.8-5-5.3" />
      </>
    ),
  },
  {
    href: "/trips",
    label: "Trips",
    icon: (
      <>
        <circle cx="6" cy="19" r="2.5" />
        <circle cx="18" cy="5" r="2.5" />
        <path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" />
      </>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

export default function Sidebar({ children }) {
  const path = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + "/"));
  const show = mounted && !isPublic;
  const on = (h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));

  return (
    <>
      {children}
      {show && (
        <>
          <div style={{ height: 84 }} />
          <nav
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              display: "flex",
              justifyContent: "center",
              background: "var(--panel)",
              backgroundImage: "var(--panel-grad)",
              borderTop: "1px solid var(--edge)",
              padding: "8px 0 calc(8px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-label={i.label}
                style={{
                  flex: 1,
                  maxWidth: 140,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  textDecoration: "none",
                  fontSize: 12,
                  color: on(i.href) ? "var(--cyan)" : "var(--muted)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {i.icon}
                </svg>
                <span>{i.label}</span>
              </Link>
            ))}
          </nav>
        </>
      )}
    </>
  );
}