// src/services/supabase/reports-service.ts
import { createClient } from '@/lib/supabase/client';
import { 
  OperationalSummary, 
  WeeklyData, 
  HourlyData, 
  TopGroupData, 
  OperationalHistoryItem 
} from '@/types/reports';



export const reportsService = {
  /**
   * Helper to get common date filter logic
   */
  _getThresholdDate(days: number): string {
    const date = new Date();
    if (days === 1) { // Special case for "Today" - start of the day
      date.setHours(0, 0, 0, 0);
    } else {
      date.setDate(date.getDate() - days);
    }
    return date.toISOString();
  },

  async getOperationalSummary(days: number = 7): Promise<OperationalSummary> {
    const supabase = createClient();
    const thresholdDate = this._getThresholdDate(days);
    
    // Total groups count (global, showing as context)
    const { count: total_groups, error: tgCountError } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true });

    if (tgCountError) throw tgCountError;

    const { data: destinations, error } = await supabase
      .from('campaign_destinations')
      .select('status, destination_list_id, created_at')
      .gte('created_at', thresholdDate);

    if (error) throw error;

    const total_sent = destinations?.filter(d => d.status === 'sent').length || 0;
    const total_failed = destinations?.filter(d => d.status === 'failed').length || 0;
    const total_pending = destinations?.filter(d => d.status === 'pending').length || 0;

    // Get unique destination lists used
    const listIds = [...new Set(destinations?.map(d => d.destination_list_id))];
    
    // Fetch groups related to these lists to calculate reach
    const { data: listGroups, error: lgError } = await supabase
      .from('destination_list_groups')
      .select('group_id')
      .in('destination_list_id', listIds);

    if (lgError) throw lgError;

    const groupIds = [...new Set(listGroups?.map(lg => lg.group_id))];
    
    const { data: groups, error: gError } = await supabase
      .from('groups')
      .select('members_count')
      .in('id', groupIds);

    if (gError) throw gError;

    const active_groups_count = groupIds.length;
    const estimated_reach = groups?.reduce((acc, g) => acc + (g.members_count || 0), 0) || 0;

    return {
      total_sent,
      total_failed,
      total_pending,
      active_groups_count,
      total_groups: total_groups || 0,
      estimated_reach
    };
  },

  async getPerformanceCharts(days: number = 7): Promise<{ weekly: WeeklyData[], hourly: HourlyData[] }> {
    const supabase = createClient();
    const thresholdDate = this._getThresholdDate(days);

    const { data: destinations, error } = await supabase
      .from('campaign_destinations')
      .select('status, sent_at, created_at')
      .gte('created_at', thresholdDate)
      .not('sent_at', 'is', null);

    if (error) throw error;

    // Weekly
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weeklyMap: Record<string, { enviados: number, pendentes: number, falhas: number }> = {};
    dayNames.forEach(d => weeklyMap[d] = { enviados: 0, pendentes: 0, falhas: 0 });

    destinations?.forEach(d => {
      const day = dayNames[new Date(d.sent_at!).getDay()];
      if (d.status === 'sent') weeklyMap[day].enviados += 1;
      if (d.status === 'failed') weeklyMap[day].falhas += 1;
      if (d.status === 'pending') weeklyMap[day].pendentes += 1;
    });

    const weekly = dayNames.map(day => ({ name: day, ...weeklyMap[day] }));

    // Hourly
    const hourlyMap: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      const h = i.toString().padStart(2, '0') + 'h';
      hourlyMap[h] = 0;
    }

    destinations?.forEach(d => {
      if (d.status === 'sent') {
        const hour = new Date(d.sent_at!).getHours().toString().padStart(2, '0') + 'h';
        hourlyMap[hour] += 1;
      }
    });

    const hourly = Object.entries(hourlyMap).map(([hour, enviados]) => ({ hour, enviados }));

    return { weekly, hourly };
  },

  async getTopGroups(days: number = 7): Promise<TopGroupData[]> {
    const supabase = createClient();
    const thresholdDate = this._getThresholdDate(days);

    const { data: destinations, error } = await supabase
      .from('campaign_destinations')
      .select('destination_list_id, status, created_at')
      .gte('created_at', thresholdDate)
      .eq('status', 'sent');

    if (error) throw error;

    const listIds = destinations?.map(d => d.destination_list_id) || [];
    
    const { data: listGroups, error: lgError } = await supabase
      .from('destination_list_groups')
      .select('destination_list_id, group_id, groups(name, members_count)');

    if (lgError) throw lgError;

    const groupStats: Record<string, { name: string, enviados: number, membros: number }> = {};

    destinations?.forEach(d => {
      const relatedGroups = listGroups?.filter(lg => lg.destination_list_id === d.destination_list_id);
      relatedGroups?.forEach(lg => {
        const g = lg.groups as any;
        if (!groupStats[lg.group_id]) {
          groupStats[lg.group_id] = { name: g.name, enviados: 0, membros: g.members_count };
        }
        groupStats[lg.group_id].enviados += 1;
      });
    });

    return Object.values(groupStats)
      .sort((a, b) => b.enviados - a.enviados)
      .slice(0, 6);
  },

  async getOperationalHistory(limit: number = 10, days: number = 7): Promise<OperationalHistoryItem[]> {
    const supabase = createClient();
    const thresholdDate = this._getThresholdDate(days);

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*, campaign_destinations(status)')
      .gte('created_at', thresholdDate)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return campaigns?.map(c => {
      const dests = c.campaign_destinations || [];
      const sentCount = dests.filter((d: any) => d.status === 'sent').length;
      
      return {
        date: new Date(c.created_at).toLocaleDateString('pt-BR'),
        event: c.name || `Campanha #${c.id.slice(0, 5)}`,
        type: 'campaign' as const,
        envios: sentCount,
        alcance: 0 // Reach calculation per campaign would require group joins, skipping for now as per "estimated" rule
      };
    }) || [];
  }
};
