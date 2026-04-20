// src/hooks/use-reports.ts
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/supabase/reports-service';

const PERIOD_MAP: Record<string, number> = {
  today: 1,
  week: 7,
  month: 30,
};

export function useOperationalSummary(period: string = 'week') {
  const days = PERIOD_MAP[period] || 7;
  return useQuery({
    queryKey: ['operational-summary', period],
    queryFn: () => reportsService.getOperationalSummary(days),
  });
}

export function usePerformanceCharts(period: string = 'week') {
  const days = PERIOD_MAP[period] || 7;
  return useQuery({
    queryKey: ['performance-charts', period],
    queryFn: () => reportsService.getPerformanceCharts(days),
  });
}

export function useTopGroups(period: string = 'week') {
  const days = PERIOD_MAP[period] || 7;
  return useQuery({
    queryKey: ['top-groups', period],
    queryFn: () => reportsService.getTopGroups(days),
  });
}

export function useOperationalHistory(period: string = 'week', limit: number = 10) {
  const days = PERIOD_MAP[period] || 7;
  return useQuery({
    queryKey: ['operational-history', period, limit],
    queryFn: () => reportsService.getOperationalHistory(limit, days),
  });
}
