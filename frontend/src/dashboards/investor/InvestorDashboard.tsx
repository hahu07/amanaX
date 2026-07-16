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
import { useInvestorProfiles } from "../../hooks/useInvestorProfiles";
import { useInvestmentNotes } from "../../hooks/useInvestmentNotes";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import type { InvestmentNote } from "../../api/investmentNotesApi";
import type { SubscriptionItem } from "../../api/subscriptionsApi";
import { formatNGN } from "../../lib/format";
import styles from "./InvestorDashboard.module.css";

const NAV_ITEMS = [
  { label: "Notes", active: true, icon: <IconLayers /> },
  { label: "Subscriptions", active: true, icon: <IconFileText /> },
  { label: "Reports", disabled: true, icon: <IconShield /> },
];

export default function InvestorDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const profiles = useInvestorProfiles(token);
  const notes = useInvestmentNotes(token);
  const subscriptions = useSubscriptions(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  const myProfile = profiles.data[0];
  const isVerified = myProfile?.kycStatus === "KycVerified";

  const [subscribingFor, setSubscribingFor] = useState<string | null>(null);
  const [amountNGN, setAmountNGN] = useState("");

  function openSubscribe(note: InvestmentNote) {
    setActionError(null);
    setSubscribingFor(subscribingFor === note.contractId ? null : note.contractId);
    setAmountNGN("");
  }

  async function handleSubscribe(e: FormEvent, note: InvestmentNote) {
    e.preventDefault();
    setActionError(null);
    try {
      await subscriptions.subscribe(note.contractId, Number(amountNGN));
      setSubscribingFor(null);
    } catch {
      setActionError("Could not submit this subscription — check the amount meets the minimum subscription.");
    }
  }

  async function handleWithdraw(subscription: SubscriptionItem) {
    setActionError(null);
    try {
      await subscriptions.withdraw(subscription.contractId);
    } catch {
      setActionError("Could not withdraw this subscription.");
    }
  }

  const error = actionError ?? orgs.error ?? profiles.error ?? notes.error ?? subscriptions.error;
  const pendingSubs = subscriptions.data.filter((s) => s.status === "Pending");
  const holdings = subscriptions.data.filter((s) => s.status === "Allocated");
  const alreadySubscribedNoteCids = new Set(subscriptions.data.map((s) => s.noteCid));

  const noteColumns: DataTableColumn<InvestmentNote>[] = [
    {
      key: "product",
      header: "Product",
      render: (n) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{n.productName}</span>
          <span className={styles.productMeta}>
            {n.symbol} · {orgName(n.issuingHouse)}
          </span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (n) => <StatusBadge tone="outline">{n.structureType}</StatusBadge> },
    { key: "minSub", header: "Min. subscription", mono: true, render: (n) => formatNGN(n.minSubscriptionNGN) },
    { key: "tenor", header: "Tenor", mono: true, render: (n) => `${n.tenorMonths} mo` },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (n) => {
        if (!isVerified) return <StatusBadge tone="outline">KYC required</StatusBadge>;
        if (alreadySubscribedNoteCids.has(n.contractId)) return <StatusBadge tone="outline">Already subscribed</StatusBadge>;
        return (
          <Button size="sm" variant={subscribingFor === n.contractId ? "secondary" : "primary"} onClick={() => openSubscribe(n)}>
            {subscribingFor === n.contractId ? "Close" : "Subscribe"}
          </Button>
        );
      },
    },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Notes">
      <PageHeader title="Investor" description="Subscribe to approved investment products and track your holdings." />

      {error && <Alert tone="error">{error}</Alert>}
      {myProfile && myProfile.kycStatus === "KycPending" && (
        <Alert tone="neutral">
          Your KYC is pending review by {orgName(myProfile.distributor)}. You'll be able to subscribe once it's verified.
        </Alert>
      )}
      {myProfile && myProfile.kycStatus === "KycRejected" && <Alert tone="error">Your KYC was rejected by {orgName(myProfile.distributor)}.</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>KYC status</div>
          <div className={styles.statValue}>
            <StatusBadge tone={isVerified ? "success" : myProfile?.kycStatus === "KycRejected" ? "error" : "warning"}>
              {myProfile?.kycStatus === "KycVerified" ? "Verified" : myProfile?.kycStatus === "KycRejected" ? "Rejected" : "Pending"}
            </StatusBadge>
          </div>
          <div className={styles.statHint}>via {myProfile ? orgName(myProfile.distributor) : "—"}</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Pending subscriptions</div>
          <div className={styles.statValue}>{pendingSubs.length}</div>
          <div className={styles.statHint}>Awaiting Distributor allocation</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Holdings</div>
          <div className={styles.statValue}>{holdings.length}</div>
          <div className={styles.statHint}>Allocated units of an issued note</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconLayers /> Available notes ({notes.data.length})
            </span>
          }
          description="Investment Notes issued and open for subscription."
        />
        <CardBody flush>
          <DataTable
            columns={noteColumns}
            rows={notes.data}
            keyExtractor={(n) => n.contractId}
            emptyTitle="No notes available yet"
            emptyDescription="Issued notes will appear here once an Issuing House completes issuance."
          />
        </CardBody>
        {subscribingFor &&
          (() => {
            const note = notes.data.find((n) => n.contractId === subscribingFor);
            if (!note) return null;
            return (
              <div className={styles.reviewPanel}>
                <form className={styles.form} onSubmit={(e) => handleSubscribe(e, note)}>
                  <div className={styles.field}>
                    <label htmlFor="amountNGN">Amount (NGN)</label>
                    <input
                      id="amountNGN"
                      required
                      type="number"
                      min={note.minSubscriptionNGN}
                      value={amountNGN}
                      onChange={(e) => setAmountNGN(e.target.value)}
                      placeholder={String(note.minSubscriptionNGN)}
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button type="submit" variant="primary">
                      Subscribe
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
              <IconFileText /> My subscriptions ({pendingSubs.length})
            </span>
          }
          description="Subscriptions awaiting your Distributor's allocation decision."
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
                    <span className={styles.productMeta}>{s.symbol}</span>
                  </div>
                ),
              },
              { key: "amount", header: "Requested amount", mono: true, render: (s: SubscriptionItem) => formatNGN(s.amountNGN) },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (s: SubscriptionItem) => (
                  <Button size="sm" variant="danger" onClick={() => handleWithdraw(s)}>
                    Withdraw
                  </Button>
                ),
              },
            ]}
            rows={pendingSubs}
            keyExtractor={(s) => s.contractId}
            emptyTitle="No pending subscriptions"
            emptyDescription="Subscribe to a note above to see it here."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconClipboardCheck /> My holdings ({holdings.length})
            </span>
          }
          description="Units allocated to you — your standard-compliant Holding of each note."
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
                    <span className={styles.productMeta}>{s.symbol}</span>
                  </div>
                ),
              },
              { key: "units", header: "Units", mono: true, render: (s: SubscriptionItem) => (s.units ?? 0).toLocaleString() },
              { key: "amount", header: "Amount", mono: true, render: (s: SubscriptionItem) => formatNGN(s.amountNGN) },
            ]}
            rows={holdings}
            keyExtractor={(s) => s.contractId}
            emptyTitle="No holdings yet"
            emptyDescription="Allocated units will appear here once your Distributor processes a subscription."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
