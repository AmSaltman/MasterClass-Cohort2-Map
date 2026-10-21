"use client";
import { useRef, useState } from "react";
import { Square } from "./Square";

// Center-crops to a square and re-encodes as a 512px JPEG in the browser.
// Keeps uploads small and strips photo metadata (e.g. GPS) before upload.
export async function toSquareJpeg(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that image."))), "image/jpeg", 0.86));
}

export type AvatarChange = { blob: Blob | null; remove: boolean };

export function AvatarPicker({ seed, current, onChange }: { seed: string; current: string | null; onChange: (c: AvatarChange) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/^image\//.test(file.type)) return setError("Please choose an image.");
    try {
      const blob = await toSquareJpeg(file);
      setPreview(URL.createObjectURL(blob));
      onChange({ blob, remove: false });
    } catch {
      setError("Couldn't read that image — try a JPG or PNG.");
    }
  }

  return (
    <div className="avatar-pick">
      <button type="button" className="avatar-frame sq-host" onClick={() => input.current?.click()} aria-label="Choose a profile picture">
        {preview ? <img src={preview} alt="Your profile picture" /> : <Square seed={seed} />}
      </button>
      <div className="avatar-actions">
        <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>{preview ? "Change photo" : "Upload photo"}</button>
        {preview && (
          <button type="button" className="muted" style={{ fontSize: 13, textDecoration: "underline" }}
            onClick={() => { setPreview(null); onChange({ blob: null, remove: true }); if (input.current) input.current.value = ""; }}>
            Remove
          </button>
        )}
        <span className="hint">Square crop, shown on your profile and in the directory. Your square stays on the map.</span>
        {error && <span className="error">{error}</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
