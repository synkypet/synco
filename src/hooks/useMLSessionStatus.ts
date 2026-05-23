import { useState, useEffect, useCallback, useRef } from 'react';

export type MLSessionStatus =
  | 'not_paired'
  | 'paired_no_session'
  | 'session_ready'
  | 'session_expired'
  | 'session_revoked';

interface MLSessionStatusResponse {
  status: MLSessionStatus | null;
  isLoading: boolean;
  lastSyncedAt: string | null;
  expiresAt: string | null;
  refetch: () => void;
}

export function useMLSessionStatus(options?: { pollingIntervalMs?: number; enabled?: boolean }): MLSessionStatusResponse {
  const { pollingIntervalMs = 0, enabled = true } = options || {};

  const [status, setStatus] = useState<MLSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  
  const statusRef = useRef(status);
  statusRef.current = status;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ml/session/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setLastSyncedAt(data.lastSyncedAt);
        setExpiresAt(data.expiresAt);
      }
    } catch {
      // Handle silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!enabled) return;

    fetchStatus();

    if (pollingIntervalMs > 0) {
      const interval = setInterval(() => {
        if (statusRef.current !== 'session_ready') {
          fetchStatus();
        }
      }, pollingIntervalMs);
      return () => clearInterval(interval);
    }
  }, [enabled, pollingIntervalMs, fetchStatus]);

  return { status, isLoading, lastSyncedAt, expiresAt, refetch };
}
