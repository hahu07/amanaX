import { useCallback, useEffect, useState } from "react";
import { listProfitDistributions } from "../api/distributionsApi";

export function useProfitDistributions(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listProfitDistributions>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listProfitDistributions(token));
      setError(null);
    } catch {
      setError("Could not load profit distributions from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
