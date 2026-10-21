import { z } from "zod";
import { adminClient, errorResponse, HttpError, rateLimit } from "@/lib/server";

const Body = z.object({
  code: z.string().trim().max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  full_name: z.string().trim().min(1).max(120),
});

// Creates a cohort account. Gated by a shared cohort access code so the
// directory (phones, emails) stays inside the cohort.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    rateLimit(`join:${ip}`, 10, 10 * 60_000);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Check the form and try again.");
    const { code, email, password, full_name } = parsed.data;

    const expected = (process.env.COHORT_ACCESS_CODE || "").trim().toUpperCase();
    if (!expected) throw new HttpError(500, "Signups aren't open yet (no cohort code configured).");
    if (code.toUpperCase() !== expected) throw new HttpError(403, "That cohort access code isn't right.");

    const { error } = await adminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        throw new HttpError(409, "You already have an account — sign in instead.");
      }
      throw error;
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
