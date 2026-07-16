import { useCallback, useEffect, useState } from "react";
import { issueInvestmentNote, listInvestmentNotes } from "../api/investmentNotesApi";

export function useInvestmentNotes(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listInvestmentNotes>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listInvestmentNotes(token));
      setError(null);
    } catch {
      setError("Could not load investment notes from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const issue = useCallback(
    async (secApprovalContractId: string, params: { symbol: string; parValueNGN: number }) => {
      const note = await issueInvestmentNote(token, secApprovalContractId, params);
      await refresh();
      return note;
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, issue };
}
