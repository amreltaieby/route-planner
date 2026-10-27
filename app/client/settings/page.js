"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../db";
import { useLang } from "../../lang";
import ClientNav from "../../ClientNav";

const THEMES = [
  { id: "dark", sw: "linear-gradient(135deg,#2563eb,#22d3ee)" },
  { id: "gray", sw: "linear-gradient(135deg,#ffffff,#9ca3af)" },
  { id: "slate", sw: "linear-gradient(135deg,#0b0b0c,#9ca3af)" },
  { id: "gold", sw: "linear-gradient(135deg,#0c0a06,#d4af37)" },
  { id: "mono", sw: "linear-gradient(90deg,#ffffff 50%,#000000 50%)" },
];

export default function ClientSettings() {
  const { t: L, lang, setLang, dir } = useLang();
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    try {
      const x = localStorage.getItem("routiq_theme");
      if (x) setTheme(x);
    } catch {}
  }, []);

  function pickTheme(id) {
    setTheme(id);
    try {
      localStorage.setItem("routiq_theme", id);
    } catch {}
    document.documentElement.setAttribute("data-theme", id);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <main className="rt cl" dir={dir} style={{ maxWidth: 520 }}>
      <h1 className="brandh">Routiq</h1>
      <h2 style={{ textAlign: "center", margin: "0 0 8px" }}>{L.settings}</h2>

      <div style={{ marginTop: 18 }}>
        <Link href="/terms" className="maps">
          {L.viewTerms}
        </Link>
      </div>

      <div className="sec" style={{ marginTop: 30 }}>
        {L.appearance}
      </div>
      {THEMES.map((x) => (
        <button
          key={x.id}
          type="button"
          className={theme === x.id ? "opt on" : "opt"}
          onClick={() => pickTheme(x.id)}
        >
          <span className="sw" style={{ background: x.sw }} />
          <span>{L.themes[x.id]}</span>
        </button>
      ))}

      <div className="sec" style={{ marginTop: 30 }}>
        {L.language}
      </div>
      <button
        type="button"
        className={lang === "en" ? "opt on" : "opt"}
        onClick={() => setLang("en")}
      >
        English
      </button>
      <button
        type="button"
        className={lang === "ar" ? "opt on" : "opt"}
        onClick={() => setLang("ar")}
      >
        {"\u0627\u0644\u0639\u0631\u0628\u064A\u0629"}
      </button>

      <div className="sec" style={{ marginTop: 30 }}>
        {L.account}
      </div>
      <button className="ghost" onClick={logout}>
        {L.logout}
      </button>

      <ClientNav />
    </main>
  );
}