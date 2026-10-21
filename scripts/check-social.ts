// Run: npm run check — verifies member-supplied links can't become unsafe URLs.
import assert from "node:assert/strict";
import { dmUrl, profileUrl, whatsappUrl } from "../src/lib/social.ts";

assert.equal(profileUrl("website", "javascript:alert(1)"), null);
assert.equal(profileUrl("website", "acme.com"), "https://acme.com/");
assert.equal(profileUrl("linkedin", "https://www.linkedin.com/in/jane-doe/"), "https://www.linkedin.com/in/jane-doe/");
assert.equal(profileUrl("linkedin", "jane-doe"), "https://www.linkedin.com/in/jane-doe");
assert.equal(profileUrl("instagram", "@jane.doe"), "https://instagram.com/jane.doe");
assert.equal(profileUrl("x", "javascript:alert(1)"), "https://x.com/javascriptalert1");
assert.equal(dmUrl("instagram", "https://instagram.com/jane.doe/"), "https://ig.me/m/jane.doe");
assert.equal(dmUrl("facebook", "facebook.com/jane"), "https://m.me/jane");
assert.equal(whatsappUrl("+1 (206) 555-0100"), "https://wa.me/12065550100");
assert.equal(whatsappUrl("123"), null);
console.log("social link checks passed");
