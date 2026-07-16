import { useState, type FormEvent } from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/Card";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { IconClipboardCheck, IconFileText, IconLayers, IconShield } from "../../components/icons";
import { useAuth } from "../../auth/AuthContext";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useProposals } from "../../hooks/useProposals";
import { useStructures } from "../../hooks/useStructures";
import { useShariahReviews } from "../../hooks/useShariahReviews";
import { useTrusteeReviews } from "../../hooks/useTrusteeReviews";
import { useRegulatorySubmissions } from "../../hooks/useRegulatorySubmissions";
import { PRODUCT_TYPES, type ProductProposal, type ProductStructure, type ProductType, type StructuringRecommendation } from "../../api/productsApi";
import type { ComplianceAssessment, ShariahReviewItem, TrusteeReviewItem } from "../../api/reviewsApi";
import type { FilingDocument, RegulatorySubmissionItem } from "../../api/regulatoryApi";
import { ApiError } from "../../api/backendClient";
import { formatNGN } from "../../lib/format";
import styles from "./IssuingHouseDashboard.module.css";

const NAV_ITEMS = [
  { label: "Proposals", active: true, icon: <IconFileText /> },
  { label: "Structures", active: true, icon: <IconLayers /> },
  { label: "Reviews", active: true, icon: <IconClipboardCheck /> },
  { label: "Filings", active: true, icon: <IconShield /> },
  { label: "Reports", disabled: true, icon: <IconFileText /> },
];

interface StructureFormState {
  structureType: ProductType;
  profitMechanism: string;
  minSubscriptionNGN: string;
  redemptionTerms: string;
  structureTenorMonths: string;
}

function emptyForm(proposal: ProductProposal): StructureFormState {
  return {
    structureType: proposal.proposedType,
    profitMechanism: "",
    minSubscriptionNGN: "",
    redemptionTerms: "",
    structureTenorMonths: String(proposal.tenorMonths),
  };
}

export default function IssuingHouseDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const proposals = useProposals(token);
  const structures = useStructures(token);
  const shariahReviews = useShariahReviews(token);
  const trusteeReviews = useTrusteeReviews(token);
  const regulatorySubmissions = useRegulatorySubmissions(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;
  const shariahAdvisors = orgs.data.filter((o) => o.role === "ShariahAdvisor" && o.active);
  const trustees = orgs.data.filter((o) => o.role === "Trustee" && o.active);
  const secOrgs = orgs.data.filter((o) => o.role === "SEC" && o.active);

  // --- Proposal review (AI recommendation + initial structuring) ---
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<StructuringRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [form, setForm] = useState<StructureFormState | null>(null);

  async function openReview(proposal: ProductProposal) {
    setActionError(null);
    if (reviewingId === proposal.contractId) {
      setReviewingId(null);
      return;
    }
    setReviewingId(proposal.contractId);
    setForm(emptyForm(proposal));
    setRecommendation(null);
    setRecommendationLoading(true);
    try {
      const res = await proposals.getRecommendation(proposal.contractId);
      setRecommendation(res.output);
    } catch {
      setActionError("Could not reach the Product Structuring Agent.");
    } finally {
      setRecommendationLoading(false);
    }
  }

  function useRecommendedTerms() {
    if (!recommendation || !form) return;
    setForm({
      ...form,
      structureType: recommendation.recommendedStructureType === "Hybrid" ? form.structureType : recommendation.recommendedStructureType,
      profitMechanism: recommendation.suggestedTerms.profitMechanism,
      minSubscriptionNGN: String(recommendation.suggestedTerms.minSubscriptionNGN),
      redemptionTerms: recommendation.suggestedTerms.redemptionTerms,
      structureTenorMonths: String(recommendation.suggestedTerms.tenorMonths),
    });
  }

  async function handleReject(proposal: ProductProposal) {
    setActionError(null);
    try {
      await proposals.reject(proposal.contractId);
      if (reviewingId === proposal.contractId) setReviewingId(null);
    } catch {
      setActionError("Could not reject the proposal.");
    }
  }

  async function handleStructure(e: FormEvent, proposal: ProductProposal) {
    e.preventDefault();
    if (!form) return;
    setActionError(null);
    try {
      await proposals.structure(proposal.contractId, {
        structureType: form.structureType,
        profitMechanism: form.profitMechanism,
        minSubscriptionNGN: Number(form.minSubscriptionNGN),
        redemptionTerms: form.redemptionTerms,
        structureTenorMonths: Number(form.structureTenorMonths),
      });
      // proposals.structure() only refreshes the proposals list it owns —
      // the new ProductStructure needs a separate refresh of the
      // structures hook, which is independent state.
      await structures.refresh();
      setReviewingId(null);
      setForm(null);
    } catch {
      setActionError("Could not structure this proposal.");
    }
  }

  // --- Structure editing / finalization ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StructureFormState | null>(null);

  function openEdit(structure: ProductStructure) {
    setActionError(null);
    if (editingId === structure.contractId) {
      setEditingId(null);
      return;
    }
    setEditingId(structure.contractId);
    setEditForm({
      structureType: structure.structureType,
      profitMechanism: structure.profitMechanism,
      minSubscriptionNGN: String(structure.minSubscriptionNGN),
      redemptionTerms: structure.redemptionTerms,
      structureTenorMonths: String(structure.tenorMonths),
    });
  }

  async function handleUpdateTerms(e: FormEvent, structure: ProductStructure) {
    e.preventDefault();
    if (!editForm) return;
    setActionError(null);
    try {
      await structures.updateTerms(structure.contractId, {
        newStructureType: editForm.structureType,
        newProfitMechanism: editForm.profitMechanism,
        newMinSubscriptionNGN: Number(editForm.minSubscriptionNGN),
        newRedemptionTerms: editForm.redemptionTerms,
        newTenorMonths: Number(editForm.structureTenorMonths),
      });
      setEditingId(null);
      setEditForm(null);
    } catch {
      setActionError("Could not update the structure's terms.");
    }
  }

  async function handleFinalize(structure: ProductStructure) {
    setActionError(null);
    try {
      await structures.finalize(structure.contractId);
      setEditingId(null);
    } catch {
      setActionError("Could not finalize the structure.");
    }
  }

  // --- Step 5: submit a Finalized structure for Shariah review ---
  const [submittingShariahFor, setSubmittingShariahFor] = useState<string | null>(null);
  const [shariahAdvisorParty, setShariahAdvisorParty] = useState("");

  function openSubmitShariah(structure: ProductStructure) {
    setActionError(null);
    setSubmittingShariahFor(submittingShariahFor === structure.contractId ? null : structure.contractId);
    setShariahAdvisorParty("");
  }

  async function handleSubmitShariahReview(e: FormEvent, structure: ProductStructure) {
    e.preventDefault();
    setActionError(null);
    try {
      await shariahReviews.submit(structure.contractId, shariahAdvisorParty);
      setSubmittingShariahFor(null);
    } catch {
      setActionError("Could not submit this structure for Shariah review.");
    }
  }

  // --- Step 6: submit a Certified Shariah review for Trustee review ---
  const [submittingTrusteeFor, setSubmittingTrusteeFor] = useState<string | null>(null);
  const [trusteeParty, setTrusteeParty] = useState("");

  function openSubmitTrustee(review: ShariahReviewItem) {
    setActionError(null);
    setSubmittingTrusteeFor(submittingTrusteeFor === review.contractId ? null : review.contractId);
    setTrusteeParty("");
  }

  async function handleSubmitTrusteeReview(e: FormEvent, review: ShariahReviewItem) {
    e.preventDefault();
    setActionError(null);
    try {
      await shariahReviews.submitTrusteeReview(review.contractId, trusteeParty);
      await trusteeReviews.refresh();
      setSubmittingTrusteeFor(null);
    } catch {
      setActionError("Could not submit this review for Trustee review.");
    }
  }

  // --- Step 7: AI Compliance Agent, previewing SEC-submission readiness ---
  const [complianceId, setComplianceId] = useState<string | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [compliance, setCompliance] = useState<ComplianceAssessment | null>(null);

  async function handleCheckCompliance(review: TrusteeReviewItem) {
    setActionError(null);
    if (complianceId === review.contractId) {
      setComplianceId(null);
      return;
    }
    setComplianceId(review.contractId);
    setCompliance(null);
    setComplianceLoading(true);
    try {
      const res = await trusteeReviews.checkCompliance(review.contractId);
      setCompliance(res.output);
    } catch {
      setActionError("Could not reach the Compliance Agent.");
    } finally {
      setComplianceLoading(false);
    }
  }

  // --- Step 8: generate the filing pack and submit to the SEC (only once compliance-ready) ---
  const [filingPack, setFilingPack] = useState<FilingDocument[] | null>(null);
  const [filingPackLoading, setFilingPackLoading] = useState(false);
  const [secParty, setSecParty] = useState("");

  async function handleGenerateFilingPack(review: TrusteeReviewItem) {
    setActionError(null);
    setFilingPack(null);
    setFilingPackLoading(true);
    try {
      const res = await regulatorySubmissions.generatePack(review.contractId);
      setFilingPack(res.output);
    } catch {
      setActionError("Could not reach the Documentation Agent.");
    } finally {
      setFilingPackLoading(false);
    }
  }

  async function handleSubmitToSec(e: FormEvent, review: TrusteeReviewItem) {
    e.preventDefault();
    setActionError(null);
    try {
      await regulatorySubmissions.submit(review.contractId, secParty);
      setComplianceId(null);
      setFilingPack(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const body = JSON.parse(err.message) as { compliance: ComplianceAssessment };
          setCompliance(body.compliance);
          setActionError("No longer ready for SEC submission — see the updated Compliance Agent assessment above.");
          return;
        } catch {
          // fall through to the generic error below
        }
      }
      setActionError("Could not submit this filing to the SEC.");
    }
  }

  async function handleWithdrawSubmission(submission: RegulatorySubmissionItem) {
    setActionError(null);
    try {
      await regulatorySubmissions.withdraw(submission.contractId);
    } catch {
      setActionError("Could not withdraw this submission.");
    }
  }

  const error =
    actionError ??
    orgs.error ??
    proposals.error ??
    structures.error ??
    shariahReviews.error ??
    trusteeReviews.error ??
    regulatorySubmissions.error;
  const draftStructures = structures.data.filter((s) => s.status === "ProductStructure_Draft");
  const finalizedStructures = structures.data.filter((s) => s.status === "ProductStructure_Finalized");
  const pendingShariahReviews = shariahReviews.data.filter((r) => r.status === "Pending");
  const certifiedShariahReviews = shariahReviews.data.filter((r) => r.status === "Certified");
  const pendingTrusteeReviews = trusteeReviews.data.filter((r) => r.status === "Pending");
  const approvedTrusteeReviews = trusteeReviews.data.filter((r) => r.status === "Approved");

  function renderStructureForm(proposal: ProductProposal) {
    if (!form) return null;
    return (
      <form className={styles.form} onSubmit={(e) => handleStructure(e, proposal)}>
        <div className={styles.field}>
          <label htmlFor="structureType">Structure type</label>
          <select
            id="structureType"
            value={form.structureType}
            onChange={(e) => setForm({ ...form, structureType: e.target.value as ProductType })}
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="structureTenorMonths">Tenor (months)</label>
          <input
            id="structureTenorMonths"
            required
            type="number"
            min="1"
            value={form.structureTenorMonths}
            onChange={(e) => setForm({ ...form, structureTenorMonths: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="minSubscriptionNGN">Min. subscription (NGN)</label>
          <input
            id="minSubscriptionNGN"
            required
            type="number"
            min="0"
            value={form.minSubscriptionNGN}
            onChange={(e) => setForm({ ...form, minSubscriptionNGN: e.target.value })}
          />
        </div>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="profitMechanism">Profit mechanism</label>
          <input
            id="profitMechanism"
            required
            value={form.profitMechanism}
            onChange={(e) => setForm({ ...form, profitMechanism: e.target.value })}
            placeholder="How profit is calculated and distributed"
          />
        </div>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="redemptionTerms">Redemption terms</label>
          <input
            id="redemptionTerms"
            required
            value={form.redemptionTerms}
            onChange={(e) => setForm({ ...form, redemptionTerms: e.target.value })}
            placeholder="How and when capital is returned"
          />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" variant="primary">
            Structure this product
          </Button>
          <Button type="button" variant="danger" onClick={() => handleReject(proposal)}>
            Reject proposal
          </Button>
        </div>
      </form>
    );
  }

  function renderEditForm(structure: ProductStructure) {
    if (!editForm) return null;
    return (
      <form className={styles.form} onSubmit={(e) => handleUpdateTerms(e, structure)}>
        <div className={styles.field}>
          <label htmlFor="editStructureType">Structure type</label>
          <select
            id="editStructureType"
            value={editForm.structureType}
            onChange={(e) => setEditForm({ ...editForm, structureType: e.target.value as ProductType })}
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="editTenorMonths">Tenor (months)</label>
          <input
            id="editTenorMonths"
            required
            type="number"
            min="1"
            value={editForm.structureTenorMonths}
            onChange={(e) => setEditForm({ ...editForm, structureTenorMonths: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="editMinSubscriptionNGN">Min. subscription (NGN)</label>
          <input
            id="editMinSubscriptionNGN"
            required
            type="number"
            min="0"
            value={editForm.minSubscriptionNGN}
            onChange={(e) => setEditForm({ ...editForm, minSubscriptionNGN: e.target.value })}
          />
        </div>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="editProfitMechanism">Profit mechanism</label>
          <input
            id="editProfitMechanism"
            required
            value={editForm.profitMechanism}
            onChange={(e) => setEditForm({ ...editForm, profitMechanism: e.target.value })}
          />
        </div>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="editRedemptionTerms">Redemption terms</label>
          <input
            id="editRedemptionTerms"
            required
            value={editForm.redemptionTerms}
            onChange={(e) => setEditForm({ ...editForm, redemptionTerms: e.target.value })}
          />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" variant="primary">
            Save terms
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleFinalize(structure)}>
            Finalize structure
          </Button>
        </div>
      </form>
    );
  }

  const proposalColumns: DataTableColumn<ProductProposal>[] = [
    {
      key: "product",
      header: "Product",
      render: (p) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{p.productName}</span>
          <span className={styles.productMeta}>
            from {orgName(p.sponsor)} <StatusBadge tone="outline">{p.sponsorType === "Issuer" ? "Issuer" : "Fund Manager"}</StatusBadge>
          </span>
        </div>
      ),
    },
    { key: "type", header: "Proposed type", render: (p) => <StatusBadge tone="outline">{p.proposedType}</StatusBadge> },
    { key: "size", header: "Target size", mono: true, render: (p) => formatNGN(p.targetSizeNGN) },
    { key: "tenor", header: "Tenor", mono: true, render: (p) => `${p.tenorMonths} mo` },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div className={styles.rowActions}>
          <Button size="sm" variant={reviewingId === p.contractId ? "secondary" : "primary"} onClick={() => openReview(p)}>
            {reviewingId === p.contractId ? "Close" : "Review"}
          </Button>
        </div>
      ),
    },
  ];

  const structureColumns: DataTableColumn<ProductStructure>[] = [
    {
      key: "product",
      header: "Product",
      render: (s) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{s.productName}</span>
          <span className={styles.productMeta}>
            with {orgName(s.sponsor)} <StatusBadge tone="outline">{s.sponsorType === "Issuer" ? "Issuer" : "Fund Manager"}</StatusBadge>
          </span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (s) => <StatusBadge tone="outline">{s.structureType}</StatusBadge> },
    { key: "minSub", header: "Min. subscription", mono: true, render: (s) => formatNGN(s.minSubscriptionNGN) },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge tone={s.status === "ProductStructure_Finalized" ? "success" : "warning"}>{s.status === "ProductStructure_Finalized" ? "Finalized" : "Draft"}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => {
        if (s.status === "ProductStructure_Draft") {
          return (
            <Button size="sm" variant={editingId === s.contractId ? "secondary" : "primary"} onClick={() => openEdit(s)}>
              {editingId === s.contractId ? "Close" : "Edit / finalize"}
            </Button>
          );
        }
        const alreadySubmitted = shariahReviews.data.some((r) => r.structureCid === s.contractId);
        if (alreadySubmitted) {
          return <StatusBadge tone="outline">Submitted for review</StatusBadge>;
        }
        return (
          <Button size="sm" variant={submittingShariahFor === s.contractId ? "secondary" : "primary"} onClick={() => openSubmitShariah(s)}>
            {submittingShariahFor === s.contractId ? "Close" : "Submit for Shariah review"}
          </Button>
        );
      },
    },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Proposals">
      <PageHeader
        title="Issuing House"
        description="Review incoming proposals, structure Islamic Investment Notes, and finalize terms."
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Incoming proposals</div>
          <div className={styles.statValue}>{proposals.data.length}</div>
          <div className={styles.statHint}>Awaiting your review</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Draft structures</div>
          <div className={styles.statValue}>{draftStructures.length}</div>
          <div className={styles.statHint}>Being finalized</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Finalized</div>
          <div className={styles.statValue}>{finalizedStructures.length}</div>
          <div className={styles.statHint}>Ready for Shariah &amp; Trustee review</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconFileText /> Proposals ({proposals.data.length})
            </span>
          }
          description="Products Fund Managers and Issuers have proposed to your institution."
        />
        <CardBody flush>
          <DataTable
            columns={proposalColumns}
            rows={proposals.data}
            keyExtractor={(p) => p.contractId}
            emptyTitle="No incoming proposals"
            emptyDescription="Proposals from Fund Managers and Issuers will appear here."
          />
        </CardBody>
        {reviewingId && (() => {
          const proposal = proposals.data.find((p) => p.contractId === reviewingId);
          if (!proposal) return null;
          return (
            <div className={styles.reviewPanel}>
              <div className={styles.recommendation}>
                <div className={styles.recommendationHead}>
                  <span className={styles.recommendationTitle}>
                    <IconClipboardCheck /> AI Product Structuring Agent
                  </span>
                  {recommendation && (
                    <StatusBadge
                      tone={recommendation.confidence === "high" ? "success" : recommendation.confidence === "medium" ? "warning" : "neutral"}
                    >
                      {recommendation.confidence} confidence
                    </StatusBadge>
                  )}
                </div>
                {recommendationLoading && <p className={styles.recommendationRationale}>Consulting the assistant…</p>}
                {recommendation && (
                  <>
                    <p className={styles.recommendationRationale}>
                      Recommends <strong>{recommendation.recommendedStructureType}</strong> — {recommendation.rationale}
                    </p>
                    {recommendation.openGaps.length > 0 && (
                      <ul className={styles.recommendationGaps}>
                        {recommendation.openGaps.map((gap) => (
                          <li key={gap}>{gap}</li>
                        ))}
                      </ul>
                    )}
                    <Button size="sm" variant="secondary" onClick={useRecommendedTerms}>
                      Use recommended terms
                    </Button>
                  </>
                )}
              </div>
              {renderStructureForm(proposal)}
            </div>
          );
        })()}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconLayers /> Structures ({structures.data.length})
            </span>
          }
          description="Products you're structuring or have finalized."
        />
        <CardBody flush>
          <DataTable
            columns={structureColumns}
            rows={structures.data}
            keyExtractor={(s) => s.contractId}
            emptyTitle="No structures yet"
            emptyDescription="Structure a proposal above to see it here."
          />
        </CardBody>
        {editingId && (() => {
          const structure = structures.data.find((s) => s.contractId === editingId);
          if (!structure) return null;
          return <div className={styles.reviewPanel}>{renderEditForm(structure)}</div>;
        })()}
        {submittingShariahFor && (() => {
          const structure = structures.data.find((s) => s.contractId === submittingShariahFor);
          if (!structure) return null;
          return (
            <div className={styles.reviewPanel}>
              <form className={styles.form} onSubmit={(e) => handleSubmitShariahReview(e, structure)}>
                <div className={styles.field}>
                  <label htmlFor="shariahAdvisorParty">Shariah Advisor</label>
                  <select
                    id="shariahAdvisorParty"
                    required
                    value={shariahAdvisorParty}
                    onChange={(e) => setShariahAdvisorParty(e.target.value)}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {shariahAdvisors.map((org) => (
                      <option key={org.contractId} value={org.party}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formActions}>
                  <Button type="submit" variant="primary" disabled={shariahAdvisors.length === 0}>
                    Submit for review
                  </Button>
                </div>
              </form>
              {shariahAdvisors.length === 0 && (
                <Alert tone="neutral">No active Shariah Advisor is onboarded yet — ask the Platform Operator to add one.</Alert>
              )}
            </div>
          );
        })()}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconClipboardCheck /> Shariah reviews ({shariahReviews.data.length})
            </span>
          }
          description="Structures submitted for Shariah certification."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (r: ShariahReviewItem) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{r.productName}</span>
                    <span className={styles.productMeta}>with {orgName(r.shariahAdvisor)}</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r: ShariahReviewItem) => (
                  <StatusBadge tone={r.status === "Certified" ? "success" : "warning"}>{r.status}</StatusBadge>
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (r: ShariahReviewItem) => {
                  if (r.status !== "Certified") return null;
                  const alreadySubmitted = trusteeReviews.data.some((t) => t.shariahReviewCid === r.contractId);
                  if (alreadySubmitted) {
                    return <StatusBadge tone="outline">Submitted for review</StatusBadge>;
                  }
                  return (
                    <Button size="sm" variant={submittingTrusteeFor === r.contractId ? "secondary" : "primary"} onClick={() => openSubmitTrustee(r)}>
                      {submittingTrusteeFor === r.contractId ? "Close" : "Submit for Trustee review"}
                    </Button>
                  );
                },
              },
            ]}
            rows={[...pendingShariahReviews, ...certifiedShariahReviews]}
            keyExtractor={(r) => r.contractId}
            emptyTitle="No Shariah reviews yet"
            emptyDescription="Submit a Finalized structure above to see it here."
          />
        </CardBody>
        {submittingTrusteeFor && (() => {
          const review = certifiedShariahReviews.find((r) => r.contractId === submittingTrusteeFor);
          if (!review) return null;
          return (
            <div className={styles.reviewPanel}>
              <form className={styles.form} onSubmit={(e) => handleSubmitTrusteeReview(e, review)}>
                <div className={styles.field}>
                  <label htmlFor="trusteeParty">Trustee</label>
                  <select id="trusteeParty" required value={trusteeParty} onChange={(e) => setTrusteeParty(e.target.value)}>
                    <option value="" disabled>
                      Select…
                    </option>
                    {trustees.map((org) => (
                      <option key={org.contractId} value={org.party}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formActions}>
                  <Button type="submit" variant="primary" disabled={trustees.length === 0}>
                    Submit for review
                  </Button>
                </div>
              </form>
              {trustees.length === 0 && <Alert tone="neutral">No active Trustee is onboarded yet — ask the Platform Operator to add one.</Alert>}
            </div>
          );
        })()}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconShield /> Trustee reviews ({trusteeReviews.data.length})
            </span>
          }
          description="Structures submitted for Trustee approval."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (r: TrusteeReviewItem) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{r.productName}</span>
                    <span className={styles.productMeta}>with {orgName(r.trustee)}</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r: TrusteeReviewItem) => (
                  <StatusBadge tone={r.status === "Approved" ? "success" : "warning"}>{r.status}</StatusBadge>
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (r: TrusteeReviewItem) =>
                  r.status === "Approved" ? (
                    <Button size="sm" variant={complianceId === r.contractId ? "secondary" : "primary"} onClick={() => handleCheckCompliance(r)}>
                      {complianceId === r.contractId ? "Close" : "Check compliance"}
                    </Button>
                  ) : null,
              },
            ]}
            rows={[...pendingTrusteeReviews, ...approvedTrusteeReviews]}
            keyExtractor={(r) => r.contractId}
            emptyTitle="No Trustee reviews yet"
            emptyDescription="Submit a certified Shariah review above to see it here."
          />
        </CardBody>
        {complianceId &&
          (() => {
            const review = approvedTrusteeReviews.find((r) => r.contractId === complianceId);
            if (!review) return null;
            return (
              <div className={styles.reviewPanel}>
                <div className={styles.compliancePanel}>
                  <div className={styles.complianceHead}>
                    <span className={styles.complianceTitle}>
                      <IconClipboardCheck /> AI Compliance Agent
                    </span>
                    {compliance && (
                      <StatusBadge tone={compliance.readyForSubmission ? "success" : "warning"}>
                        {compliance.readyForSubmission ? "Ready for submission" : "Not yet ready"}
                      </StatusBadge>
                    )}
                  </div>
                  {complianceLoading && <p className={styles.complianceEmpty}>Consulting the assistant…</p>}
                  {compliance && (
                    <>
                      <div className={styles.complianceSection}>
                        <div className={styles.complianceSectionLabel}>Workflow gaps</div>
                        {compliance.workflowGaps.length === 0 ? (
                          <p className={styles.complianceEmpty}>None.</p>
                        ) : (
                          <ul className={styles.complianceList}>
                            {compliance.workflowGaps.map((g) => (
                              <li key={g}>{g}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className={styles.complianceSection}>
                        <div className={styles.complianceSectionLabel}>Shariah checklist gaps</div>
                        {compliance.shariahChecklistGaps.length === 0 ? (
                          <p className={styles.complianceEmpty}>None.</p>
                        ) : (
                          <ul className={styles.complianceList}>
                            {compliance.shariahChecklistGaps.map((g) => (
                              <li key={g}>{g}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className={styles.complianceSection}>
                        <div className={styles.complianceSectionLabel}>Documents still needed for SEC filing</div>
                        <ul className={styles.complianceList}>
                          {compliance.missingDocuments.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                {compliance?.readyForSubmission && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => handleGenerateFilingPack(review)}>
                      {filingPackLoading ? "Generating…" : filingPack ? "Regenerate filing pack" : "Generate filing pack"}
                    </Button>

                    {filingPack && (
                      <div className={styles.documentsList}>
                        {filingPack.map((doc) => (
                          <details key={doc.kind} className={styles.documentItem}>
                            <summary>{doc.title}</summary>
                            <pre className={styles.documentMarkdown}>{doc.markdown}</pre>
                          </details>
                        ))}
                      </div>
                    )}

                    {filingPack && (
                      <form className={styles.form} onSubmit={(e) => handleSubmitToSec(e, review)}>
                        <div className={styles.field}>
                          <label htmlFor="secParty">SEC</label>
                          <select id="secParty" required value={secParty} onChange={(e) => setSecParty(e.target.value)}>
                            <option value="" disabled>
                              Select…
                            </option>
                            {secOrgs.map((org) => (
                              <option key={org.contractId} value={org.party}>
                                {org.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.formActions}>
                          <Button type="submit" variant="primary" disabled={secOrgs.length === 0}>
                            Submit to SEC
                          </Button>
                        </div>
                      </form>
                    )}
                    {secOrgs.length === 0 && <Alert tone="neutral">No active SEC org is onboarded yet — ask the Platform Operator to add one.</Alert>}
                  </>
                )}
              </div>
            );
          })()}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconShield /> Regulatory submissions ({regulatorySubmissions.data.length})
            </span>
          }
          description="Applications filed with the SEC."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (s: RegulatorySubmissionItem) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{s.productName}</span>
                    <span className={styles.productMeta}>with {orgName(s.sec)}</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (s: RegulatorySubmissionItem) => (
                  <StatusBadge tone={s.status === "Approved" ? "success" : "warning"}>{s.status}</StatusBadge>
                ),
              },
              {
                key: "reference",
                header: "Approval reference",
                mono: true,
                render: (s: RegulatorySubmissionItem) => s.approvalReference ?? "—",
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (s: RegulatorySubmissionItem) =>
                  s.status === "Pending" ? (
                    <Button size="sm" variant="danger" onClick={() => handleWithdrawSubmission(s)}>
                      Withdraw
                    </Button>
                  ) : null,
              },
            ]}
            rows={regulatorySubmissions.data}
            keyExtractor={(s) => s.contractId}
            emptyTitle="No regulatory submissions yet"
            emptyDescription="Submit to the SEC above to see it here."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
