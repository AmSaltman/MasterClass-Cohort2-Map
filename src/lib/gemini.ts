import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ProfileInput } from "./types";

export const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2";
export const EMBED_DIMS = 768; // must match vector(768) in supabase/schema.sql

let ai: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function embed(text: string, kind: "document" | "query"): Promise<number[] | null> {
  try {
    const res = await gemini().models.embedContent({
      model: EMBED_MODEL,
      contents: [text.slice(0, 8000)],
      config: {
        outputDimensionality: EMBED_DIMS,
        taskType: kind === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
      },
    });
    const values = res.embeddings?.[0]?.values;
    return values && values.length === EMBED_DIMS ? values : null;
  } catch (err) {
    // Search still works on keywords + location if embeddings fail.
    console.error("embed failed", err);
    return null;
  }
}

const Enrichment = z.object({
  industry: z.string().max(60),
  tags: z.array(z.string().max(40)).max(20),
  summary: z.string().max(400),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});
export type Enrichment = z.infer<typeof Enrichment>;

const ENRICH_SCHEMA = {
  type: "object",
  properties: {
    industry: {
      type: "string",
      description:
        "One normalized industry label in Title Case, e.g. 'Healthcare', 'Real Estate', 'Financial Services', 'Consumer Goods', 'Software & SaaS', 'Media & Entertainment', 'Education', 'Hospitality', 'Manufacturing', 'Energy', 'Legal', 'Nonprofit', 'Marketing & Advertising', 'AI & Machine Learning'.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description:
        "8-15 lowercase search keywords: skills, sub-industries, roles, markets, and common synonyms someone might search for (e.g. 'medtech', 'hospitals', 'fundraising', 'b2b saas', 'founder').",
    },
    summary: {
      type: "string",
      description: "1-2 sentence third-person summary of who this person is and what they do. Plain, factual, no hype.",
    },
    lat: { type: ["number", "null"], description: "Latitude of the city center, or null if unknown." },
    lng: { type: ["number", "null"], description: "Longitude of the city center, or null if unknown." },
  },
  required: ["industry", "tags", "summary", "lat", "lng"],
};

// Turns a raw profile into normalized, searchable fields.
export async function enrichProfile(p: ProfileInput): Promise<Enrichment | null> {
  const profile = {
    name: p.full_name, title: p.title, company: p.company, industry: p.industry,
    location: [p.city, p.region, p.country].filter(Boolean).join(", "),
    bio: p.bio, looking_for: p.looking_for, can_help_with: p.can_help_with,
    website: p.website,
  };
  try {
    const res = await gemini().models.generateContent({
      model: CHAT_MODEL,
      contents: `Organize this executive's cohort profile so classmates can find them by search.\n\n${JSON.stringify(profile)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: ENRICH_SCHEMA,
        thinkingConfig: { thinkingLevel: "LOW" as never },
      },
    });
    const parsed = Enrichment.safeParse(JSON.parse(res.text || "{}"));
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      industry: parsed.data.industry.trim(),
      tags: [...new Set(parsed.data.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 15),
    };
  } catch (err) {
    console.error("enrich failed", err);
    return null;
  }
}

export function buildSearchText(p: ProfileInput, e: Enrichment | null): string {
  return [
    p.full_name, p.title, p.company, p.industry, e?.industry,
    [p.city, p.region, p.country].filter(Boolean).join(", "),
    p.bio, p.looking_for && `Looking for: ${p.looking_for}`,
    p.can_help_with && `Can help with: ${p.can_help_with}`,
    e?.tags.join(", "), e?.summary,
  ].filter(Boolean).join("\n");
}
