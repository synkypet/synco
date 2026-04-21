import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { reportsService } from '@/services/supabase/reports-service';

const PERIOD_MAP: Record<string, number> = {
  today: 1,
  week: 7,
  '15d': 15,
  '30d': 30,
  month: 30,
};

interface ReportHookOptions {
  period?: string;
  startDate?: string;
  endDate?: string;
}

export function useOperationalSummary(userId: string | undefined, options: ReportHookOptions = { period: 'week' }) {
  const { period = 'week', startDate, endDate } = options;
  const days = PERIOD_MAP[period];
  
  return useQuery({
    queryKey: ['operational-summary', userId, period, startDate, endDate],
    queryFn: () => userId ? reportsService.getOperationalSummary(userId, { days, startDate, endDate }) : Promise.reject('User ID required'),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function usePerformanceCharts(userId: string | undefined, options: ReportHookOptions = { period: 'week' }) {
  const { period = 'week', startDate, endDate } = options;
  const days = PERIOD_MAP[period];

  return useQuery({
    queryKey: ['performance-charts', userId, period, startDate, endDate],
    queryFn: () => userId ? reportsService.getPerformanceCharts(userId, { days, startDate, endDate }) : Promise.reject('User ID required'),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useTopGroups(userId: string | undefined, options: ReportHookOptions = { period: 'week' }) {
  const { period = 'week', startDate, endDate } = options;
  const days = PERIOD_MAP[period];

  return useQuery({
    queryKey: ['top-groups', userId, period, startDate, endDate],
    queryFn: () => userId ? reportsService.getTopGroups(userId, { days, startDate, endDate }) : Promise.reject('User ID required'),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useOperationalHistory(userId: string | undefined, options: ReportHookOptions = { period: 'week' }, limit: number = 10) {
  const { period = 'week', startDate, endDate } = options;
  const days = PERIOD_MAP[period];

  return useQuery({
    queryKey: ['operational-history', userId, period, limit, startDate, endDate],
    queryFn: () => userId ? reportsService.getOperationalHistory(userId, limit, { days, startDate, endDate }) : Promise.reject('User ID required'),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useUnifiedActivity(userId: string | undefined, options: ReportHookOptions = { period: 'week' }, limit: number = 10) {
  const { period = 'week', startDate, endDate } = options;
  const days = PERIOD_MAP[period];

  return useQuery({
    queryKey: ['unified-activity', userId, period, limit, startDate, endDate],
    queryFn: () => userId ? reportsService.getUnifiedActivity(userId, limit, { days, startDate, endDate }) : Promise.reject('User ID required'),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}
