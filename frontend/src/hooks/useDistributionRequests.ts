import { useCallback, useEffect, useState } from "react";
import {
  approveDistributionRequest,
  listDistributionRequests,
  proposeDistribution,
  rejectDistributionRequest,
  withdrawDistributionRequest,
} from "../api/distributionsApi";

export function useDistributionRequests(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listDistributionRequests>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listDistributionRequests(token));
      setError(null);
    } catch {
      setError("Could not load distribution requests from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const propose = useCallback(
    async (noteContractId: string, params: { periodLabel: string; totalAmountNGN: number }) => {
      const request = await proposeDistribution(token, noteContractId, params);
      await refresh();
      return request;
    },
    [token, refresh],
  );

  const approve = useCallback(
    async (contractId: string) => {
      const distributions = await approveDistributionRequest(token, contractId);
      await refresh();
      return distributions;
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string, rejectionReason: string) => {
      await rejectDistributionRequest(token, contractId, rejectionReason);
      await refresh();
    },
    [token, refresh],
  );

  const withdraw = useCallback(
    async (contractId: string) => {
      await withdrawDistributionRequest(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, propose, approve, reject, withdraw };
}
