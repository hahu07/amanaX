import { useCallback, useEffect, useState } from "react";
import { listComplianceReports } from "../api/reportsApi";

export function useComplianceReports(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listComplianceReports>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listComplianceReports(token));
      setError(null);
    } catch {
      setError("Could not load compliance reports from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
