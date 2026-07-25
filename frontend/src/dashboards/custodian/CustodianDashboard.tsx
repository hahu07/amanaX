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
import { useInvestmentNotes } from "../../hooks/useInvestmentNotes";
import { useDistributionRequests } from "../../hooks/useDistributionRequests";
import { useProfitDistributions } from "../../hooks/useProfitDistributions";
import type { InvestmentNote } from "../../api/investmentNotesApi";
import type { DistributionRequestItem, ProfitDistributionItem } from "../../api/distributionsApi";
import { getCustodianReport, type GeneratedReport } from "../../api/reportsApi";
import { formatNGN } from "../../lib/format";
import styles from "./CustodianDashboard.module.css";

const NAV_ITEMS = [
  { label: "Notes", active: true, icon: <IconLayers /> },
  { label: "Distributions", active: true, icon: <IconFileText /> },
  { label: "Reports", active: true, icon: <IconShield /> },
];

export default function CustodianDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const notes = useInvestmentNotes(token);
  const requests = useDistributionRequests(token);
  const distributions = useProfitDistributions(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [totalAmountNGN, setTotalAmountNGN] = useState("");

  function openPropose(note: InvestmentNote) {
    setActionError(null);
    setProposingFor(proposingFor === note.contractId ? null : note.contractId);
    setPeriodLabel("");
    setTotalAmountNGN("");
  }

  async function handlePropose(e: FormEvent, note: InvestmentNote) {
    e.preventDefault();
    setActionError(null);
    try {
      await requests.propose(note.contractId, { periodLabel, totalAmountNGN: Number(totalAmountNGN) });
      setProposingFor(null);
    } catch {
      setActionError("Could not propose this distribution — check that investors have been allocated units of this note.");
    }
  }

  async function handleWithdraw(request: DistributionRequestItem) {
    setActionError(null);
    try {
      await requests.withdraw(request.contractId);
    } catch {
      setActionError("Could not withdraw this distribution request.");
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
      const res = await getCustodianReport(token);
      setReport(res.output);
    } catch {
      setActionError("Could not reach the Reporting Agent.");
    } finally {
      setReportLoading(false);
    }
  }

  const error = actionError ?? orgs.error ?? notes.error ?? requests.error ?? distributions.error;

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
    { key: "supply", header: "Total supply", mono: true, render: (n) => n.totalSupply.toLocaleString() },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (n) => (
        <Button size="sm" variant={proposingFor === n.contractId ? "secondary" : "primary"} onClick={() => openPropose(n)}>
          {proposingFor === n.contractId ? "Close" : "Propose distribution"}
        </Button>
      ),
    },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Notes">
      <PageHeader title="Custodian" description="Calculate and execute profit distributions to investors, with Trustee oversight." />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Issued notes</div>
          <div className={styles.statValue}>{notes.data.length}</div>
          <div className={styles.statHint}>Available to distribute against</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Pending requests</div>
          <div className={styles.statValue}>{requests.data.length}</div>
          <div className={styles.statHint}>Awaiting Trustee approval</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Distributions paid</div>
          <div className={styles.statValue}>{distributions.data.length}</div>
          <div className={styles.statHint}>Investor statements recorded</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconLayers /> Investment notes ({notes.data.length})
            </span>
          }
          description="Issued notes with investor holdings you can distribute profit against."
        />
        <CardBody flush>
          <DataTable
            columns={noteColumns}
            rows={notes.data}
            keyExtractor={(n) => n.contractId}
            emptyTitle="No notes yet"
            emptyDescription="Issued notes will appear here once an Issuing House completes issuance."
          />
        </CardBody>
        {proposingFor &&
          (() => {
            const note = notes.data.find((n) => n.contractId === proposingFor);
            if (!note) return null;
            return (
              <div className={styles.reviewPanel}>
                <form className={styles.form} onSubmit={(e) => handlePropose(e, note)}>
                  <div className={styles.field}>
                    <label htmlFor="periodLabel">Period</label>
                    <input id="periodLabel" required value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Q1 2026" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="totalAmountNGN">Total distributable amount (NGN)</label>
                    <input
                      id="totalAmountNGN"
                      required
                      type="number"
                      min="1"
                      value={totalAmountNGN}
                      onChange={(e) => setTotalAmountNGN(e.target.value)}
                      placeholder="1500000"
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button type="submit" variant="primary">
                      Calculate &amp; propose
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
              <IconFileText /> Pending requests ({requests.data.length})
            </span>
          }
          description="Distributions you've proposed, awaiting Trustee approval."
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
                    <span className={styles.productMeta}>{r.periodLabel}</span>
                  </div>
                ),
              },
              { key: "shares", header: "Investors", mono: true, render: (r: DistributionRequestItem) => r.shares.length },
              { key: "amount", header: "Total amount", mono: true, render: (r: DistributionRequestItem) => formatNGN(r.totalAmountNGN) },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (r: DistributionRequestItem) => (
                  <Button size="sm" variant="danger" onClick={() => handleWithdraw(r)}>
                    Withdraw
                  </Button>
                ),
              },
            ]}
            rows={requests.data}
            keyExtractor={(r) => r.contractId}
            emptyTitle="No pending requests"
            emptyDescription="Proposed distributions will appear here until the Trustee decides."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconClipboardCheck /> Distribution history ({distributions.data.length})
            </span>
          }
          description="Per-investor amounts recorded once the Trustee approves."
        />
        <CardBody flush>
          <DataTable
            columns={[
              {
                key: "product",
                header: "Product",
                render: (d: ProfitDistributionItem) => (
                  <div className={styles.productCell}>
                    <span className={styles.productName}>{d.productName}</span>
                    <span className={styles.productMeta}>{d.periodLabel}</span>
                  </div>
                ),
              },
              { key: "investor", header: "Investor", render: (d: ProfitDistributionItem) => orgName(d.investor) },
              { key: "amount", header: "Amount", mono: true, render: (d: ProfitDistributionItem) => formatNGN(d.amountNGN) },
            ]}
            rows={distributions.data}
            keyExtractor={(d) => d.contractId}
            emptyTitle="Nothing distributed yet"
            emptyDescription="Approved distributions will appear here."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconShield /> Custodian report
            </span>
          }
          description="A summary of the notes and distributions you administer, generated by the AI Reporting Agent."
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
