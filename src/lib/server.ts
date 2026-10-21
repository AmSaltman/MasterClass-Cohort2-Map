import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server env vars are missing");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Verifies the Bearer token from the browser and returns the Supabase user.
export async function requireUser(req: Request): Promise<User> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new HttpError(401, "Please sign in.");
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session expired. Please sign in again.");
  return data.user;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

// yagni: per-instance in-memory limiter. Serverless instances don't share it,
// so it only blunts bursts. Upgrade path: a Postgres/Upstash counter.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new HttpError(429, "You're going a little fast — try again in a minute.");
  recent.push(now);
  hits.set(key, recent);
}

// Columns safe to send to other members (email/phone handled separately).
export const PUBLIC_COLUMNS =
  "id,full_name,email,phone,show_email,show_phone,city,region,country,lat,lng,company,title,industry,industries,ai_industry,bio,looking_for,can_help_with,linkedin,instagram,facebook,x,tiktok,youtube,website,whatsapp,tags,ai_summary,avatar_url";

type Row = Record<string, unknown> & { show_email?: boolean; show_phone?: boolean };

export function toPublic(row: Row) {
  const { show_email, show_phone, ...rest } = row;
  return {
    ...rest,
    email: show_email ? rest.email : null,
    phone: show_phone ? rest.phone : null,
    whatsapp: show_phone ? rest.whatsapp : null,
  };
}
