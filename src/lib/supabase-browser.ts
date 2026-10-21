"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazily created so builds/prerenders don't need the env vars at import time.
export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
    );
  }
  return client;
}

export async function uploadAvatar(blob: Blob): Promise<string> {
  const { data } = await sb().auth.getSession();
  const body = new FormData();
  body.append("file", blob, "avatar.jpg");
  const res = await fetch("/api/avatar", {
    method: "POST",
    body,
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Photo upload failed.");
  return out.url;
}

// fetch() wrapper that sends the signed-in user's access token to our API.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}
