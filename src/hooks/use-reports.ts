// src/hooks/use-reports.ts
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/supabase/reports-service';

export function useOperationalSummary() {
  return useQuery({
    queryKey: ['operational-summary'],
    queryFn: () => reportsService.getOperationalSummary(),
  });
}

export function usePerformanceCharts() {
  return useQuery({
    queryKey: ['performance-charts'],
    queryFn: () => reportsService.getPerformanceCharts(),
  });
}

export function useTopGroups() {
  return useQuery({
    queryKey: ['top-groups'],
    queryFn: () => reportsService.getTopGroups(),
  });
}

export function useOperationalHistory() {
  return useQuery({
    queryKey: ['operational-history'],
    queryFn: () => reportsService.getOperationalHistory(),
  });
}
