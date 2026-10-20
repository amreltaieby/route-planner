"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "./db";

const PUBLIC = ["/login", "/signup", "/join", "/terms"];
const AUTHPAGES = ["/login", "/signup", "/join"];
const isIn = (path, list) => list.some((p) => path === p || path.startsWith(p + "/"));
const CK = "routiq_role_";

export default function AuthGate({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [role, setRole] = useState(undefined);

  useEffect(() => {
    let alive = true;

    async function resolve(session) {
      if (!session) {
        if (alive) setRole(null);
        return;
      }
      const key = CK + session.user.id;
      let cached = null;
      try {
        cached = localStorage.getItem(key);
      } catch {}
      if (cached && alive) setRole(cached);
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const r = data ? data.role : null;
      try {
        if (r) localStorage.setItem(key, r);
        else localStorage.removeItem(key);
      } catch {}
      if (alive) setRole(r);
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === "INITIAL_SESSION" || evt === "TOKEN_REFRESHED") return;
      setTimeout(() => resolve(session), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const pub = isIn(path, PUBLIC);
  const clientArea = isIn(path, ["/client"]);
  let target = null;
  if (role !== undefined) {
    if (role === null && !pub) target = "/login";
    else if (role === "operator" && (clientArea || isIn(path, AUTHPAGES))) target = "/";
    else if (role === "client" && !(clientArea || isIn(path, ["/terms"]))) target = "/client";
  }

  useEffect(() => {
    if (target) router.replace(target);
  }, [target]);

  if (target) return null;

  return (
    <div style={{ display: "contents", visibility: role === undefined ? "hidden" : "visible" }}>
      {children}
    </div>
  );
}