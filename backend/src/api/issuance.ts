import { Router, type Request } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { getOperatorParty } from "../ledger/operator.js";
import { findApprovalById } from "../ledger/regulatory.js";
import { findNoteByApprovalCid, findNoteBySymbol, issueNote, listNotes } from "../ledger/issuance.js";

export const issuanceRouter = Router();

issuanceRouter.use(requireAuth);

// InvestmentNote's signatory/observer set is issuingHouse, sec, sponsor,
// trustee, operator (Milestone 6 added operator — see the module comment
// on daml/main/daml/AmanaX/Issuance/Issuance.daml). Investor is included
// here too, but reads via the operator's party, not its own — an Investor
// has no stakeholder relationship to a note until it's allocated one, so
// there's nothing to query directly as the investor.
const NOTE_READERS = ["IssuingHouse", "SEC", "FundManager", "Issuer", "Trustee", "Investor"] as const;

async function readerParty(req: Request): Promise<string> {
  if (req.auth?.role === "Investor") {
    return getOperatorParty();
  }
  return requireOrgParty(req);
}

const issueSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9._-]+$/, "symbol may only contain letters, numbers, dots, dashes and underscores"),
  parValueNGN: z.number().positive(),
});

// Step 10 (docs/prompt.md): Issuing House issues the Investment Note once
// the SEC has approved. Re-derives every deal fact from the on-ledger
// SECApproval (never trusts client-supplied deal terms) — same reasoning
// as sponsorType in api/proposals.ts and the compliance re-check in
// api/regulatory.ts. Only `symbol` and `parValueNGN` are genuinely new
// inputs the Issuing House provides at this step.
issuanceRouter.post("/sec-approvals/:contractId/issue", requireRole("IssuingHouse"), async (req, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const issuingHouse = requireOrgParty(req);
  const approval = await findApprovalById(issuingHouse, req.params.contractId);
  if (!approval) {
    res.status(404).json({ error: "SEC approval not found" });
    return;
  }

  const alreadyIssued = await findNoteByApprovalCid(issuingHouse, approval.contractId);
  if (alreadyIssued) {
    res.status(409).json({ error: "this approval has already been issued", note: alreadyIssued });
    return;
  }

  const symbolTaken = await findNoteBySymbol(issuingHouse, parsed.data.symbol);
  if (symbolTaken) {
    res.status(409).json({ error: `symbol "${parsed.data.symbol}" is already in use` });
    return;
  }

  const note = await issueNote({
    issuingHouse,
    operator: await getOperatorParty(),
    sec: approval.sec,
    sponsor: approval.sponsor,
    trustee: approval.trustee,
    approvalCid: approval.contractId,
    symbol: parsed.data.symbol,
    productName: approval.productName,
    description: approval.description,
    structureType: approval.structureType,
    targetSizeNGN: approval.targetSizeNGN,
    tenorMonths: approval.tenorMonths,
    profitMechanism: approval.profitMechanism,
    minSubscriptionNGN: approval.minSubscriptionNGN,
    redemptionTerms: approval.redemptionTerms,
    parValueNGN: parsed.data.parValueNGN,
    approvalReference: approval.approvalReference ?? "",
  });
  res.status(201).json(note);
});

issuanceRouter.get("/investment-notes", requireRole(...NOTE_READERS), async (req, res) => {
  const notes = await listNotes(await readerParty(req));
  res.status(200).json(notes);
});

// Dedicated CIP-0056-shaped payload — the literal "discoverable via Token
// Metadata" gate for this milestone, separate from the full note object so
// a Token Standard-aware caller can fetch just {instrumentId, meta}.
issuanceRouter.get("/investment-notes/:contractId/metadata", requireRole(...NOTE_READERS), async (req, res) => {
  const notes = await listNotes(await readerParty(req));
  const note = notes.find((n) => n.contractId === req.params.contractId);
  if (!note) {
    res.status(404).json({ error: "investment note not found" });
    return;
  }
  res.status(200).json({ instrumentId: note.instrumentId, meta: note.meta });
});
