import { useCallback, useEffect, useState } from "react";
import { finalizeStructure, listStructures, updateStructureTerms, type ProductStructure, type ProductType } from "../api/productsApi";

export function useStructures(token: string) {
  const [data, setData] = useState<ProductStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listStructures(token));
      setError(null);
    } catch {
      setError("Could not load structures from the backend.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateTerms = useCallback(
    async (
      contractId: string,
      params: {
        newStructureType: ProductType;
        newProfitMechanism: string;
        newMinSubscriptionNGN: number;
        newRedemptionTerms: string;
        newTenorMonths: number;
      },
    ) => {
      const result = await updateStructureTerms(token, contractId, params);
      await refresh();
      return result;
    },
    [token, refresh],
  );

  const finalize = useCallback(
    async (contractId: string) => {
      const result = await finalizeStructure(token, contractId);
      await refresh();
      return result;
    },
    [token, refresh],
  );

  return { data, loading, error, refresh, updateTerms, finalize };
}
