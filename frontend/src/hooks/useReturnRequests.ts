import { useState, useEffect, useCallback } from 'react';
import { returnRequestService } from '../services/returnRequestService';
import { ReturnRequest, ReturnRequestListResult, ReturnRequestListFilters } from '../types/returnRequest';

export function useReturnRequests(filters: ReturnRequestListFilters = {}) {
  const [result, setResult] = useState<ReturnRequestListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await returnRequestService.getAll(JSON.parse(filtersKey) as ReturnRequestListFilters);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load return requests');
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { result, loading, error, refetch: fetch };
}

export function useReturnRequest(id: number | null) {
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await returnRequestService.getById(id);
      setReturnRequest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load return request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { returnRequest, loading, error, refetch: fetch };
}
