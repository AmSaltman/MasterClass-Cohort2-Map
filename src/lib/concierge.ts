import "server-only";
import type { FunctionCall, FunctionDeclaration } from "@google/genai";
import { adminClient } from "./server";
import { embed } from "./gemini";

// The concierge's shared brain: tools, data and instructions used by both the
// text chat (/api/assistant) and voice mode (Gemini Live, /api/live/*).

export const TOOLS: FunctionDeclaration[] = [
  {
    name: "search_members",
    description:
      "Search the cohort directory. Combine any of: a natural-language description (semantic match), keywords (exact-ish match on industry, skills, company, tags), and a location radius. Returns up to `limit` members with similarity and distance.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What kind of person, in plain words, e.g. 'healthcare operators who scaled clinics'." },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Single words or short phrases incl. synonyms, e.g. ['healthcare','medtech','hospital','biotech'].",
        },
        near_lat: { type: "number", description: "Latitude of the place to search around." },
        near_lng: { type: "number", description: "Longitude of the place to search around." },
        radius_km: { type: "number", description: "Radius in km. Metro area ≈ 80, region ≈ 300, country-scale ≈ 1500." },
        limit: { type: "integer", description: "Max results, default 25." },
      },
    },
  },
  {
    name: "highlight_members",
    description:
      "Light up these members on the map (everyone else is grayed out) and optionally fly the globe to a spot. Call this once you know who is relevant. Pass an empty list to clear highlights.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        member_ids: { type: "array", items: { type: "string" } },
        focus_lat: { type: "number" },
        focus_lng: { type: "number" },
        focus_zoom: { type: "number", description: "1 = whole globe, 4 = country, 8 = metro area." },
      },
      required: ["member_ids"],
    },
  },
  {
    name: "save_suggestion",
    description: "Save a feature request or feedback about this cohort map for the organizers.",
    parametersJsonSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
];

export type Compact = Record<string, unknown>;

export async function searchMembers(args: Record<string, unknown>, byId: Map<string, Compact>) {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const keywords = Array.isArray(args.keywords)
    ? args.keywords.filter((k): k is string => typeof k === "string" && !!k.trim()).slice(0, 12)
    : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const limit = Math.min(Math.max(num(args.limit) ?? 25, 1), 60);
  const embedding = query ? await embed(query, "query") : null;

  const { data, error } = await adminClient().rpc("search_members", {
    query_embedding: embedding ? JSON.stringify(embedding) : null,
    keyword: keywords.length ? keywords.map((k) => `"${k.replace(/"/g, "")}"`).join(" or ") : null,
    near_lat: num(args.near_lat),
    near_lng: num(args.near_lng),
    radius_km: num(args.radius_km),
    max_results: limit,
  });
  if (error) throw error;
  const rows = (data || []) as { id: string; similarity: number | null; keyword_rank: number | null; distance_km: number | null }[];
  return rows
    .map((r) => {
      const m = byId.get(r.id);
      if (!m) return null;
      return {
        ...m,
        similarity: r.similarity === null ? undefined : Number(r.similarity.toFixed(3)),
        keyword_match: r.keyword_rank ? r.keyword_rank > 0 : undefined,
        distance_km: r.distance_km === null ? undefined : Math.round(r.distance_km),
      };
    })
    .filter(Boolean);
}


export type ConciergeContext = {
  userId: string;
  hasProfile: boolean;
  byId: Map<string, Compact>;
  system: string;
};

// Loads a compact directory (~1k members) plus the asker's profile and saved contacts.
export async function loadContext(userId: string, mode: "text" | "voice"): Promise<ConciergeContext> {
  const db = adminClient();
  const [{ data: all, error }, { data: savedRows }] = await Promise.all([
    db.from("members")
      .select("id,full_name,title,company,industries,city,region,country,lat,lng,tags,ai_summary,looking_for,can_help_with")
      .limit(5000),
    db.from("saved_contacts").select("contact_id").eq("member_id", userId).order("created_at"),
  ]);
  if (error) throw error;
  const byId = new Map<string, Compact>();
  const industries = new Map<string, number>();
  for (const m of all || []) {
    byId.set(m.id, {
      id: m.id, name: m.full_name, title: m.title, company: m.company, industries: m.industries,
      location: [m.city, m.region, m.country].filter(Boolean).join(", "),
      tags: m.tags, summary: m.ai_summary, looking_for: m.looking_for, can_help_with: m.can_help_with,
    });
    for (const ind of (m.industries as string[]) || []) industries.set(ind, (industries.get(ind) || 0) + 1);
  }
  const me = (all || []).find((m) => m.id === userId);
  const savedPeople = (savedRows || []).map((r) => byId.get(r.contact_id)).filter(Boolean);
  const topIndustries = [...industries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([k, v]) => `${k} (${v})`).join(", ");

  let system = `You are the concierge for the MasterClass Executive cohort map — a private directory of ${byId.size} executives in this cohort, shown as squares on a 3D globe.
You help members find classmates (by industry, niche, location, expertise, what they're looking for or can help with), suggest who to meet, and take feature suggestions.

How to work:
- For any "find people" request, call search_members. Use keywords with synonyms AND a plain-language query; add near_lat/near_lng/radius_km (from your own knowledge of the place) for location requests. Try a second search if the first is thin.
- Then call highlight_members with the ids of the people who are actually relevant (skip weak matches), and a focus point when location matters. If nobody matches, say so and call highlight_members with an empty list.
- Reply briefly in plain text (no markdown tables or headers). Name the best few people with title/company/city and one line on why they fit. Mention how many are lit up on the map.
- If the user gives feedback or a feature idea, call save_suggestion and thank them.
- Only use facts from tool results. Never invent members or contact details.
- Refer to people by name; never guess gendered pronouns.

Cohort industries: ${topIndustries || "none yet"}.
The person asking: ${me ? JSON.stringify(byId.get(me.id)) : "has not created a profile yet"}.
Their saved contacts (private to them; ${savedPeople.length}): ${savedPeople.length ? JSON.stringify(savedPeople) : "none yet"}.
When they ask about "my saved contacts" / "people I saved", answer from that list and highlight those ids.`;
  if (mode === "voice") {
    system += `

You are speaking out loud in a live voice conversation. Keep answers short and natural (1-3 sentences), never read out ids, lists of tags or URLs, and say names clearly. Briefly say what you're doing before searching (e.g. "Let me look."). The person sees the globe while you talk, so mention that matches are lit up on the map.`;
  }
  return { userId, hasProfile: !!me, byId, system };
}

export type ToolEffect = { matchIds?: string[]; focus?: { lat: number; lng: number; zoom: number } };

// Runs one concierge tool call. Never throws; errors become a tool result.
export async function runTool(call: Pick<FunctionCall, "name" | "args">, ctx: ConciergeContext): Promise<{ output: Record<string, unknown>; effect: ToolEffect }> {
  const args = (call.args || {}) as Record<string, unknown>;
  const effect: ToolEffect = {};
  try {
    if (call.name === "search_members") {
      const people = await searchMembers(args, ctx.byId);
      return { output: { count: people.length, people }, effect };
    }
    if (call.name === "highlight_members") {
      const ids = Array.isArray(args.member_ids)
        ? args.member_ids.filter((id): id is string => typeof id === "string" && ctx.byId.has(id))
        : [];
      effect.matchIds = ids;
      const lat = args.focus_lat, lng = args.focus_lng;
      if (typeof lat === "number" && typeof lng === "number") {
        const zoom = typeof args.focus_zoom === "number" ? args.focus_zoom : 5;
        effect.focus = { lat, lng, zoom: Math.min(Math.max(zoom, 0.8), 12) };
      }
      return { output: { highlighted: ids.length }, effect };
    }
    if (call.name === "save_suggestion") {
      const text = String(args.text || "").trim().slice(0, 4000);
      if (!text) throw new Error("empty suggestion");
      const { error } = await adminClient().from("suggestions").insert({ member_id: ctx.hasProfile ? ctx.userId : null, body: text });
      if (error) throw error;
      return { output: { saved: true }, effect };
    }
    return { output: { error: "unknown tool" }, effect };
  } catch (e) {
    console.error("tool failed", call.name, e);
    return { output: { error: "tool failed" }, effect };
  }
}
