import { useCallback, useEffect, useState } from "react";
import {
  certifyShariahReview,
  listShariahReviews,
  rejectShariahReview,
  submitForShariahReview,
  submitForTrusteeReview,
  withdrawShariahReview,
  type ShariahReviewItem,
} from "../api/reviewsApi";

export function useShariahReviews(token: string) {
  const [data, setData] = useState<ShariahReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listShariahReviews(token));
      setError(null);
    } catch {
      setError("Could not load Shariah reviews from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = useCallback(
    async (structureContractId: string, shariahAdvisor: string) => {
      const review = await submitForShariahReview(token, structureContractId, shariahAdvisor);
      await refresh();
      return review;
    },
    [token, refresh],
  );

  const certify = useCallback(
    async (contractId: string, certificationNotes: string) => {
      const review = await certifyShariahReview(token, contractId, certificationNotes);
      await refresh();
      return review;
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string, rejectionReason: string) => {
      await rejectShariahReview(token, contractId, rejectionReason);
      await refresh();
    },
    [token, refresh],
  );

  const withdraw = useCallback(
    async (contractId: string) => {
      await withdrawShariahReview(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  const submitTrusteeReview = useCallback(
    async (shariahReviewContractId: string, trustee: string) => submitForTrusteeReview(token, shariahReviewContractId, trustee),
    [token],
  );

  return { data, loading, error, refresh, submit, certify, reject, withdraw, submitTrusteeReview };
}
