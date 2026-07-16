import { useState, type FormEvent } from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/Card";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { IconClipboardCheck, IconFileText, IconShield, IconUsers } from "../../components/icons";
import { useAuth } from "../../auth/AuthContext";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useInvestorProfiles } from "../../hooks/useInvestorProfiles";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import type { InvestorProfile } from "../../api/investorsApi";
import type { RiskAssessment, SubscriptionItem } from "../../api/subscriptionsApi";
import { formatNGN } from "../../lib/format";
import styles from "./DistributorDashboard.module.css";

const NAV_ITEMS = [
  { label: "Investors", active: true, icon: <IconUsers /> },
  { label: "Subscriptions", active: true, icon: <IconFileText /> },
  { label: "Reports", disabled: true, icon: <IconShield /> },
];

export default function DistributorDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const profiles = useInvestorProfiles(token);
  const subscriptions = useSubscriptions(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  // --- Investor KYC review ---
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  function openProfile(profile: InvestorProfile) {
    setActionError(null);
    setOpenProfileId(openProfileId === profile.contractId ? null : profile.contractId);
    setRejectionReason("");
  }

  async function handleVerify(profile: InvestorProfile) {
    setActionError(null);
    try {
      await profiles.verify(profile.contractId);
      setOpenProfileId(null);
    } catch {
      setActionError("Could not verify this investor's KYC.");
    }
  }

  async function handleRejectProfile(profile: InvestorProfile) {
    setActionError(null);
    try {
      await profiles.reject(profile.contractId, rejectionReason || "Not specified.");
      setOpenProfileId(null);
    } catch {
      setActionError("Could not reject this investor's KYC.");
    }
  }

  // --- Subscription review: AI Risk Agent + allocation ---
  const [openSubId, setOpenSubId] = useState<string | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [allocatedAmountNGN, setAllocatedAmountNGN] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [subRejectionReason, setSubRejectionReason] = useState("");

  async function openSubscription(subscription: SubscriptionItem) {
    setActionError(null);
    if (openSubId === subscription.contractId) {
      setOpenSubId(null);
      return;
    }
    setOpenSubId(subscription.contractId);
    setRisk(null);
    setAllocatedAmountNGN(String(subscription.amountNGN));
    setRiskNotes("");
    setSubRejectionReason("");
    setRiskLoading(true);
    try {
      const res = await subscriptions.riskCheck(subscription.contractId);
      setRisk(res.output);
      setRiskNotes(res.output.notes);
    } catch {
      setActionError("Could not reach the Risk Agent.");
    } finally {
      setRiskLoading(false);
    }
  }

  async function handleAllocate(e: FormEvent, subscription: SubscriptionItem) {
    e.preventDefault();
    setActionError(null);
    try {
      await subscriptions.allocate(subscription.contractId, { allocatedAmountNGN: Number(allocatedAmountNGN), riskNotes });
      setOpenSubId(null);
    } catch {
      setActionError("Could not allocate this subscription — it may exceed the offering's remaining capacity.");
    }
  }

  async function handleRejectSubscription(subscription: SubscriptionItem) {
    setActionError(null);
    try {
      await subscriptions.reject(subscription.contractId, subRejectionReason || "Not specified.");
      setOpenSubId(null);
    } catch {
      setActionError("Could not reject this subscription.");
    }
  }

  const error = actionError ?? orgs.error ?? profiles.error ?? subscriptions.error;
  const pendingProfiles = profiles.data.filter((p) => p.kycStatus === "KycPending");
  const verifiedProfiles = profiles.data.filter((p) => p.kycStatus === "KycVerified");
  const pendingSubs = subscriptions.data.filter((s) => s.status === "Pending");
  const allocatedSubs = subscriptions.data.filter((s) => s.status === "Allocated");

  const profileColumns: DataTableColumn<InvestorProfile>[] = [
    {
      key: "investor",
      header: "Investor",
      render: (p) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{p.fullName}</span>
          <span className={styles.productMeta}>{p.email}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <Button size="sm" variant={openProfileId === p.contractId ? "secondary" : "primary"} onClick={() => openProfile(p)}>
          {openProfileId === p.contractId ? "Close" : "Review"}
        </Button>
      ),
    },
  ];

  const subscriptionColumns: DataTableColumn<SubscriptionItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (s) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{s.productName}</span>
          <span className={styles.productMeta}>{orgName(s.investor)}</span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (s) => <StatusBadge tone="outline">{s.structureType}</StatusBadge> },
    { key: "amount", header: "Requested", mono: true, render: (s) => formatNGN(s.amountNGN) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <Button size="sm" variant={openSubId === s.contractId ? "secondary" : "primary"} onClick={() => openSubscription(s)}>
          {openSubId === s.contractId ? "Close" : "Review"}
        </Button>
      ),
    },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Investors">
      <PageHeader title="Distributor" description="Onboard investors, review KYC, and manage subscription and allocation." />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Pending KYC</div>
          <div className={styles.statValue}>{pendingProfiles.length}</div>
          <div className={styles.statHint}>Awaiting your review</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Verified investors</div>
          <div className={styles.statValue}>{verifiedProfiles.length}</div>
          <div className={styles.statHint}>Can subscribe to notes</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Pending subscriptions</div>
          <div className={styles.statValue}>{pendingSubs.length}</div>
          <div className={styles.statHint}>Awaiting allocation</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Allocated</div>
          <div className={styles.statValue}>{allocatedSubs.length}</div>
          <div className={styles.statHint}>Holdings created</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconUsers /> Investor KYC ({pendingProfiles.length} pending)
            </span>
          }
          description="Investors who signed up choosing your organization as their Distributor."
        />
        <CardBody flush>
          <DataTable
            columns={profileColumns}
            rows={[...pendingProfiles, ...verifiedProfiles]}
            keyExtractor={(p) => p.contractId}
            emptyTitle="No investors yet"
            emptyDescription="Investors who sign up with your organization will appear here."
          />
        </CardBody>
        {openProfileId &&
          (() => {
            const profile = pendingProfiles.find((p) => p.contractId === openProfileId);
            if (!profile) return null;
            return (
              <div className={styles.reviewPanel}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="rejectionReason">Rejection reason (if rejecting)</label>
                  <textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why this investor's KYC doesn't meet requirements…"
                  />
                </div>
                <div className={styles.formActions}>
                  <Button variant="primary" onClick={() => handleVerify(profile)}>
                    <IconClipboardCheck /> Verify KYC
                  </Button>
                  <Button variant="danger" onClick={() => handleRejectProfile(profile)}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })()}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconFileText /> Subscriptions ({pendingSubs.length} pending)
            </span>
          }
          description="Subscription requests from your verified investors."
        />
        <CardBody flush>
          <DataTable
            columns={subscriptionColumns}
            rows={pendingSubs}
            keyExtractor={(s) => s.contractId}
            emptyTitle="No pending subscriptions"
            emptyDescription="Subscriptions from your investors will appear here."
          />
        </CardBody>
        {openSubId &&
          (() => {
            const subscription = pendingSubs.find((s) => s.contractId === openSubId);
            if (!subscription) return null;
            return (
              <div className={styles.reviewPanel}>
                <div className={styles.riskPanel}>
                  <div className={styles.riskHead}>
                    <span className={styles.riskTitle}>
                      <IconClipboardCheck /> AI Risk Agent
                    </span>
                    {risk && (
                      <div className={styles.riskBadges}>
                        <StatusBadge tone={risk.concentrationTier === "Low" ? "success" : risk.concentrationTier === "Medium" ? "warning" : "error"}>
                          {risk.concentrationTier} concentration
                        </StatusBadge>
                        <StatusBadge tone={risk.overallRisk === "Low" ? "success" : risk.overallRisk === "Medium" ? "warning" : "error"}>
                          {risk.overallRisk} overall risk
                        </StatusBadge>
                      </div>
                    )}
                  </div>
                  {riskLoading && <p className={styles.riskNotes}>Consulting the assistant…</p>}
                  {risk && (
                    <>
                      <p className={styles.riskNotes}>{risk.notes}</p>
                      {risk.operationalFlags.length > 0 && (
                        <ul className={styles.riskFlags}>
                          {risk.operationalFlags.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>

                <form className={styles.form} onSubmit={(e) => handleAllocate(e, subscription)}>
                  <div className={styles.field}>
                    <label htmlFor="allocatedAmountNGN">Allocated amount (NGN)</label>
                    <input
                      id="allocatedAmountNGN"
                      required
                      type="number"
                      min="1"
                      max={subscription.amountNGN}
                      value={allocatedAmountNGN}
                      onChange={(e) => setAllocatedAmountNGN(e.target.value)}
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="riskNotes">Risk notes (recorded on the allocation)</label>
                    <textarea id="riskNotes" required value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)} />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="subRejectionReason">Rejection reason (if rejecting instead)</label>
                    <textarea
                      id="subRejectionReason"
                      value={subRejectionReason}
                      onChange={(e) => setSubRejectionReason(e.target.value)}
                      placeholder="Why this subscription is being declined…"
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button type="submit" variant="primary">
                      Allocate
                    </Button>
                    <Button type="button" variant="danger" onClick={() => handleRejectSubscription(subscription)}>
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
              <IconClipboardCheck /> Allocated ({allocatedSubs.length})
            </span>
          }
          description="Subscriptions you've allocated — the investor's Holding now exists on-ledger."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (s: SubscriptionItem) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{s.productName}</span>
                    <span className={styles.productMeta}>{orgName(s.investor)}</span>
                  </div>
                ),
              },
              { key: "units", header: "Units", mono: true, render: (s: SubscriptionItem) => (s.units ?? 0).toLocaleString() },
              { key: "amount", header: "Amount", mono: true, render: (s: SubscriptionItem) => formatNGN(s.amountNGN) },
            ]}
            rows={allocatedSubs}
            keyExtractor={(s) => s.contractId}
            emptyTitle="Nothing allocated yet"
            emptyDescription="Allocated subscriptions will appear here."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
