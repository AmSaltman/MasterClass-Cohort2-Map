import { connection } from "next/server";
import { z } from "zod";
import { adminClient, errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";

const Body = z.object({ id: z.string().uuid() });

// The signed-in member's saved contacts (ids only; profiles come from /api/members).
export async function GET(req: Request) {
  await connection();
  try {
    const user = await requireUser(req);
    const { data, error } = await adminClient()
      .from("saved_contacts").select("contact_id").eq("member_id", user.id).order("created_at");
    if (error) throw error;
    return Response.json({ ids: (data || []).map((r) => r.contact_id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`saved:${user.id}`, 60, 60_000);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Invalid contact.");
    if (parsed.data.id === user.id) throw new HttpError(400, "You can't save yourself.");
    const { error } = await adminClient()
      .from("saved_contacts")
      .upsert({ member_id: user.id, contact_id: parsed.data.id }, { onConflict: "member_id,contact_id", ignoreDuplicates: true });
    if (error) {
      if (error.code === "23503") throw new HttpError(400, "Create your profile first, or that member no longer exists.");
      throw error;
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, "Invalid contact.");
    const { error } = await adminClient()
      .from("saved_contacts").delete().eq("member_id", user.id).eq("contact_id", parsed.data.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
