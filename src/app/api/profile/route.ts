import { connection } from "next/server";
import { z } from "zod";
import { adminClient, errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";
import { buildSearchText, embed, enrichProfile } from "@/lib/gemini";
import type { ProfileInput } from "@/lib/types";

const s = (max: number) => z.string().trim().max(max).default("");

const Profile = z.object({
  full_name: z.string().trim().min(1, "Please add your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please add a valid email.").max(200),
  phone: s(40),
  city: z.string().trim().min(1, "Please add your city.").max(120),
  region: s(120),
  country: s(120),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  company: s(160),
  title: s(160),
  industry: s(120),
  bio: s(1200),
  looking_for: s(600),
  can_help_with: s(600),
  linkedin: s(300),
  instagram: s(300),
  facebook: s(300),
  x: s(300),
  tiktok: s(300),
  youtube: s(300),
  website: s(300),
  whatsapp: s(40),
  show_email: z.boolean().default(true),
  show_phone: z.boolean().default(false),
});

export async function GET(req: Request) {
  await connection(); // per-user data: never prerender
  try {
    const user = await requireUser(req);
    const { data, error } = await adminClient()
      .from("members")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) delete (data as Record<string, unknown>).embedding;
    return Response.json({
      profile: data,
      account: { email: user.email, full_name: user.user_metadata?.full_name || "" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// Saves a profile. Gemini normalizes the industry, writes search tags and a
// summary, fills in coordinates if the city wasn't picked from the list, and
// we store an embedding so the AI search can match on meaning.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`profile:${user.id}`, 12, 10 * 60_000);

    const parsed = Profile.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Check the form and try again.");
    const p = parsed.data as ProfileInput;

    const enrichment = await enrichProfile(p);
    const lat = p.lat ?? enrichment?.lat ?? null;
    const lng = p.lng ?? enrichment?.lng ?? null;
    const searchText = buildSearchText(p, enrichment);
    const embedding = await embed(searchText, "document");

    const row = {
      id: user.id,
      ...p,
      lat,
      lng,
      ai_industry: enrichment?.industry || p.industry || null,
      tags: enrichment?.tags || [],
      ai_summary: enrichment?.summary || null,
      search_text: searchText,
      ...(embedding ? { embedding: JSON.stringify(embedding) } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error } = await adminClient().from("members").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return Response.json({
      ok: true,
      ai: { industry: row.ai_industry, tags: row.tags, summary: row.ai_summary, located: lat !== null },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// Removes the member from the map and deletes their account.
export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    const { error } = await adminClient().auth.admin.deleteUser(user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
