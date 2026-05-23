import { useState, useEffect, useCallback, useRef } from 'react';

export type MLSessionStatus =
  | 'not_paired'
  | 'paired_no_session'
  | 'session_ready'
  | 'session_expired'
  | 'session_revoked';

interface MLSessionStatusResponse {
  status: MLSessionStatus;
  hasExtensionToken: boolean;
  hasValidSession: boolean;
  lastSyncedAt: string | null;
  expiresAt: string | null;
}

interface UseMLSessionStatusOptions {
  pollingIntervalMs?: number;
  enabled?: boolean;
}

export function useMLSessionStatus(options?: UseMLSessionStatusOptions) {
  const { pollingIntervalMs = 0, enabled = true } = options || {};

  const [status, setStatus] = useState<MLSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/ml/session/status');
      if (response.ok) {
        const data: MLSessionStatusResponse = await response.json();
        setStatus(data.status);
        setLastSyncedAt(data.lastSyncedAt);
        setExpiresAt(data.expiresAt);
        return data.status;
      }
    } catch (error) {
      console.error('[useMLSessionStatus] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!enabled) return;

    fetchStatus();

    if (pollingIntervalMs > 0 && status !== 'session_ready') {
      const intervalId = setInterval(async () => {
        const newStatus = await fetchStatus();
        if (newStatus === 'session_ready') {
          clearInterval(intervalId);
        }
      }, pollingIntervalMs);

      return () => clearInterval(intervalId);
    }
  }, [enabled, pollingIntervalMs, status, fetchStatus]);

  return {
    status,
    isLoading,
    lastSyncedAt,
    expiresAt,
    refetch
  };
}
