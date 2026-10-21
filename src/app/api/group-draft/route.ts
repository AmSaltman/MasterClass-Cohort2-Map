import { z } from "zod";
import { adminClient, errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";
import { CHAT_MODEL, gemini } from "@/lib/gemini";

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  note: z.string().trim().max(500).default(""),
});

const SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "Short subject line." },
    body: { type: "string", description: "The email body." },
  },
  required: ["subject", "body"],
};

// Drafts one group email from the signed-in member to the selected classmates.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`group-draft:${user.id}`, 15, 60_000);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Select at least one person.");

    const db = adminClient();
    const [{ data: me }, { data: them }] = await Promise.all([
      db.from("members").select("full_name,title,company,industries,city,bio,looking_for").eq("id", user.id).maybeSingle(),
      db.from("members").select("industries,city,region,country").in("id", parsed.data.ids),
    ]);
    if (!me) throw new HttpError(400, "Create your profile first.");
    const count = (them || []).length;
    const tally = (vals: (string | null | undefined)[]) => {
      const m = new Map<string, number>();
      vals.filter(Boolean).forEach((v) => m.set(v!, (m.get(v!) || 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} (${n})`).join(", ");
    };
    const group = {
      count,
      common_places: tally((them || []).map((t) => t.region || t.city)),
      common_industries: tally((them || []).flatMap((t) => (t.industries as string[]) || [])),
    };

    const res = await gemini().models.generateContent({
      model: CHAT_MODEL,
      contents: `Write one short group email (under 120 words) from SENDER to a group of classmates in the MasterClass Executive cohort. Warm, specific, executive tone; no emojis, no placeholders like [Name] — address the group (e.g. "Hi all,"). Sign off with the sender's first name.
${parsed.data.note ? `What the sender wants: ${parsed.data.note}` : "If the sender gave no purpose, suggest connecting based on what the group has in common (e.g. an informal meetup or intro call)."}

SENDER: ${JSON.stringify(me)}
GROUP: ${JSON.stringify(group)}`,
      config: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, thinkingConfig: { thinkingLevel: "LOW" as never } },
    });
    const out = JSON.parse(res.text || "{}") as { subject?: string; body?: string };
    return Response.json({ subject: (out.subject || "").slice(0, 200), body: (out.body || "").slice(0, 2000) });
  } catch (err) {
    return errorResponse(err);
  }
}
