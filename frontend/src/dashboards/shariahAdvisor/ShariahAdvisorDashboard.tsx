import { useState, type FormEvent } from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/Card";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { IconClipboardCheck, IconFileText, IconShield } from "../../components/icons";
import { useAuth } from "../../auth/AuthContext";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useShariahReviews } from "../../hooks/useShariahReviews";
import type { ShariahReviewItem } from "../../api/reviewsApi";
import { getShariahReport, type GeneratedReport } from "../../api/reportsApi";
import { formatNGN } from "../../lib/format";
import styles from "./ShariahAdvisorDashboard.module.css";

const NAV_ITEMS = [
  { label: "Reviews", active: true, icon: <IconFileText /> },
  { label: "Reports", active: true, icon: <IconShield /> },
];

export default function ShariahAdvisorDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const reviews = useShariahReviews(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  const [openId, setOpenId] = useState<string | null>(null);
  const [certificationNotes, setCertificationNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  function openReview(review: ShariahReviewItem) {
    setActionError(null);
    setOpenId(openId === review.contractId ? null : review.contractId);
    setCertificationNotes("");
    setRejectionReason("");
  }

  async function handleCertify(e: FormEvent, review: ShariahReviewItem) {
    e.preventDefault();
    setActionError(null);
    try {
      await reviews.certify(review.contractId, certificationNotes);
      setOpenId(null);
    } catch {
      setActionError("Could not certify this review.");
    }
  }

  async function handleReject(review: ShariahReviewItem) {
    setActionError(null);
    try {
      await reviews.reject(review.contractId, rejectionReason || "Not specified.");
      setOpenId(null);
    } catch {
      setActionError("Could not reject this review.");
    }
  }

  // --- AI Reporting Agent ---
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function handleGenerateReport() {
    setActionError(null);
    setReportOpen((v) => !v);
    if (report) return;
    setReportLoading(true);
    try {
      const res = await getShariahReport(token);
      setReport(res.output);
    } catch {
      setActionError("Could not reach the Reporting Agent.");
    } finally {
      setReportLoading(false);
    }
  }

  const error = actionError ?? orgs.error ?? reviews.error;
  const pending = reviews.data.filter((r) => r.status === "Pending");
  const certified = reviews.data.filter((r) => r.status === "Certified");

  const pendingColumns: DataTableColumn<ShariahReviewItem>[] = [
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

  const certifiedColumns: DataTableColumn<ShariahReviewItem>[] = [
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
    { key: "notes", header: "Certification notes", render: (r) => <span className={styles.notesCell}>{r.certificationNotes}</span> },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Reviews">
      <PageHeader
        title="Shariah Advisor"
        description="Review proposed structures against Shariah screening criteria and certify compliance."
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Pending reviews</div>
          <div className={styles.statValue}>{pending.length}</div>
          <div className={styles.statHint}>Awaiting your certification</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Certified</div>
          <div className={styles.statValue}>{certified.length}</div>
          <div className={styles.statHint}>Passed to Trustee review</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconFileText /> Pending reviews ({pending.length})
            </span>
          }
          description="Finalized structures submitted by an Issuing House for Shariah certification."
        />
        <CardBody flush>
          <DataTable
            columns={pendingColumns}
            rows={pending}
            keyExtractor={(r) => r.contractId}
            emptyTitle="No pending reviews"
            emptyDescription="Structures submitted for Shariah review will appear here."
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
                    <div className={styles.dealSummaryLabel}>Min. subscription</div>
                    <div className={styles.dealSummaryValueMono}>{formatNGN(review.minSubscriptionNGN)}</div>
                  </div>
                </div>
                <form className={styles.form} onSubmit={(e) => handleCertify(e, review)}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="certificationNotes">Certification notes</label>
                    <textarea
                      id="certificationNotes"
                      required
                      value={certificationNotes}
                      onChange={(e) => setCertificationNotes(e.target.value)}
                      placeholder="Basis for certifying this structure as Shariah-compliant…"
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="rejectionReason">Rejection reason (if rejecting instead)</label>
                    <textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why this structure does not meet Shariah requirements…"
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button type="submit" variant="primary">
                      <IconClipboardCheck /> Certify
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
              <IconClipboardCheck /> Certified ({certified.length})
            </span>
          }
          description="Structures you've certified as Shariah-compliant."
        />
        <CardBody flush>
          <DataTable
            columns={certifiedColumns}
            rows={certified}
            keyExtractor={(r) => r.contractId}
            emptyTitle="Nothing certified yet"
            emptyDescription="Certified structures will appear here."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconShield /> Certification report
            </span>
          }
          description="A summary of your certification history, generated by the AI Reporting Agent."
          actions={
            <Button variant="primary" size="sm" onClick={handleGenerateReport}>
              {reportOpen ? "Close" : report ? "View report" : "Generate report"}
            </Button>
          }
        />
        {reportOpen && (
          <CardBody>
            {reportLoading && <p>Consulting the Reporting Agent…</p>}
            {report && (
              <div className={styles.documentsList}>
                <details className={styles.documentItem} open>
                  <summary>{report.title}</summary>
                  <pre className={styles.documentMarkdown}>{report.markdown}</pre>
                </details>
              </div>
            )}
          </CardBody>
        )}
      </Card>
    </AppShell>
  );
}
