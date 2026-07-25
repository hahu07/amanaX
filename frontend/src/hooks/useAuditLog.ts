import { useCallback, useEffect, useState } from "react";
import { listAuditLog } from "../api/reportsApi";

export function useAuditLog(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listAuditLog>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listAuditLog(token));
      setError(null);
    } catch {
      setError("Could not load the audit log from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
