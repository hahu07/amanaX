import { useCallback, useEffect, useState } from "react";
import { listInvestorProfiles, rejectInvestorProfile, verifyInvestorProfile } from "../api/investorsApi";

export function useInvestorProfiles(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listInvestorProfiles>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listInvestorProfiles(token));
      setError(null);
    } catch {
      setError("Could not load investor profiles from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const verify = useCallback(
    async (contractId: string) => {
      const profile = await verifyInvestorProfile(token, contractId);
      await refresh();
      return profile;
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string, rejectionReason: string) => {
      const profile = await rejectInvestorProfile(token, contractId, rejectionReason);
      await refresh();
      return profile;
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, verify, reject };
}
