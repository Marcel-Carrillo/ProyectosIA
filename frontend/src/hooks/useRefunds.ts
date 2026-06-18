import { useState, useEffect, useCallback } from 'react';
import { refundService } from '../services/refundService';
import { Refund, RefundListResult, RefundListFilters } from '../types/refund';

export function useRefunds(filters: RefundListFilters = {}) {
  const [result, setResult] = useState<RefundListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await refundService.getAll(JSON.parse(filtersKey) as RefundListFilters);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { result, loading, error, refetch: fetch };
}

export function useRefund(id: number | null) {
  const [refund, setRefund] = useState<Refund | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await refundService.getById(id);
      setRefund(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refund');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { refund, loading, error, refetch: fetch };
}
