import type { Member } from "./types";

// Dev-only fake cohort for previewing the UI (`/map?demo=1` under `npm run dev`).
const CITIES: [string, string, string, number, number][] = [
  ["Seattle", "Washington", "United States", 47.61, -122.33], ["New York", "New York", "United States", 40.71, -74.0],
  ["Austin", "Texas", "United States", 30.27, -97.74], ["Miami", "Florida", "United States", 25.76, -80.19],
  ["London", "England", "United Kingdom", 51.51, -0.13], ["Toronto", "Ontario", "Canada", 43.65, -79.38],
  ["Dubai", "", "United Arab Emirates", 25.2, 55.27], ["Sydney", "NSW", "Australia", -33.87, 151.21],
  ["São Paulo", "SP", "Brazil", -23.55, -46.63], ["Berlin", "", "Germany", 52.52, 13.4],
  ["Singapore", "", "Singapore", 1.35, 103.82], ["Los Angeles", "California", "United States", 34.05, -118.24],
  ["Chicago", "Illinois", "United States", 41.88, -87.63], ["Mexico City", "", "Mexico", 19.43, -99.13],
  ["Lagos", "", "Nigeria", 6.52, 3.38], ["Mumbai", "", "India", 19.08, 72.88],
];
const INDUSTRIES = ["Healthcare", "Real Estate", "Software & SaaS", "Financial Services", "Consumer Goods", "Marketing & Advertising", "Hospitality", "AI & Machine Learning"];
const FIRST = ["Ava", "Marcus", "Priya", "Daniel", "Sofia", "James", "Leila", "Ethan", "Grace", "Omar", "Chloe", "Ryan", "Nina", "Victor", "Hannah", "Diego"];
const LAST = ["Chen", "Okafor", "Patel", "Reyes", "Novak", "Hughes", "Haddad", "Park", "Silva", "Brooks", "Klein", "Ward", "Sato", "Moreau", "Lind", "Ruiz"];

export function demoMembers(n = 140): Member[] {
  return Array.from({ length: n }, (_, i) => {
    const c = CITIES[(i * 7) % CITIES.length];
    const ind = INDUSTRIES[(i * 5) % INDUSTRIES.length];
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
    return {
      id: `demo-${i}-${name}`, full_name: name, email: "demo@example.com", phone: "+12065550100",
      city: c[0], region: c[1], country: c[2], lat: c[3], lng: c[4],
      company: `${LAST[(i * 5) % LAST.length]} ${["Group", "Labs", "Partners", "Health", "Capital"][i % 5]}`,
      title: ["CEO", "Founder", "COO", "VP Sales", "Managing Partner"][i % 5],
      industry: ind, ai_industry: ind, bio: `Leads a ${ind.toLowerCase()} business in ${c[0]}.`,
      looking_for: "Partners and intros", can_help_with: "Scaling teams, go-to-market",
      linkedin: "linkedin.com/in/demo", instagram: "@demo", facebook: "demo", x: "@demo", tiktok: null,
      youtube: null, website: "example.com", whatsapp: "+12065550100",
      tags: [ind.toLowerCase(), "founder", "growth"], avatar_url: null, ai_summary: `${name} runs a ${ind.toLowerCase()} company based in ${c[0]}.`,
    };
  });
}
