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
import { useRegulatorySubmissions } from "../../hooks/useRegulatorySubmissions";
import type { RegulatorySubmissionItem } from "../../api/regulatoryApi";
import { formatNGN } from "../../lib/format";
import styles from "./SecDashboard.module.css";

const NAV_ITEMS = [
  { label: "Filings", active: true, icon: <IconFileText /> },
  { label: "Reports", disabled: true, icon: <IconShield /> },
];

export default function SecDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const submissions = useRegulatorySubmissions(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  const [openId, setOpenId] = useState<string | null>(null);
  const [approvalReference, setApprovalReference] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  function openReview(submission: RegulatorySubmissionItem) {
    setActionError(null);
    setOpenId(openId === submission.contractId ? null : submission.contractId);
    setApprovalReference("");
    setRejectionReason("");
  }

  async function handleApprove(e: FormEvent, submission: RegulatorySubmissionItem) {
    e.preventDefault();
    setActionError(null);
    try {
      await submissions.approve(submission.contractId, approvalReference);
      setOpenId(null);
    } catch {
      setActionError("Could not approve this submission.");
    }
  }

  async function handleReject(submission: RegulatorySubmissionItem) {
    setActionError(null);
    try {
      await submissions.reject(submission.contractId, rejectionReason || "Not specified.");
      setOpenId(null);
    } catch {
      setActionError("Could not reject this submission.");
    }
  }

  const error = actionError ?? orgs.error ?? submissions.error;
  const pending = submissions.data.filter((s) => s.status === "Pending");
  const approved = submissions.data.filter((s) => s.status === "Approved");

  const pendingColumns: DataTableColumn<RegulatorySubmissionItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (s) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{s.productName}</span>
          <span className={styles.productMeta}>
            {orgName(s.sponsor)} via {orgName(s.issuingHouse)}
          </span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (s) => <StatusBadge tone="outline">{s.structureType}</StatusBadge> },
    { key: "size", header: "Target size", mono: true, render: (s) => formatNGN(s.targetSizeNGN) },
    { key: "tenor", header: "Tenor", mono: true, render: (s) => `${s.tenorMonths} mo` },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <Button size="sm" variant={openId === s.contractId ? "secondary" : "primary"} onClick={() => openReview(s)}>
          {openId === s.contractId ? "Close" : "Review"}
        </Button>
      ),
    },
  ];

  const approvedColumns: DataTableColumn<RegulatorySubmissionItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (s) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{s.productName}</span>
          <span className={styles.productMeta}>{orgName(s.sponsor)}</span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (s) => <StatusBadge tone="outline">{s.structureType}</StatusBadge> },
    { key: "reference", header: "Approval reference", mono: true, render: (s) => s.approvalReference ?? "—" },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Filings">
      <PageHeader title="SEC" description="Review regulatory submissions and approve product issuance." />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Pending filings</div>
          <div className={styles.statValue}>{pending.length}</div>
          <div className={styles.statHint}>Awaiting your decision</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Approved</div>
          <div className={styles.statValue}>{approved.length}</div>
          <div className={styles.statHint}>Cleared for issuance</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconFileText /> Pending filings ({pending.length})
            </span>
          }
          description="Applications submitted by an Issuing House for regulatory approval."
        />
        <CardBody flush>
          <DataTable
            columns={pendingColumns}
            rows={pending}
            keyExtractor={(s) => s.contractId}
            emptyTitle="No pending filings"
            emptyDescription="Regulatory submissions will appear here."
          />
        </CardBody>
        {openId &&
          (() => {
            const submission = pending.find((s) => s.contractId === openId);
            if (!submission) return null;
            return (
              <div className={styles.reviewPanel}>
                <div className={styles.dealSummary}>
                  <div>
                    <div className={styles.dealSummaryLabel}>Description</div>
                    <div className={styles.dealSummaryValue}>{submission.description}</div>
                  </div>
                  <div>
                    <div className={styles.dealSummaryLabel}>Shariah certification notes</div>
                    <div className={styles.dealSummaryValue}>{submission.certificationNotes}</div>
                  </div>
                  <div>
                    <div className={styles.dealSummaryLabel}>Trustee approval notes</div>
                    <div className={styles.dealSummaryValue}>{submission.approvalNotes}</div>
                  </div>
                  <div>
                    <div className={styles.dealSummaryLabel}>Min. subscription</div>
                    <div className={styles.dealSummaryValueMono}>{formatNGN(submission.minSubscriptionNGN)}</div>
                  </div>
                </div>

                <div className={styles.documentsList}>
                  {submission.documents.map((doc) => (
                    <details key={doc.kind} className={styles.documentItem}>
                      <summary>{doc.title}</summary>
                      <pre className={styles.documentMarkdown}>{doc.markdown}</pre>
                    </details>
                  ))}
                </div>

                <form className={styles.form} onSubmit={(e) => handleApprove(e, submission)}>
                  <div className={styles.field}>
                    <label htmlFor="approvalReference">Approval reference</label>
                    <input
                      id="approvalReference"
                      required
                      value={approvalReference}
                      onChange={(e) => setApprovalReference(e.target.value)}
                      placeholder="e.g. SEC/AMX/2026/0001"
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="rejectionReason">Rejection reason (if rejecting instead)</label>
                    <textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why this application does not meet regulatory requirements…"
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button type="submit" variant="primary">
                      <IconClipboardCheck /> Approve
                    </Button>
                    <Button type="button" variant="danger" onClick={() => handleReject(submission)}>
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
          description="Products cleared for issuance."
        />
        <CardBody flush>
          <DataTable
            columns={approvedColumns}
            rows={approved}
            keyExtractor={(s) => s.contractId}
            emptyTitle="Nothing approved yet"
            emptyDescription="Approved filings will appear here."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
