"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/locations", label: "Locations" },
  { href: "/clients", label: "Clients" },
  { href: "/requests", label: "Client requests" },
  { href: "/trips", label: "Trips" },
  { href: "/schedule", label: "Client lists" },
  { href: "/settings", label: "Settings" },
];

const publicPaths = ["/signup", "/login", "/join", "/client", "/terms"];

export default function Sidebar({ children }) {
  const [open, setOpen] = useState(true);
  const path = usePathname();
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + "/"));
  if (isPublic) return <>{children}</>;
  return (
    <div className="shell">
      <aside className={open ? "side" : "side closed"}>
        <div className="top">
          <Link href="/" className="brand">
            Routiq
          </Link>
          <button className="tg" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? "\u00AB" : "\u2630"}
          </button>
        </div>
        <nav>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}