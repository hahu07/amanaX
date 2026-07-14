import { useCallback, useEffect, useState } from "react";
import {
  createProposal,
  listProposals,
  rejectProposal,
  requestStructuringRecommendation,
  structureProposal,
  withdrawProposal,
  type ProductProposal,
  type ProductType,
} from "../api/productsApi";

/** Same pattern as useOrganizations — fetch/list state lives here, not in the dashboard components. */
export function useProposals(token: string) {
  const [data, setData] = useState<ProductProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listProposals(token));
      setError(null);
    } catch {
      setError("Could not load proposals from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: {
      issuingHouse: string;
      productName: string;
      description: string;
      proposedType: ProductType;
      targetSizeNGN: number;
      tenorMonths: number;
    }) => {
      const proposal = await createProposal(token, params);
      await refresh();
      return proposal;
    },
    [token, refresh],
  );

  const withdraw = useCallback(
    async (contractId: string) => {
      await withdrawProposal(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  const reject = useCallback(
    async (contractId: string) => {
      await rejectProposal(token, contractId);
      await refresh();
    },
    [token, refresh],
  );

  const getRecommendation = useCallback((contractId: string) => requestStructuringRecommendation(token, contractId), [token]);

  const structure = useCallback(
    async (
      contractId: string,
      params: {
        structureType: ProductType;
        profitMechanism: string;
        minSubscriptionNGN: number;
        redemptionTerms: string;
        structureTenorMonths: number;
      },
    ) => {
      const result = await structureProposal(token, contractId, params);
      await refresh();
      return result;
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, create, withdraw, reject, getRecommendation, structure };
}
