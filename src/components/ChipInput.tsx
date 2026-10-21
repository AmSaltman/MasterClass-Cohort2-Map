"use client";
import { useState } from "react";
import { I } from "./Icons";

// Type and press Enter or comma to add; Backspace on empty removes the last.
// Pasting "AI, Web, Search" adds all three.
export function ChipInput({
  id, values, onChange, placeholder, max = 8, lowercase = false,
}: {
  id: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; lowercase?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const next = [...values];
    for (let part of raw.split(",")) {
      part = part.trim().replace(/\s+/g, " ");
      if (lowercase) part = part.toLowerCase();
      if (part && next.length < max && !next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part.slice(0, 60));
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="chip-input" onClick={() => document.getElementById(id)?.focus()}>
      {values.map((v) => (
        <span key={v} className="chip-tag">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><I.close width={12} height={12} /></button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={values.length ? "" : placeholder}
        disabled={values.length >= max}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) add(draft); }
          if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
    </div>
  );
}
