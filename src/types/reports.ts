// src/types/reports.ts

export interface OperationalSummary {
  total_sent: number;
  total_failed: number;
  total_pending: number;
  active_groups_count: number;
  total_groups: number;
  active_campaigns_count: number;
  monitorings_count: number;
  active_automations_count: number;
  destination_lists_count: number;
}

export interface WeeklyData {
  name: string; // Seg, Ter...
  enviados: number;
  pendentes: number;
  falhas: number;
}

export interface HourlyData {
  hour: string;
  enviados: number;
}

export interface TopGroupData {
  name: string;
  enviados: number;
  membros: number;
}

export interface OperationalHistoryItem {
  id: string;
  timestamp: string;
  date: string;
  event: string;
  type: 'campaign' | 'automation' | 'monitoring' | 'radar';
  status?: 'success' | 'failed' | 'processing' | 'info';
  envios?: number;
  groupCount?: number;
  imageUrl?: string;
  metadata?: any;
}
