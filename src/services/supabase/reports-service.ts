// src/services/supabase/reports-service.ts
import { createClient } from '@/lib/supabase/client';
import { 
  OperationalSummary, 
  WeeklyData, 
  HourlyData, 
  TopGroupData, 
  OperationalHistoryItem 
} from '@/types/reports';
import { groupService } from './group-service';
import { 
  format, 
  subDays, 
  startOfDay, 
  endOfDay, 
  eachDayOfInterval, 
  parseISO,
  isSameDay 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const reportsService = {
  /**
   * Helper to apply date filters consistently
   */
  _applyDateFilter(query: any, options: { days?: number, startDate?: string, endDate?: string }) {
    if (options.startDate) {
      // If endDate is missing, use current time
      const end = options.endDate || new Date().toISOString();
      return query.gte('created_at', options.startDate).lte('created_at', end);
    }
    
    const days = options.days || 7;
    const date = new Date();
    if (days === 1) { // Today
      date.setHours(0, 0, 0, 0);
    } else {
      date.setDate(date.getDate() - days);
    }
    return query.gte('created_at', date.toISOString());
  },

  async getOperationalSummary(userId: string, options: { days?: number, startDate?: string, endDate?: string } = { days: 7 }): Promise<OperationalSummary> {
    const supabase = createClient();
    
    // 1. Core metric (Total groups) - CRITICAL
    const activeGroups = await groupService.list(userId);
    const total_active_groups = activeGroups.length;
    const global_estimated_reach = activeGroups.reduce((acc, g) => acc + (g.members_count || 0), 0);

    // Initial counts
    let total_sent = 0;
    let total_failed = 0;
    let total_pending = 0;
    let active_groups_count = 0;
    let active_campaigns_count = 0;
    let monitorings_count = 0;
    let active_automations_count = 0;
    let destination_lists_count = 0;

    try {
      // 2. Fetch Job stats from send_jobs (where status actually lives)
      let jobQuery = supabase
        .from('send_jobs')
        .select('status, destination, created_at')
        .eq('user_id', userId);
      
      jobQuery = this._applyDateFilter(jobQuery, options);
      const { data: jobs, error: jobError } = await jobQuery;
      
      if (!jobError && jobs) {
        total_sent = jobs.filter(j => j.status === 'completed' || j.status === 'sent').length;
        total_failed = jobs.filter(j => j.status === 'failed').length;
        total_pending = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;
        
        // Count unique destinations (groups) active in this period
        const activeIds = [...new Set(jobs.map(j => j.destination))];
        active_groups_count = activeIds.length;
      }

      // 3. New Hero Metrics
      const [jobsResult, automationsResult, listsResult] = await Promise.all([
        supabase.from('send_jobs').select('campaign_id').in('status', ['pending', 'processing']),
        supabase.from('automation_sources').select('source_type, is_active').eq('user_id', userId),
        supabase.from('destination_lists').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      ]);

      if (!jobsResult.error && jobsResult.data) {
        const uniqueCampaigns = [...new Set(jobsResult.data.map(j => j.campaign_id))];
        active_campaigns_count = uniqueCampaigns.length;
      }

      if (!listsResult.error) destination_lists_count = listsResult.count || 0;
      
      if (!automationsResult.error && automationsResult.data) {
        monitorings_count = automationsResult.data.filter(a => a.source_type === 'group_monitor').length;
        active_automations_count = automationsResult.data.filter(a => a.is_active).length;
      }

    } catch (err) {
      console.error('[REPORTS-SERVICE] Failed to fetch secondary metrics:', err);
    }

    return {
      total_sent,
      total_failed,
      total_pending,
      active_groups_count,
      total_groups: total_active_groups,
      estimated_reach: global_estimated_reach,
      active_campaigns_count,
      monitorings_count,
      active_automations_count,
      destination_lists_count
    };
  },

  async getPerformanceCharts(userId: string, options: { days?: number, startDate?: string, endDate?: string } = { days: 7 }): Promise<{ weekly: WeeklyData[], hourly: HourlyData[] }> {
    const supabase = createClient();

    // 1. Resolve Interval
    let start: Date;
    let end: Date = new Date();

    if (options.startDate && options.endDate) {
      start = startOfDay(parseISO(options.startDate));
      end = endOfDay(parseISO(options.endDate));
    } else {
      const days = options.days || 7;
      start = startOfDay(subDays(new Date(), days - 1));
      end = endOfDay(new Date());
    }

    // 2. Fetch Data
    const { data: jobs, error } = await supabase
      .from('send_jobs')
      .select('status, created_at')
      .eq('user_id', userId)
      .not('status', 'eq', 'pending')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (error) throw error;

    // 3. Generate Chronological Days
    const dateInterval = eachDayOfInterval({ start, end });
    const weekly = dateInterval.map(d => {
      const dayJobs = jobs?.filter(j => isSameDay(parseISO(j.created_at!), d)) || [];
      
      return {
        name: format(d, 'dd/MM', { locale: ptBR }),
        enviados: dayJobs.filter(j => j.status === 'completed' || j.status === 'sent').length,
        falhas: dayJobs.filter(j => j.status === 'failed').length,
        pendentes: dayJobs.filter(j => j.status === 'pending' || j.status === 'processing').length,
      };
    });

    // 4. Hourly (Current day focus or context)
    const hourlyMap: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyMap[i.toString().padStart(2, '0') + 'h'] = 0;
    }

    jobs?.forEach(d => {
      // Solo contamos para hoy si es gráfico de hoy, o total si es periodo largo
      if (d.status === 'completed' || d.status === 'sent') {
        const hour = new Date(d.created_at!).getHours().toString().padStart(2, '0') + 'h';
        if (hourlyMap[hour] !== undefined) hourlyMap[hour] += 1;
      }
    });

    const hourly = Object.entries(hourlyMap).map(([hour, enviados]) => ({ hour, enviados }));

    return { weekly, hourly };
  },

  async getTopGroups(userId: string, options: { days?: number, startDate?: string, endDate?: string } = { days: 7 }): Promise<TopGroupData[]> {
    const supabase = createClient();

    let jobQuery = supabase
      .from('send_jobs')
      .select('destination_name, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'sent');
    
    jobQuery = this._applyDateFilter(jobQuery, options);
    const { data: jobs, error } = await jobQuery;

    if (error) throw error;

    const groupStats: Record<string, { name: string, enviados: number, membros: number }> = {};

    jobs?.forEach(j => {
      const name = j.destination_name || 'Desconhecido';
      if (!groupStats[name]) {
        groupStats[name] = { name, enviados: 0, membros: 0 };
      }
      groupStats[name].enviados += 1;
    });

    return Object.values(groupStats)
      .sort((a, b) => b.enviados - a.enviados)
      .slice(0, 6);
  },

  async getOperationalHistory(userId: string, limit: number = 10, options: { days?: number, startDate?: string, endDate?: string } = { days: 7 }): Promise<OperationalHistoryItem[]> {
    const supabase = createClient();

    let query = supabase
      .from('campaigns')
      .select('*, send_jobs(status)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    query = this._applyDateFilter(query, options);

    const { data: campaigns, error } = await query;

    if (error) throw error;

    return campaigns?.map(c => {
      const dests = (c as any).send_jobs || [];
      const sentCount = dests.filter((d: any) => d.status === 'sent').length;
      const failedCount = dests.filter((d: any) => d.status === 'failed').length;
      
      let status: 'success' | 'failed' | 'processing' | 'info' = 'info';
      if (sentCount > 0 && failedCount === 0) status = 'success';
      if (failedCount > 0) status = 'failed';
      if (sentCount === 0 && failedCount === 0) status = 'processing';

      return {
        id: c.id,
        timestamp: c.created_at,
        date: new Date(c.created_at).toLocaleDateString('pt-BR'),
        event: c.name || `Campanha #${c.id.slice(0, 5)}`,
        type: 'campaign' as const,
        status,
        envios: sentCount,
        alcance: 0
      };
    }) || [];
  },

  async getAutomationHistory(userId: string, limit: number = 10, options: { days?: number, startDate?: string, endDate?: string } = { days: 7 }): Promise<OperationalHistoryItem[]> {
    const supabase = createClient();
    
    let query = supabase
      .from('automation_logs')
      .select('*, source:automation_sources(name, source_type)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    query = this._applyDateFilter(query, options);

    const { data: logs, error } = await query;
    if (error) throw error;

    return logs?.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      date: new Date(log.created_at).toLocaleDateString('pt-BR'),
      event: `${(log.source as any)?.name || 'Automação'}: ${this._formatEventType(log.event_type)}`,
      type: (log.source as any)?.source_type === 'radar_offers' ? 'radar' : 'automation',
      status: log.status === 'processed' || log.status === 'captured' ? 'success' : (log.status === 'error' ? 'failed' : 'info'),
      metadata: log.details
    })) || [];
  },

  async getUnifiedActivity(userId: string, limit: number = 20, options: { days?: number, startDate?: string, endDate?: string } = { days: 7 }): Promise<OperationalHistoryItem[]> {
    const [campaigns, automations] = await Promise.all([
      this.getOperationalHistory(userId, limit, options),
      this.getAutomationHistory(userId, limit, options)
    ]);

    return [...campaigns, ...automations]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  _formatEventType(type: string): string {
    const map: Record<string, string> = {
      'job_created': 'Envio agendado',
      'captured': 'Novas ofertas encontradas',
      'filtered': 'Oferta filtrada por regra',
      'error': 'Falha no processamento',
      'ingest': 'Novo link detectado',
      'processed': 'Processamento concluído'
    };
    return map[type] || type;
  }
};
