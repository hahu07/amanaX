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
import { useTrusteeReviews } from "../../hooks/useTrusteeReviews";
import { useInvestmentNotes } from "../../hooks/useInvestmentNotes";
import { useDistributionRequests } from "../../hooks/useDistributionRequests";
import type { TrusteeReviewItem } from "../../api/reviewsApi";
import type { InvestmentNote } from "../../api/investmentNotesApi";
import type { DistributionRequestItem } from "../../api/distributionsApi";
import { formatNGN } from "../../lib/format";
import styles from "./TrusteeDashboard.module.css";

const NAV_ITEMS = [
  { label: "Reviews", active: true, icon: <IconFileText /> },
  { label: "Notes", active: true, icon: <IconLayers /> },
  { label: "Distributions", active: true, icon: <IconClipboardCheck /> },
  { label: "Reports", disabled: true, icon: <IconShield /> },
];

export default function TrusteeDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const reviews = useTrusteeReviews(token);
  const investmentNotes = useInvestmentNotes(token);
  const distributionRequests = useDistributionRequests(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  const [openId, setOpenId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const [openDistId, setOpenDistId] = useState<string | null>(null);
  const [distRejectionReason, setDistRejectionReason] = useState("");

  function openDistribution(request: DistributionRequestItem) {
    setActionError(null);
    setOpenDistId(openDistId === request.contractId ? null : request.contractId);
    setDistRejectionReason("");
  }

  async function handleApproveDistribution(request: DistributionRequestItem) {
    setActionError(null);
    try {
      await distributionRequests.approve(request.contractId);
      setOpenDistId(null);
    } catch {
      setActionError("Could not approve this distribution.");
    }
  }

  async function handleRejectDistribution(request: DistributionRequestItem) {
    setActionError(null);
    try {
      await distributionRequests.reject(request.contractId, distRejectionReason || "Not specified.");
      setOpenDistId(null);
    } catch {
      setActionError("Could not reject this distribution.");
    }
  }

  function openReview(review: TrusteeReviewItem) {
    setActionError(null);
    setOpenId(openId === review.contractId ? null : review.contractId);
    setApprovalNotes("");
    setRejectionReason("");
  }

  async function handleApprove(e: FormEvent, review: TrusteeReviewItem) {
    e.preventDefault();
    setActionError(null);
    try {
      await reviews.approve(review.contractId, approvalNotes);
      setOpenId(null);
    } catch {
      setActionError("Could not approve this review.");
    }
  }

  async function handleReject(review: TrusteeReviewItem) {
    setActionError(null);
    try {
      await reviews.reject(review.contractId, rejectionReason || "Not specified.");
      setOpenId(null);
    } catch {
      setActionError("Could not reject this review.");
    }
  }

  const error = actionError ?? orgs.error ?? reviews.error ?? investmentNotes.error ?? distributionRequests.error;
  const pending = reviews.data.filter((r) => r.status === "Pending");
  const approved = reviews.data.filter((r) => r.status === "Approved");

  const pendingColumns: DataTableColumn<TrusteeReviewItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{r.productName}</span>
          <span className={styles.productMeta}>
            {orgName(r.sponsor)} via {orgName(r.issuingHouse)}
          </span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (r) => <StatusBadge tone="outline">{r.structureType}</StatusBadge> },
    { key: "size", header: "Target size", mono: true, render: (r) => formatNGN(r.targetSizeNGN) },
    { key: "tenor", header: "Tenor", mono: true, render: (r) => `${r.tenorMonths} mo` },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button size="sm" variant={openId === r.contractId ? "secondary" : "primary"} onClick={() => openReview(r)}>
          {openId === r.contractId ? "Close" : "Review"}
        </Button>
      ),
    },
  ];

  const approvedColumns: DataTableColumn<TrusteeReviewItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{r.productName}</span>
          <span className={styles.productMeta}>{orgName(r.sponsor)}</span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (r) => <StatusBadge tone="outline">{r.structureType}</StatusBadge> },
    { key: "notes", header: "Approval notes", render: (r) => <span className={styles.notesCell}>{r.approvalNotes}</span> },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Reviews">
      <PageHeader title="Trustee" description="Review governance and investor-protection terms before issuance." />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Pending reviews</div>
          <div className={styles.statValue}>{pending.length}</div>
          <div className={styles.statHint}>Awaiting your approval</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Approved</div>
          <div className={styles.statValue}>{approved.length}</div>
          <div className={styles.statHint}>Ready for SEC submission review</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconFileText /> Pending reviews ({pending.length})
            </span>
          }
          description="Shariah-certified structures submitted by an Issuing House for Trustee approval."
        />
        <CardBody flush>
          <DataTable
            columns={pendingColumns}
            rows={pending}
            keyExtractor={(r) => r.contractId}
            emptyTitle="No pending reviews"
            emptyDescription="Structures submitted for Trustee review will appear here."
          />
        </CardBody>
        {openId &&
          (() => {
            const review = pending.find((r) => r.contractId === openId);
            if (!review) return null;
            return (
              <div className={styles.reviewPanel}>
                <div className={styles.dealSummary}>
                  <div>
                    <div className={styles.dealSummaryLabel}>Description</div>
                    <div className={styles.dealSummaryValue}>{review.description}</div>
                  </div>
                  <div>
                    <div className={styles.dealSummaryLabel}>Profit mechanism</div>
                    <div className={styles.dealSummaryValue}>{review.profitMechanism}</div>
                  </div>
                  <div>
                    <div className={styles.dealSummaryLabel}>Redemption terms</div>
                    <div className={styles.dealSummaryValue}>{review.redemptionTerms}</div>
                  </div>
                  <div>
                    <div className={styles.dealSummaryLabel}>Shariah certification notes</div>
                    <div className={styles.dealSummaryValue}>{review.certificationNotes}</div>
                  </div>
                </div>
                <form className={styles.form} onSubmit={(e) => handleApprove(e, review)}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="approvalNotes">Approval notes</label>
                    <textarea
                      id="approvalNotes"
                      required
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Governance and investor-protection basis for approving this structure…"
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="rejectionReason">Rejection reason (if rejecting instead)</label>
                    <textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why this structure does not meet governance requirements…"
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button type="submit" variant="primary">
                      <IconClipboardCheck /> Approve
                    </Button>
                    <Button type="button" variant="danger" onClick={() => handleReject(review)}>
                      Reject
                    </Button>
                  </div>
                </form>
              </div>
            );
          })()}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconClipboardCheck /> Approved ({approved.length})
            </span>
          }
          description="Structures you've approved. The Issuing House runs the AI Compliance Agent from here before SEC submission."
        />
        <CardBody flush>
          <DataTable
            columns={approvedColumns}
            rows={approved}
            keyExtractor={(r) => r.contractId}
            emptyTitle="Nothing approved yet"
            emptyDescription="Approved structures will appear here."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconLayers /> Issued notes ({investmentNotes.data.length})
            </span>
          }
          description="Investment Notes issued once the SEC approves a structure you reviewed."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (n: InvestmentNote) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{n.productName}</span>
                    <span className={styles.productMeta}>{n.symbol}</span>
                  </div>
                ),
              },
              { key: "type", header: "Structure type", render: (n: InvestmentNote) => <StatusBadge tone="outline">{n.structureType}</StatusBadge> },
              { key: "supply", header: "Total supply", mono: true, render: (n: InvestmentNote) => n.totalSupply.toLocaleString() },
              { key: "reference", header: "Approval reference", mono: true, render: (n: InvestmentNote) => n.approvalReference },
            ]}
            rows={investmentNotes.data}
            keyExtractor={(n) => n.contractId}
            emptyTitle="No notes issued yet"
            emptyDescription="Issued notes will appear here once the Issuing House completes issuance."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconClipboardCheck /> Pending distributions ({distributionRequests.data.length})
            </span>
          }
          description="Profit distributions the Custodian has calculated, awaiting your oversight approval."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (r: DistributionRequestItem) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{r.productName}</span>
                    <span className={styles.productMeta}>
                      {r.periodLabel} · {orgName(r.custodian)}
                    </span>
                  </div>
                ),
              },
              { key: "investors", header: "Investors", mono: true, render: (r: DistributionRequestItem) => r.shares.length },
              { key: "amount", header: "Total amount", mono: true, render: (r: DistributionRequestItem) => formatNGN(r.totalAmountNGN) },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (r: DistributionRequestItem) => (
                  <Button size="sm" variant={openDistId === r.contractId ? "secondary" : "primary"} onClick={() => openDistribution(r)}>
                    {openDistId === r.contractId ? "Close" : "Review"}
                  </Button>
                ),
              },
            ]}
            rows={distributionRequests.data}
            keyExtractor={(r) => r.contractId}
            emptyTitle="No pending distributions"
            emptyDescription="Distributions proposed by the Custodian will appear here."
          />
        </CardBody>
        {openDistId &&
          (() => {
            const request = distributionRequests.data.find((r) => r.contractId === openDistId);
            if (!request) return null;
            return (
              <div className={styles.reviewPanel}>
                <ul className={styles.sharesList}>
                  {request.shares.map((s) => (
                    <li key={s.investor}>
                      {orgName(s.investor)}: {s.units.toLocaleString()} units — {formatNGN(s.amountNGN)}
                    </li>
                  ))}
                </ul>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="distRejectionReason">Rejection reason (if rejecting instead)</label>
                  <textarea
                    id="distRejectionReason"
                    value={distRejectionReason}
                    onChange={(e) => setDistRejectionReason(e.target.value)}
                    placeholder="Why this distribution should not proceed…"
                  />
                </div>
                <div className={styles.formActions}>
                  <Button variant="primary" onClick={() => handleApproveDistribution(request)}>
                    <IconClipboardCheck /> Approve
                  </Button>
                  <Button variant="danger" onClick={() => handleRejectDistribution(request)}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })()}
      </Card>
    </AppShell>
  );
}
