import { useCallback, useEffect, useState } from "react";
import { createUser, listUsers, type OrgUser } from "../api/orgsApi";
import type { OrgRole } from "../auth/types";

/**
 * Owns fetching + list state for org users. See useOrganizations for the
 * same pattern — presentational components call `create`/`refresh` and
 * handle their own error messaging + form state.
 */
export function useUsers(token: string, org?: string) {
  const [data, setData] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const users = await listUsers(token, org);
      setData(users);
      setError(null);
    } catch {
      setError("Could not load users from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token, org]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: { org: string; userId: string; email: string; displayName: string; role: OrgRole }) => {
      const user = await createUser(token, params);
      await refresh();
      return user;
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, create };
}
