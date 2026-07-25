// Milestone 9 — timed end-to-end run of all 15 docs/prompt.md workflow
// steps, driven directly against the REST API (same approach as every
// prior milestone's "Verified live" walkthrough, scripted here so it's
// reproducible and produces a hard timing number for the "<5 minutes"
// success criterion per docs/implementation_plan.md §1).
//
// Requires dpm sandbox, the agents service, and this backend all running
// (see docs/deployment.md's "Local development" section). Run with:
//   npx tsx scripts/e2e-timed.ts
const BASE = process.env.BACKEND_URL ?? "http://localhost:4000";

interface StepTiming {
  step: string;
  ms: number;
}
const timings: StepTiming[] = [];

async function timed<T>(step: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  timings.push({ step, ms: Date.now() - start });
  return result;
}

async function req(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return json;
}

async function login(email: string): Promise<{ token: string; party: string }> {
  const res = await req("POST", "/auth/login", undefined, { email });
  return { token: res.token, party: res.party };
}

const suffix = Date.now().toString(36);

async function main() {
  // --- Setup (not one of the 15 steps — org/user onboarding is Milestone 1's
  // gate, not this one; timing starts at Step 1 below) ---
  const setupStart = Date.now();
  const { token: opToken } = await login("operator@amanax.dev");

  async function onboard(role: string, name: string, email: string) {
    const org = await req("POST", "/orgs", opToken, { name, role });
    await req("POST", "/users", opToken, {
      org: org.party,
      userId: `${role.toLowerCase()}-${suffix}`,
      email,
      displayName: name,
      role,
    });
    const { token, party } = await login(email);
    return { token, party };
  }

  const fundManager = await onboard("FundManager", `FM E2E ${suffix}`, `fm-${suffix}@amanax.dev`);
  const issuingHouse = await onboard("IssuingHouse", `IH E2E ${suffix}`, `ih-${suffix}@amanax.dev`);
  const shariahAdvisor = await onboard("ShariahAdvisor", `SA E2E ${suffix}`, `sa-${suffix}@amanax.dev`);
  const trustee = await onboard("Trustee", `Trustee E2E ${suffix}`, `tr-${suffix}@amanax.dev`);
  const sec = await onboard("SEC", `SEC E2E ${suffix}`, `sec-${suffix}@amanax.dev`);
  const distributor = await onboard("Distributor", `Distributor E2E ${suffix}`, `di-${suffix}@amanax.dev`);
  const custodian = await onboard("Custodian", `Custodian E2E ${suffix}`, `cu-${suffix}@amanax.dev`);
  const setupMs = Date.now() - setupStart;

  const overallStart = Date.now();

  // --- Step 1: Fund Manager proposes ---
  const proposal = await timed("Step 1 — FundManager proposes", () =>
    req("POST", "/proposals", fundManager.token, {
      issuingHouse: issuingHouse.party,
      productName: `E2E Ijarah Note ${suffix}`,
      description: "Timed end-to-end verification run for Milestone 9.",
      proposedType: "Ijarah",
      targetSizeNGN: 50_000_000,
      tenorMonths: 12,
    }),
  );

  // --- Step 2 + Step 3: Issuing House structures + AI recommendation ---
  await timed("Step 3 — AI Product Structuring Agent recommends", () =>
    req("POST", `/proposals/${proposal.contractId}/structuring-recommendation`, issuingHouse.token),
  );
  const structure = await timed("Step 2 — IssuingHouse structures the proposal", () =>
    req("POST", `/proposals/${proposal.contractId}/structure`, issuingHouse.token, {
      structureType: "Ijarah",
      profitMechanism: "Fixed rental income distributed quarterly",
      minSubscriptionNGN: 100_000,
      redemptionTerms: "Bullet redemption at tenor end",
      structureTenorMonths: 12,
    }),
  );

  // --- Step 4: Issuing House finalizes ---
  const finalized = await timed("Step 4 — IssuingHouse finalizes structure", () =>
    req("POST", `/structures/${structure.contractId}/finalize`, issuingHouse.token),
  );

  // --- Step 5: Shariah Advisor reviews and certifies ---
  const shariahReview = await timed("Step 5 — Shariah review submitted", () =>
    req("POST", `/structures/${finalized.contractId}/submit-shariah-review`, issuingHouse.token, {
      shariahAdvisor: shariahAdvisor.party,
    }),
  );
  const certified = await timed("Step 5 — Shariah Advisor certifies", () =>
    req("POST", `/shariah-reviews/${shariahReview.contractId}/certify`, shariahAdvisor.token, {
      certificationNotes: "Structure conforms to Ijarah principles; underlying asset ownership verified.",
    }),
  );

  // --- Step 6: Trustee reviews and approves ---
  const trusteeReview = await timed("Step 6 — Trustee review submitted", () =>
    req("POST", `/shariah-reviews/${certified.contractId}/submit-trustee-review`, issuingHouse.token, {
      trustee: trustee.party,
    }),
  );
  const approvedReview = await timed("Step 6 — Trustee approves", () =>
    req("POST", `/trustee-reviews/${trusteeReview.contractId}/approve`, trustee.token, {
      approvalNotes: "Governance and investor-protection terms are adequate for this issuance.",
    }),
  );

  // --- Step 7: AI Compliance Agent validates ---
  await timed("Step 7 — AI Compliance Agent validates readiness", () =>
    req("POST", `/trustee-reviews/${approvedReview.contractId}/compliance-check`, issuingHouse.token),
  );

  // --- Step 8: Issuing House submits to SEC ---
  const submission = await timed("Step 8 — IssuingHouse submits to SEC", () =>
    req("POST", `/trustee-reviews/${approvedReview.contractId}/submit-to-sec`, issuingHouse.token, {
      sec: sec.party,
    }),
  );

  // --- Step 9: SEC reviews and approves ---
  const approval = await timed("Step 9 — SEC approves", () =>
    req("POST", `/regulatory-submissions/${submission.contractId}/approve`, sec.token, {
      approvalReference: `SEC/AMX/E2E/${suffix}`,
    }),
  );

  // --- Step 10: Investment Note is issued ---
  const note = await timed("Step 10 — Note issued", () =>
    req("POST", `/sec-approvals/${approval.contractId}/issue`, issuingHouse.token, {
      symbol: `E2E${suffix}`.toUpperCase().slice(0, 20),
      parValueNGN: 1_000_000,
    }),
  );

  // --- Step 11: Investor completes onboarding ---
  const investorEmail = `investor-${suffix}@amanax.dev`;
  const investorProfile = await timed("Step 11 — Investor signs up", () =>
    req("POST", "/investor-signup", undefined, {
      fullName: `Investor E2E ${suffix}`,
      email: investorEmail,
      distributor: distributor.party,
    }),
  );
  await timed("Step 11 — Distributor verifies KYC", () =>
    req("POST", `/investor-profiles/${investorProfile.contractId}/verify`, distributor.token),
  );
  const investor = await login(investorEmail);

  // --- Step 12: Investor subscribes ---
  const subscription = await timed("Step 12 — Investor subscribes", () =>
    req("POST", `/investment-notes/${note.contractId}/subscribe`, investor.token, {
      amountNGN: 10_000_000,
    }),
  );

  // --- Step 13: Subscription is allocated ---
  await timed("Step 13 — Risk Agent preview", () =>
    req("POST", `/subscriptions/${subscription.contractId}/risk-check`, distributor.token),
  );
  await timed("Step 13 — Distributor allocates", () =>
    req("POST", `/subscriptions/${subscription.contractId}/allocate`, distributor.token, {
      allocatedAmountNGN: 10_000_000,
      riskNotes: "Within concentration limits for a single investor.",
    }),
  );

  // --- Step 14: Profit distributions are processed ---
  const distReq = await timed("Step 14 — Custodian proposes distribution", () =>
    req("POST", `/investment-notes/${note.contractId}/distributions`, custodian.token, {
      periodLabel: "Q1 E2E",
      totalAmountNGN: 500_000,
    }),
  );
  await timed("Step 14 — Trustee approves distribution", () =>
    req("POST", `/distribution-requests/${distReq.contractId}/approve`, trustee.token),
  );

  // --- Step 15: AI Reporting Agent generates reports ---
  await timed("Step 15 — Management report generated", () =>
    req("GET", `/investment-notes/${note.contractId}/reports/management`, issuingHouse.token),
  );
  await timed("Step 15 — Investor report generated", () => req("GET", "/reports/investor", investor.token));
  await timed("Step 15 — Regulatory report generated", () =>
    req("GET", `/investment-notes/${note.contractId}/reports/regulatory`, sec.token),
  );

  const totalMs = Date.now() - overallStart;

  console.log("\n=== Milestone 9 timed end-to-end run ===\n");
  console.log(`Org/user onboarding (setup, not one of the 15 steps): ${setupMs}ms\n`);
  for (const t of timings) {
    console.log(`${t.step.padEnd(48)} ${t.ms}ms`);
  }
  console.log(`\nTOTAL (Steps 1-15 only): ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`);
  console.log(totalMs < 5 * 60 * 1000 ? "PASS: under 5 minutes" : "FAIL: exceeded 5 minutes");
}

main().catch((err) => {
  console.error("E2E run failed:", err);
  process.exit(1);
});
