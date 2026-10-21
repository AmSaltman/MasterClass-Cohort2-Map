import { z } from "zod";
import { errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";
import { loadContext, runTool } from "@/lib/concierge";

const Body = z.object({
  name: z.enum(["search_members", "highlight_members", "save_suggestion", "select_members"]),
  args: z.record(z.string(), z.unknown()).default({}),
});

// Runs a tool call that Gemini Live asked for during a voice session, with the
// signed-in member's permissions (same code path as the text concierge).
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`live-tool:${user.id}`, 60, 60_000);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Invalid tool call.");
    const ctx = await loadContext(user.id, "voice");
    const { output, effect } = await runTool(parsed.data, ctx);
    return Response.json({ output, effect });
  } catch (err) {
    return errorResponse(err);
  }
}
