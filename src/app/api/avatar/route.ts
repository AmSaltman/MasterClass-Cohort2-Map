import { adminClient, errorResponse, HttpError, rateLimit, requireUser } from "@/lib/server";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Checks the file's magic bytes so a renamed non-image can't be stored.
function sniff(buf: Uint8Array): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45) return "image/webp";
  return null;
}

async function removeOld(userId: string) {
  const db = adminClient();
  const { data } = await db.storage.from("avatars").list(userId);
  if (data?.length) await db.storage.from("avatars").remove(data.map((f) => `${userId}/${f.name}`));
}

// Uploads (or replaces) the signed-in member's profile picture.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    rateLimit(`avatar:${user.id}`, 10, 10 * 60_000);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Choose an image to upload.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "That image is too large (max 2 MB).");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniff(bytes);
    if (!type) throw new HttpError(415, "Please use a JPG, PNG or WebP image.");

    const db = adminClient();
    const { data: member } = await db.from("members").select("id").eq("id", user.id).maybeSingle();
    if (!member) throw new HttpError(400, "Save your profile first.");

    await removeOld(user.id);
    const path = `${user.id}/${crypto.randomUUID()}.${TYPES[type]}`;
    const { error: upErr } = await db.storage.from("avatars").upload(path, bytes, { contentType: type, upsert: false });
    if (upErr) throw upErr;
    const url = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await db.from("members").update({ avatar_url: url }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ url });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    await removeOld(user.id);
    const { error } = await adminClient().from("members").update({ avatar_url: null }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
