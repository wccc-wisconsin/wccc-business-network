#!/usr/bin/env node
/**
 * Verifies the Grants.gov Search2 contract that lib/grantsGov.ts is built on.
 *
 * Why this exists: lib/grantsGov.ts was written without ever making a live call.
 * The sandboxes it was developed in block api.grants.gov at the network layer,
 * so its request and response shapes come from the published documentation
 * (https://grants.gov/api/common/search2) and the code table
 * (https://www.grants.gov/api/status-codes) rather than from an observed
 * response. The code parses defensively and fails closed, so a shape mismatch
 * degrades to "couldn't load opportunities" rather than to wrong data — but
 * "degrades safely" is not the same as "works", and only a real call settles it.
 *
 * Run this from a machine with ordinary internet access — not from the Claude
 * sandbox, which cannot reach the host:
 *
 *     node scripts/check-grants-api.mjs
 *
 * No dependencies, no API key, no build step. It makes exactly one request.
 *
 * Exit code 0 means every assumption held. Non-zero means at least one did not,
 * and the output says which — fix lib/grantsGov.ts to match what actually came
 * back before putting this in front of members.
 */

const SEARCH2_URL = "https://api.grants.gov/v1/api/search2";

// Must stay identical to the constants in lib/grantsGov.ts. If you change them
// there, change them here — this check is only worth running if it checks the
// request the app actually makes.
const ELIGIBILITIES = "23|99";
const OPP_STATUSES = "forecasted|posted";
const EXPECTED_ELIGIBILITY_LABELS = { 23: "small business", 99: "unrestricted" };

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const body = {
  keyword: "small business",
  eligibilities: ELIGIBILITIES,
  oppStatuses: OPP_STATUSES,
  rows: 10,
  startRecordNum: 0,
};

console.log(`POST ${SEARCH2_URL}`);
console.log(`${JSON.stringify(body)}\n`);

let res;
try {
  res = await fetch(SEARCH2_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
} catch (error) {
  console.error("Request failed before a response arrived:", error.message);
  console.error("\nIf this is a DNS or connection error, you are probably running");
  console.error("inside a sandbox with an egress allowlist. Run it elsewhere.");
  process.exit(2);
}

console.log(`HTTP ${res.status}\n`);
check("HTTP 200", res.status === 200, `got ${res.status}`);

let payload;
try {
  payload = await res.json();
} catch (error) {
  console.error("Response was not JSON:", error.message);
  process.exit(2);
}

console.log("Response contract:");
check("errorcode is 0", payload?.errorcode === 0, `errorcode=${payload?.errorcode} msg=${payload?.msg}`);
check("data is an object", payload?.data && typeof payload.data === "object");

const data = payload?.data ?? {};
check("data.hitCount is a number", typeof data.hitCount === "number", `got ${typeof data.hitCount}`);
check("data.oppHits is an array", Array.isArray(data.oppHits));
check("at least one hit returned", Array.isArray(data.oppHits) && data.oppHits.length > 0,
  "an empty result is not necessarily a bug, but nothing below can be checked");

const hit = Array.isArray(data.oppHits) ? data.oppHits[0] : undefined;
if (hit) {
  console.log("\nFirst hit — fields lib/grantsGov.ts reads:");
  console.log(JSON.stringify(hit, null, 2));
  console.log("");

  check("hit.id is a non-empty string", typeof hit.id === "string" && hit.id.length > 0);
  check("hit.title is a non-empty string", typeof hit.title === "string" && hit.title.length > 0);
  check("hit.number is a string", typeof hit.number === "string");
  check("hit.oppStatus is a string", typeof hit.oppStatus === "string");

  // The agency's display name. The documentation calls this field `agencyName`;
  // the live endpoint sends `agency`. That mismatch is exactly what the first
  // run of this script caught, so the check asks the question that matters —
  // "is there a readable agency name under one of these keys" — rather than
  // pinning one spelling.
  const agencyName =
    typeof hit.agency === "string" && hit.agency
      ? hit.agency
      : typeof hit.agencyName === "string" && hit.agencyName
        ? hit.agencyName
        : "";
  check(
    "a readable agency name is present (agency or agencyName)",
    agencyName !== "",
    `agency=${JSON.stringify(hit.agency)} agencyName=${JSON.stringify(hit.agencyName)} — lib/grantsGov.ts would fall back to the agency code`,
  );

  // The date format is the single most breakable assumption: parseGrantsDate()
  // accepts MM/DD/YYYY and returns null for anything else, so a format change
  // would silently drop every deadline rather than show a wrong one.
  const dated = data.oppHits.filter((h) => typeof h.closeDate === "string" && h.closeDate.trim() !== "");
  if (dated.length === 0) {
    console.log("  SKIP  closeDate format — no hit in this page had one");
  } else {
    const bad = dated.filter((h) => !/^\d{2}\/\d{2}\/\d{4}$/.test(h.closeDate.trim()));
    check(
      `closeDate is MM/DD/YYYY on all ${dated.length} dated hits`,
      bad.length === 0,
      bad.length > 0 ? `e.g. ${JSON.stringify(bad[0].closeDate)}` : "",
    );
  }

  // Confirms the status filter is honoured server-side rather than ignored.
  const statuses = [...new Set(data.oppHits.map((h) => String(h.oppStatus ?? "").toLowerCase()))];
  check(
    "no closed or archived opportunities returned",
    !statuses.includes("closed") && !statuses.includes("archived"),
    `statuses present: ${statuses.join(", ")}`,
  );
}

// The eligibility codes are the other assumption worth pinning down: they came
// from a published table, and filtering on the wrong code is the kind of bug
// that returns plausible results and no error.
console.log("\nEligibility codes:");
if (!Array.isArray(data.eligibilities)) {
  check("data.eligibilities is an array", false, `got ${typeof data.eligibilities}`);
} else {
  for (const [code, fragment] of Object.entries(EXPECTED_ELIGIBILITY_LABELS)) {
    const entry = data.eligibilities.find((e) => String(e?.value) === code);
    if (!entry) {
      console.log(`  SKIP  code ${code} — not present in this result set's facet`);
      continue;
    }
    check(
      `code ${code} still means "${fragment}"`,
      String(entry.label ?? "").toLowerCase().includes(fragment),
      `label is "${entry.label}" — update lib/grantsGov.ts`,
    );
  }
  console.log("\n  Full facet returned:");
  for (const e of data.eligibilities) console.log(`    ${e?.value}  ${e?.label}  (${e?.count})`);
}

console.log("");
if (failures === 0) {
  console.log("All assumptions in lib/grantsGov.ts held.");
  process.exit(0);
}
console.log(`${failures} assumption(s) did not hold — see FAIL lines above.`);
process.exit(1);
