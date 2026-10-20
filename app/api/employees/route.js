import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "crypto";

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ") || auth.length < 20) throw new Error("Not signed in.");
    const { username, password } = await req.json();
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "");
    if (u.length < 3) throw new Error("Username must be at least 3 characters.");
    if (p.length < 8) throw new Error("Password must be at least 8 characters.");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(p, salt, 64).toString("hex");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: auth } } }
    );
    const { error } = await sb
      .from("employees")
      .insert({ username: u, password_hash: `${salt}:${hash}` });
    if (error) throw new Error(error.code === "23505" ? "Username already taken." : error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}