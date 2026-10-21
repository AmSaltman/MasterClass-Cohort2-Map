import { z } from "zod";
import { adminClient, errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";
import { CHAT_MODEL, gemini } from "@/lib/gemini";

const Body = z.object({ to: z.string().uuid() });
const COLS = "full_name,title,company,industries,city,country,bio,looking_for,can_help_with,ai_summary";

// Drafts a short, personal first message from the signed-in member to a classmate.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`intro:${user.id}`, 15, 60_000);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");

    const db = adminClient();
    const [{ data: me }, { data: them }] = await Promise.all([
      db.from("members").select(COLS).eq("id", user.id).maybeSingle(),
      db.from("members").select(COLS).eq("id", parsed.data.to).maybeSingle(),
    ]);
    if (!them) throw new HttpError(404, "That member wasn't found.");
    if (!me) throw new HttpError(400, "Create your profile first so the intro can mention you.");

    const res = await gemini().models.generateContent({
      model: CHAT_MODEL,
      contents: `Write a short first message (60-90 words) from ME to THEM, two classmates in the MasterClass Executive cohort. Warm, specific, executive tone, no flattery or emojis. Reference one concrete overlap or reason to connect, and end with a light, specific ask (e.g. a 20-minute call). Output only the message text, starting with "Hi ${them.full_name.split(" ")[0]},".

ME: ${JSON.stringify(me)}
THEM: ${JSON.stringify(them)}`,
      config: { thinkingConfig: { thinkingLevel: "LOW" as never } },
    });
    return Response.json({ text: (res.text || "").trim() });
  } catch (err) {
    return errorResponse(err);
  }
}
