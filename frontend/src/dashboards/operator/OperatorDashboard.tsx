import { useEffect, useState, type FormEvent } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { useAuth } from "../../auth/AuthContext";
import { ORG_ROLES, type OrgRole } from "../../auth/types";
import { createOrg, createUser, listOrgs, listUsers, setOrgActive, type Organization, type OrgUser } from "../../api/orgsApi";

export default function OperatorDashboard() {
  const { auth } = useAuth();
  const token = auth!.token;

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [orgRole, setOrgRole] = useState<OrgRole>("FundManager");

  const [userOrgParty, setUserOrgParty] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

  async function refresh() {
    try {
      const [o, u] = await Promise.all([listOrgs(token), listUsers(token)]);
      setOrgs(o);
      setUsers(u);
    } catch {
      setError("Could not load orgs/users from the backend.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const org = await createOrg(token, { name: orgName, role: orgRole });
      setOrgName("");
      setUserOrgParty(org.party);
      await refresh();
    } catch {
      setError("Could not create organization.");
    }
  }

  async function handleToggleActive(org: Organization) {
    setError(null);
    try {
      await setOrgActive(token, org.contractId, !org.active);
      await refresh();
    } catch {
      setError("Could not update organization status.");
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const org = orgs.find((o) => o.party === userOrgParty);
    if (!org) {
      setError("Pick an organization first.");
      return;
    }
    try {
      await createUser(token, {
        org: org.party,
        userId: `${userEmail}`,
        email: userEmail,
        displayName: userDisplayName,
        role: org.role,
      });
      setUserEmail("");
      setUserDisplayName("");
      await refresh();
    } catch {
      setError("Could not create user.");
    }
  }

  return (
    <DashboardLayout title="Platform Operator">
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section style={{ marginBottom: "2rem" }}>
        <h2>Onboard an organization</h2>
        <form onSubmit={handleCreateOrg} style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
          <label>
            Name
            <input name="orgName" required value={orgName} onChange={(e) => setOrgName(e.target.value)} style={{ display: "block" }} />
          </label>
          <label>
            Role
            <select name="orgRole" value={orgRole} onChange={(e) => setOrgRole(e.target.value as OrgRole)} style={{ display: "block" }}>
              {ORG_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Onboard organization</button>
        </form>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Organizations ({orgs.length})</h2>
        <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Name</th>
              <th>Role</th>
              <th>Party</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.contractId} style={{ borderBottom: "1px solid #eee" }}>
                <td>{org.name}</td>
                <td>{org.role}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.8em" }}>{org.party}</td>
                <td>{org.active ? "yes" : "no"}</td>
                <td>
                  <button onClick={() => handleToggleActive(org)}>{org.active ? "Deactivate" : "Reactivate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Onboard a user</h2>
        <form onSubmit={handleCreateUser} style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
          <label>
            Organization
            <select name="userOrgParty" required value={userOrgParty} onChange={(e) => setUserOrgParty(e.target.value)} style={{ display: "block" }}>
              <option value="" disabled>
                Select…
              </option>
              {orgs.map((org) => (
                <option key={org.contractId} value={org.party}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
          </label>
          <label>
            Email
            <input name="userEmail" required type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} style={{ display: "block" }} />
          </label>
          <label>
            Display name
            <input name="userDisplayName" required value={userDisplayName} onChange={(e) => setUserDisplayName(e.target.value)} style={{ display: "block" }} />
          </label>
          <button type="submit">Onboard user</button>
        </form>
      </section>

      <section>
        <h2>Users ({users.length})</h2>
        <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Org</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.contractId} style={{ borderBottom: "1px solid #eee" }}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.8em" }}>{u.org}</td>
                <td>{u.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DashboardLayout>
  );
}
