import { useCallback, useEffect, useState } from "react";
import {
  approveTrusteeReview,
  listTrusteeReviews,
  rejectTrusteeReview,
  runComplianceCheck,
  withdrawTrusteeReview,
  type TrusteeReviewItem,
} from "../api/reviewsApi";

export function useTrusteeReviews(token: string) {
  const [data, setData] = useState<TrusteeReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listTrusteeReviews(token));
      setError(null);
    } catch {
      setError("Could not load Trustee reviews from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approve = useCallback(
    async (contractId: string, approvalNotes: string) => {
      const review = await approveTrusteeReview(token, contractId, approvalNotes);
      await refresh();
      return review;
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string, rejectionReason: string) => {
      await rejectTrusteeReview(token, contractId, rejectionReason);
      await refresh();
    },
    [token, refresh],
  );

  const withdraw = useCallback(
    async (contractId: string) => {
      await withdrawTrusteeReview(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  const checkCompliance = useCallback(async (contractId: string) => runComplianceCheck(token, contractId), [token]);

  return { data, loading, error, refresh, approve, reject, withdraw, checkCompliance };
}
