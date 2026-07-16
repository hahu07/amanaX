import { useCallback, useEffect, useState } from "react";
import {
  approveRegulatorySubmission,
  generateFilingPack,
  listRegulatorySubmissions,
  rejectRegulatorySubmission,
  submitToSEC,
  withdrawRegulatorySubmission,
} from "../api/regulatoryApi";

export function useRegulatorySubmissions(token: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof listRegulatorySubmissions>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listRegulatorySubmissions(token));
      setError(null);
    } catch {
      setError("Could not load regulatory submissions from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generatePack = useCallback((trusteeReviewContractId: string) => generateFilingPack(token, trusteeReviewContractId), [token]);

  const submit = useCallback(
    async (trusteeReviewContractId: string, sec: string) => {
      const submission = await submitToSEC(token, trusteeReviewContractId, sec);
      await refresh();
      return submission;
    },
    [token, refresh],
  );

  const approve = useCallback(
    async (contractId: string, approvalReference: string) => {
      const submission = await approveRegulatorySubmission(token, contractId, approvalReference);
      await refresh();
      return submission;
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string, rejectionReason: string) => {
      await rejectRegulatorySubmission(token, contractId, rejectionReason);
      await refresh();
    },
    [token, refresh],
  );

  const withdraw = useCallback(
    async (contractId: string) => {
      await withdrawRegulatorySubmission(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, generatePack, submit, approve, reject, withdraw };
}
