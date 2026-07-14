import { useCallback, useEffect, useState } from "react";
import { createOrg, listOrgs, setOrgActive, type Organization } from "../api/orgsApi";
import type { OrgRole } from "../auth/types";

/**
 * Owns fetching + list state for organizations, so dashboard components stay
 * focused on rendering + user interaction (see design brief "Architecture"
 * section — data-fetching must not live inline in page components).
 *
 * Mutations (`createOrg`, `setOrgActive`) perform the write, refresh the
 * list on success, and re-throw on failure so the caller can show a
 * contextual error message and handle form state.
 */
export function useOrganizations(token: string) {
  const [data, setData] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await listOrgs(token);
      setData(orgs);
      setError(null);
    } catch {
      setError("Could not load organizations from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: { name: string; role: OrgRole }) => {
      const org = await createOrg(token, params);
      await refresh();
      return org;
    },
    [token, refresh],
  );

  const setActive = useCallback(
    async (contractId: string, active: boolean) => {
      await setOrgActive(token, contractId, active);
      await refresh();
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, create, setActive };
}
