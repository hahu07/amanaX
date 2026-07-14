import { useState, type FormEvent } from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/Card";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { IconFileText, IconLayers, IconPlus, IconShield } from "../../components/icons";
import { useAuth } from "../../auth/AuthContext";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useProposals } from "../../hooks/useProposals";
import { useStructures } from "../../hooks/useStructures";
import { PRODUCT_TYPES, type ProductProposal, type ProductStructure, type ProductType } from "../../api/productsApi";
import { formatNGN } from "../../lib/format";
import styles from "./FundManagerDashboard.module.css";

const NAV_ITEMS = [
  { label: "Proposals", active: true, icon: <IconFileText /> },
  { label: "Reports", disabled: true, icon: <IconShield /> },
];

export default function FundManagerDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const proposals = useProposals(token);
  const structures = useStructures(token);

  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [issuingHouse, setIssuingHouse] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [proposedType, setProposedType] = useState<ProductType>("Murabahah");
  const [targetSizeNGN, setTargetSizeNGN] = useState("");
  const [tenorMonths, setTenorMonths] = useState("");

  const error = actionError ?? orgs.error ?? proposals.error ?? structures.error;

  const issuingHouses = orgs.data.filter((o) => o.role === "IssuingHouse" && o.active);
  const orgName = (party: string) => orgs.data.find((o) => o.party === party)?.name ?? party;

  const draftCount = structures.data.filter((s) => s.status === "ProductStructure_Draft").length;
  const finalizedCount = structures.data.filter((s) => s.status === "ProductStructure_Finalized").length;

  async function handlePropose(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await proposals.create({
        issuingHouse,
        productName,
        description,
        proposedType,
        targetSizeNGN: Number(targetSizeNGN),
        tenorMonths: Number(tenorMonths),
      });
      setProductName("");
      setDescription("");
      setTargetSizeNGN("");
      setTenorMonths("");
      setShowForm(false);
    } catch {
      setActionError("Could not submit the proposal.");
    }
  }

  async function handleWithdraw(proposal: ProductProposal) {
    setActionError(null);
    try {
      await proposals.withdraw(proposal.contractId);
    } catch {
      setActionError("Could not withdraw the proposal.");
    }
  }

  const proposalColumns: DataTableColumn<ProductProposal>[] = [
    {
      key: "product",
      header: "Product",
      render: (p) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{p.productName}</span>
          <span className={styles.productMeta}>to {orgName(p.issuingHouse)}</span>
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
        <Button size="sm" variant="danger" onClick={() => handleWithdraw(p)}>
          Withdraw
        </Button>
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
          <span className={styles.productMeta}>with {orgName(s.issuingHouse)}</span>
        </div>
      ),
    },
    { key: "type", header: "Structure type", render: (s) => <StatusBadge tone="outline">{s.structureType}</StatusBadge> },
    { key: "minSub", header: "Min. subscription", mono: true, render: (s) => formatNGN(s.minSubscriptionNGN) },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <StatusBadge tone={s.status === "ProductStructure_Finalized" ? "success" : "warning"}>
          {s.status === "ProductStructure_Finalized" ? "Finalized" : "In structuring"}
        </StatusBadge>
      ),
    },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Proposals">
      <PageHeader
        title="Fund Manager"
        description="Propose new Shariah-compliant investment products and track them through structuring."
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Pending proposals</div>
          <div className={styles.statValue}>{proposals.data.length}</div>
          <div className={styles.statHint}>Awaiting Issuing House review</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>In structuring</div>
          <div className={styles.statValue}>{draftCount}</div>
          <div className={styles.statHint}>Draft structures in progress</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Finalized</div>
          <div className={styles.statValue}>{finalizedCount}</div>
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
          description="Products you've proposed, awaiting an Issuing House to structure them."
          actions={
            <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)} disabled={issuingHouses.length === 0}>
              <IconPlus /> {showForm ? "Cancel" : "Propose a product"}
            </Button>
          }
        />
        {issuingHouses.length === 0 && !showForm && (
          <div className={styles.formPanel}>
            <Alert tone="neutral">No active Issuing House is onboarded yet — ask the Platform Operator to add one.</Alert>
          </div>
        )}
        {showForm && (
          <div className={styles.formPanel}>
            <form className={styles.form} onSubmit={handlePropose}>
              <div className={styles.field}>
                <label htmlFor="issuingHouse">Issuing House</label>
                <select id="issuingHouse" required value={issuingHouse} onChange={(e) => setIssuingHouse(e.target.value)}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {issuingHouses.map((org) => (
                    <option key={org.contractId} value={org.party}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="productName">Product name</label>
                <input
                  id="productName"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. AmanaX Sukuk Note I"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="proposedType">Proposed structure</label>
                <select id="proposedType" value={proposedType} onChange={(e) => setProposedType(e.target.value as ProductType)}>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="targetSizeNGN">Target size (NGN)</label>
                <input
                  id="targetSizeNGN"
                  required
                  type="number"
                  min="1"
                  value={targetSizeNGN}
                  onChange={(e) => setTargetSizeNGN(e.target.value)}
                  placeholder="500000000"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="tenorMonths">Tenor (months)</label>
                <input
                  id="tenorMonths"
                  required
                  type="number"
                  min="1"
                  value={tenorMonths}
                  onChange={(e) => setTenorMonths(e.target.value)}
                  placeholder="24"
                />
              </div>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Use of proceeds, underlying assets, and investor rationale…"
                />
              </div>
              <div className={styles.formActions}>
                <Button type="submit" variant="primary">
                  Submit proposal
                </Button>
              </div>
            </form>
          </div>
        )}
        <CardBody flush>
          <DataTable
            columns={proposalColumns}
            rows={proposals.data}
            keyExtractor={(p) => p.contractId}
            emptyTitle="No pending proposals"
            emptyDescription="Propose your first product to get started."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconLayers /> Structures ({structures.data.length})
            </span>
          }
          description="Products an Issuing House has taken into structuring."
        />
        <CardBody flush>
          <DataTable
            columns={structureColumns}
            rows={structures.data}
            keyExtractor={(s) => s.contractId}
            emptyTitle="Nothing in structuring yet"
            emptyDescription="Once an Issuing House structures one of your proposals, it will show up here."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
