// Shape of a member as the browser sees it (private fields already stripped).
export type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  company: string | null;
  title: string | null;
  industry: string | null;
  industries: string[];
  ai_industry: string | null;
  bio: string | null;
  looking_for: string | null;
  can_help_with: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  x: string | null;
  tiktok: string | null;
  youtube: string | null;
  website: string | null;
  whatsapp: string | null;
  tags: string[];
  ai_summary: string | null;
  avatar_url: string | null;
};

// What a member can edit about themselves.
export type ProfileInput = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  company: string;
  title: string;
  industries: string[];
  bio: string;
  looking_for: string;
  can_help_with: string;
  linkedin: string;
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
  youtube: string;
  website: string;
  whatsapp: string;
  show_email: boolean;
  show_phone: boolean;
  // What the AI says about them — editable by the member.
  ai_summary: string;
  tags: string[];
};

export const EMPTY_PROFILE: ProfileInput = {
  full_name: "", email: "", phone: "", city: "", region: "", country: "",
  lat: null, lng: null, company: "", title: "", industries: [], bio: "",
  looking_for: "", can_help_with: "", linkedin: "", instagram: "", facebook: "",
  x: "", tiktok: "", youtube: "", website: "", whatsapp: "",
  show_email: true, show_phone: false, ai_summary: "", tags: [],
};

export type ChatTurn = { role: "user" | "assistant"; text: string; voice?: boolean; live?: boolean };

export type AssistantReply = {
  reply: string;
  matchIds: string[] | null; // null = leave the map as it is
  focus: { lat: number; lng: number; zoom: number } | null;
  // A group the AI selected for a group email, with an optional draft.
  select?: GroupSelection | null;
};

export type GroupSelection = { ids: string[]; subject?: string; body?: string };
