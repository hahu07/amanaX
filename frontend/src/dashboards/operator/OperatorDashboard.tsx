import { useState, type FormEvent } from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/Card";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { StatusBadge, ActiveStatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { IconBuilding, IconFileText, IconPlus, IconShield, IconUsers } from "../../components/icons";
import { ApiError } from "../../api/backendClient";
import { useAuth } from "../../auth/AuthContext";
import { ORG_ROLES, type OrgRole } from "../../auth/types";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useUsers } from "../../hooks/useUsers";
import { useAuditLog } from "../../hooks/useAuditLog";
import type { Organization, OrgUser } from "../../api/orgsApi";
import { getPlatformReport, type AuditLogEntry, type GeneratedReport } from "../../api/reportsApi";
import styles from "./OperatorDashboard.module.css";

const NAV_ITEMS = [
  { label: "Organizations", active: true, icon: <IconBuilding /> },
  { label: "Reports", active: true, icon: <IconFileText /> },
  { label: "Audit Log", active: true, icon: <IconShield /> },
];

export default function OperatorDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const orgs = useOrganizations(token);
  const users = useUsers(token);
  const auditLog = useAuditLog(token);

  const [actionError, setActionError] = useState<string | null>(null);

  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgRole, setOrgRole] = useState<OrgRole>("FundManager");

  const [showUserForm, setShowUserForm] = useState(false);
  const [userOrgParty, setUserOrgParty] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

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
      const res = await getPlatformReport(token);
      setReport(res.output);
    } catch {
      setActionError("Could not reach the Reporting Agent.");
    } finally {
      setReportLoading(false);
    }
  }

  const error = actionError ?? orgs.error ?? users.error ?? auditLog.error;

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      const org = await orgs.create({ name: orgName, role: orgRole });
      setOrgName("");
      setUserOrgParty(org.party);
      setShowOrgForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setActionError(JSON.parse(err.message).error);
      } else {
        setActionError("Could not create organization.");
      }
    }
  }

  async function handleToggleActive(org: Organization) {
    setActionError(null);
    try {
      await orgs.setActive(org.contractId, !org.active);
    } catch {
      setActionError("Could not update organization status.");
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    const org = orgs.data.find((o) => o.party === userOrgParty);
    if (!org) {
      setActionError("Pick an organization first.");
      return;
    }
    try {
      await users.create({
        org: org.party,
        userId: userEmail,
        email: userEmail,
        displayName: userDisplayName,
        role: org.role,
      });
      setUserEmail("");
      setUserDisplayName("");
      setShowUserForm(false);
    } catch {
      setActionError("Could not create user.");
    }
  }

  const activeOrgCount = orgs.data.filter((o) => o.active).length;

  const orgColumns: DataTableColumn<Organization>[] = [
    {
      key: "name",
      header: "Name",
      render: (org) => (
        <div className={styles.orgCell}>
          <span className={styles.orgName}>{org.name}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (org) => <StatusBadge tone="outline">{org.role}</StatusBadge>,
    },
    { key: "party", header: "Party", mono: true, render: (org) => org.party },
    {
      key: "status",
      header: "Status",
      render: (org) => <ActiveStatusBadge active={org.active} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (org) => (
        <Button size="sm" variant={org.active ? "danger" : "secondary"} onClick={() => handleToggleActive(org)}>
          {org.active ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  const userColumns: DataTableColumn<OrgUser>[] = [
    { key: "name", header: "Name", render: (u) => u.displayName },
    { key: "email", header: "Email", render: (u) => u.email },
    {
      key: "role",
      header: "Role",
      render: (u) => <StatusBadge tone="outline">{u.role}</StatusBadge>,
    },
    { key: "org", header: "Org party", mono: true, render: (u) => u.org },
    {
      key: "status",
      header: "Status",
      render: (u) => <ActiveStatusBadge active={u.active} />,
    },
  ];

  const auditLogColumns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: "occurredAt",
      header: "When",
      mono: true,
      render: (e) => new Date(e.occurredAt).toLocaleString(),
    },
    { key: "kind", header: "Event", render: (e) => <StatusBadge tone="outline">{e.kind}</StatusBadge> },
    { key: "agent", header: "Agent", render: (e) => e.agent },
    { key: "summary", header: "Summary", render: (e) => e.summary },
  ];

  return (
    <AppShell navItems={NAV_ITEMS} pageLabel="Organizations">
      <PageHeader
        title="Platform Operator"
        description="Onboard and manage the organizations and users participating in the AmanaX network."
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className={styles.stats}>
        <Card padded>
          <div className={styles.statLabel}>Total organizations</div>
          <div className={styles.statValue}>{orgs.data.length}</div>
          <div className={styles.statHint}>Across {ORG_ROLES.length} regulated roles</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Active organizations</div>
          <div className={styles.statValue}>{activeOrgCount}</div>
          <div className={styles.statHint}>{orgs.data.length - activeOrgCount} inactive</div>
        </Card>
        <Card padded>
          <div className={styles.statLabel}>Total users</div>
          <div className={styles.statValue}>{users.data.length}</div>
          <div className={styles.statHint}>Onboarded across all organizations</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconBuilding /> Organizations ({orgs.data.length})
            </span>
          }
          description="Institutions participating in the AmanaX network."
          actions={
            <Button variant="primary" size="sm" onClick={() => setShowOrgForm((v) => !v)}>
              <IconPlus /> {showOrgForm ? "Cancel" : "Onboard organization"}
            </Button>
          }
        />
        {showOrgForm && (
          <div className={styles.formPanel}>
            <form className={styles.form} onSubmit={handleCreateOrg}>
              <div className={styles.field}>
                <label htmlFor="orgName">Name</label>
                <input id="orgName" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Amana Fund Managers Ltd" />
              </div>
              <div className={styles.field}>
                <label htmlFor="orgRole">Role</label>
                <select id="orgRole" value={orgRole} onChange={(e) => setOrgRole(e.target.value as OrgRole)}>
                  {ORG_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formActions}>
                <Button type="submit" variant="primary">
                  Onboard organization
                </Button>
              </div>
            </form>
          </div>
        )}
        <CardBody flush>
          <DataTable
            columns={orgColumns}
            rows={orgs.data}
            keyExtractor={(o) => o.contractId}
            emptyTitle="No organizations yet"
            emptyDescription="Onboard the first participating institution to get started."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconUsers /> Users ({users.data.length})
            </span>
          }
          description="Individual users authorised to act on behalf of an organization."
          actions={
            <Button variant="primary" size="sm" onClick={() => setShowUserForm((v) => !v)} disabled={orgs.data.length === 0}>
              <IconPlus /> {showUserForm ? "Cancel" : "Onboard user"}
            </Button>
          }
        />
        {showUserForm && (
          <div className={styles.formPanel}>
            <form className={styles.form} onSubmit={handleCreateUser}>
              <div className={styles.field}>
                <label htmlFor="userOrgParty">Organization</label>
                <select id="userOrgParty" required value={userOrgParty} onChange={(e) => setUserOrgParty(e.target.value)}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {orgs.data.map((org) => (
                    <option key={org.contractId} value={org.party}>
                      {org.name} ({org.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="userEmail">Email</label>
                <input id="userEmail" required type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="name@org.com" />
              </div>
              <div className={styles.field}>
                <label htmlFor="userDisplayName">Display name</label>
                <input id="userDisplayName" required value={userDisplayName} onChange={(e) => setUserDisplayName(e.target.value)} placeholder="Full name" />
              </div>
              <div className={styles.formActions}>
                <Button type="submit" variant="primary">
                  Onboard user
                </Button>
              </div>
            </form>
          </div>
        )}
        <CardBody flush>
          <DataTable
            columns={userColumns}
            rows={users.data}
            keyExtractor={(u) => u.contractId}
            emptyTitle="No users yet"
            emptyDescription="Onboard an organization first, then add its users here."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconFileText /> Platform report
            </span>
          }
          description="A network-wide summary of organizations and users, generated by the AI Reporting Agent."
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

      <Card>
        <CardHeader
          title={
            <span className={styles.cardTitle}>
              <IconShield /> Audit log ({auditLog.data.length})
            </span>
          }
          description="The full platform audit trail — every off-ledger AI-agent action across every organization."
        />
        <CardBody flush>
          <DataTable
            columns={auditLogColumns}
            rows={auditLog.data}
            keyExtractor={(e) => e.contractId}
            emptyTitle="No audit events yet"
            emptyDescription="AI-agent activity across the network will appear here."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
