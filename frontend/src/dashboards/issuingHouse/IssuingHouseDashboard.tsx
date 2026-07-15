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
import { PRODUCT_TYPES, type ProductProposal, type ProductStructure, type ProductType, type StructuringRecommendation } from "../../api/productsApi";
import { formatNGN } from "../../lib/format";
import styles from "./IssuingHouseDashboard.module.css";

const NAV_ITEMS = [
  { label: "Proposals", active: true, icon: <IconFileText /> },
  { label: "Structures", active: true, icon: <IconLayers /> },
  { label: "Reports", disabled: true, icon: <IconShield /> },
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

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

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

  const error = actionError ?? orgs.error ?? proposals.error ?? structures.error;
  const draftStructures = structures.data.filter((s) => s.status === "ProductStructure_Draft");
  const finalizedStructures = structures.data.filter((s) => s.status === "ProductStructure_Finalized");

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
      render: (s) =>
        s.status === "ProductStructure_Draft" ? (
          <Button size="sm" variant={editingId === s.contractId ? "secondary" : "primary"} onClick={() => openEdit(s)}>
            {editingId === s.contractId ? "Close" : "Edit / finalize"}
          </Button>
        ) : null,
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
      </Card>
    </AppShell>
  );
}
