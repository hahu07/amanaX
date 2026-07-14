import { AppShell } from "./AppShell";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";
import { IconClock, IconClipboardCheck, IconLayers } from "./icons";
import styles from "./RolePlaceholder.module.css";

// Grounded in docs/prompt.md's role responsibilities and the 15-step MVP
// workflow — nothing here is invented. Keyed by the same `title` string each
// dashboard already passes in, so the 8 thin per-role dashboard files below
// don't need to change.
const ROLE_INFO: Record<string, { description: string; capabilities: string[] }> = {
  "Fund Manager": {
    description: "Proposes new Shariah-compliant investment products and initiates the product lifecycle.",
    capabilities: [
      "Submit product proposals for Issuing House review",
      "Track a proposal through structuring and approval",
      "Collaborate with the Issuing House on product terms",
    ],
  },
  "Issuing House": {
    description: "Structures Islamic Investment Notes from proposals and orchestrates the approval workflow.",
    capabilities: [
      "Finalize product structure with AI-assisted recommendations",
      "Prepare and submit regulatory filings to the SEC",
      "Coordinate Shariah Advisor and Trustee review stages",
    ],
  },
  Trustee: {
    description: "Reviews product governance and investor-protection terms before issuance.",
    capabilities: [
      "Review governance and investor-protection terms",
      "Certify Trustee approval on-ledger",
      "Monitor ongoing compliance with trust deed terms",
    ],
  },
  "Shariah Advisor": {
    description: "Reviews and certifies Shariah compliance of proposed investment structures.",
    capabilities: [
      "Review proposed structures against Shariah screening criteria",
      "Issue Shariah compliance certification",
      "Maintain an auditable compliance record per product",
    ],
  },
  Custodian: {
    description: "Safeguards fund assets and processes profit distributions to investors.",
    capabilities: [
      "Hold and safeguard underlying fund assets",
      "Process profit distribution instructions",
      "Reconcile custody records against ledger state",
    ],
  },
  Distributor: {
    description: "Onboards investors and manages subscription and allocation.",
    capabilities: [
      "Onboard investors and manage KYC status",
      "Process subscriptions to open product offerings",
      "Track allocation outcomes per investor",
    ],
  },
  SEC: {
    description: "Reviews regulatory submissions and approves product issuance.",
    capabilities: [
      "Review regulatory submissions from the Issuing House",
      "Approve or reject product issuance",
      "Access the full audit trail for supervisory oversight",
    ],
  },
  Investor: {
    description: "Subscribes to approved investment products and tracks holdings.",
    capabilities: [
      "Complete investor onboarding and KYC",
      "Subscribe to open product offerings",
      "View holdings, distributions, and reports",
    ],
  },
};

// Placeholder dashboard body — this role's real functionality lands in a
// later milestone (see docs/implementation_plan.md §4). Milestone 1 only
// proves login + role-based routing gets each participant to their own
// shell. Shared by all 8 not-yet-built role dashboards, parameterized by
// title + milestone.
export function RolePlaceholder({ title, milestone }: { title: string; milestone: string }) {
  const info = ROLE_INFO[title];
  const navItems = [{ label: title, active: true, icon: <IconLayers /> }];

  return (
    <AppShell navItems={navItems} pageLabel={title}>
      <PageHeader title={title} description={info?.description} />
      <EmptyState
        icon={<IconClipboardCheck />}
        title="This dashboard isn't built yet"
        description={info?.description ?? "This role's functionality lands in a later milestone."}
        footer={
          <div className={styles.footerStack}>
            <span className={styles.milestoneNote}>
              <IconClock />
              Unlocks in {milestone}
            </span>
            {info && (
              <div>
                <p className={styles.capabilitiesLabel}>Coming to this role</p>
                <ul className={styles.capabilities}>
                  {info.capabilities.map((capability) => (
                    <li key={capability} className={styles.capabilityItem}>
                      <IconClipboardCheck className={styles.capabilityIcon} />
                      {capability}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />
    </AppShell>
  );
}
