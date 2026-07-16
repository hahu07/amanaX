import { useCallback, useEffect, useState } from "react";
import {
  allocateSubscription,
  listSubscriptions,
  rejectSubscription,
  riskCheckSubscription,
  subscribeToNote,
  withdrawSubscription,
} from "../api/subscriptionsApi";

export function useSubscriptions(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listSubscriptions>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listSubscriptions(token));
      setError(null);
    } catch {
      setError("Could not load subscriptions from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(
    async (noteContractId: string, amountNGN: number) => {
      const subscription = await subscribeToNote(token, noteContractId, amountNGN);
      await refresh();
      return subscription;
    },
    [token, refresh],
  );

  const riskCheck = useCallback((contractId: string) => riskCheckSubscription(token, contractId), [token]);

  const allocate = useCallback(
    async (contractId: string, params: { allocatedAmountNGN: number; riskNotes: string }) => {
      const subscription = await allocateSubscription(token, contractId, params);
      await refresh();
      return subscription;
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string, rejectionReason: string) => {
      await rejectSubscription(token, contractId, rejectionReason);
      await refresh();
    },
    [token, refresh],
  );

  const withdraw = useCallback(
    async (contractId: string) => {
      await withdrawSubscription(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, subscribe, riskCheck, allocate, reject, withdraw };
}
