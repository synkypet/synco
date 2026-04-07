// src/types/reports.ts

export interface OperationalSummary {
  total_sent: number;
  total_failed: number;
  total_pending: number;
  active_groups_count: number;
  estimated_reach: number;
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
  date: string;
  event: string;
  type: 'campaign' | 'automation' | 'monitoring';
  envios: number;
  alcance: number;
}
