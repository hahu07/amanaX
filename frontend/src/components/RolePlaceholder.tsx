import { DashboardLayout } from "./DashboardLayout";

// Placeholder dashboard body — this role's real functionality lands in a
// later milestone (see docs/implementation_plan.md §4). Milestone 1 only
// proves login + role-based routing gets each participant to their own
// shell.
export function RolePlaceholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <DashboardLayout title={title}>
      <p>This dashboard is a placeholder. Its functionality lands in {milestone}.</p>
    </DashboardLayout>
  );
}
