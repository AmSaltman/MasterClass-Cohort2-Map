import { z } from "zod";
import type { Content } from "@google/genai";
import { errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";
import { CHAT_MODEL, gemini } from "@/lib/gemini";
import { loadContext, runTool, TOOLS } from "@/lib/concierge";
import type { AssistantReply } from "@/lib/types";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .min(1)
    .max(30),
});

// Text concierge: Gemini Flash with tools, looping until it answers.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`assistant:${user.id}`, 20, 60_000);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Invalid message.");

    const ctx = await loadContext(user.id, "text");
    const contents: Content[] = parsed.data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));
    const result: AssistantReply = { reply: "", matchIds: null, focus: null };

    for (let step = 0; step < 6; step++) {
      const res = await gemini().models.generateContent({
        model: CHAT_MODEL,
        contents,
        config: {
          systemInstruction: ctx.system,
          tools: [{ functionDeclarations: TOOLS }],
          thinkingConfig: { thinkingLevel: "LOW" as never },
        },
      });
      const calls = res.functionCalls || [];
      const modelContent = res.candidates?.[0]?.content;
      if (!calls.length || !modelContent) {
        result.reply = (res.text || "").trim() || "I couldn't come up with an answer — try rephrasing?";
        break;
      }
      contents.push(modelContent); // keeps Gemini's thought signatures intact
      const responses = await Promise.all(
        calls.map(async (call) => {
          const { output, effect } = await runTool(call, ctx);
          if (effect.matchIds) result.matchIds = effect.matchIds;
          if (effect.focus) result.focus = effect.focus;
          return { functionResponse: { id: call.id, name: call.name, response: output } };
        }),
      );
      contents.push({ role: "user", parts: responses });
    }

    if (!result.reply) result.reply = "Here's what I found on the map.";
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
