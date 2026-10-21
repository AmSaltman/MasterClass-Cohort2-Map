import { connection } from "next/server";
import { adminClient, errorResponse, PUBLIC_COLUMNS, requireUser, toPublic } from "@/lib/server";

// The whole cohort for signed-in members, with hidden emails/phones removed.
export async function GET(req: Request) {
  await connection(); // per-user data: never prerender
  try {
    const user = await requireUser(req);
    const { data, error } = await adminClient()
      .from("members")
      .select(PUBLIC_COLUMNS)
      .order("full_name")
      .limit(5000);
    if (error) throw error;
    const rows = (data || []) as unknown as Record<string, unknown>[];
    return Response.json({
      me: user.id,
      hasProfile: rows.some((r) => r.id === user.id),
      members: rows.map(toPublic),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
