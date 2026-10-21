import { Modality } from "@google/genai";
import { errorResponse, rateLimit, requireUser } from "@/lib/server";
import { gemini, LIVE_MODEL } from "@/lib/gemini";
import { loadContext, TOOLS } from "@/lib/concierge";

// Issues a single-use, short-lived Gemini Live token for voice mode. The
// model, voice, instructions and tools are locked into the token, so the
// browser never sees the API key and can't change what the concierge does.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`live:${user.id}`, 10, 10 * 60_000);
    const ctx = await loadContext(user.id, "voice");
    const now = Date.now();
    const token = await gemini().authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
            systemInstruction: ctx.system,
            tools: [{ functionDeclarations: TOOLS }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    if (!token.name) throw new Error("no token returned");
    return Response.json({ token: token.name, model: LIVE_MODEL });
  } catch (err) {
    return errorResponse(err);
  }
}
