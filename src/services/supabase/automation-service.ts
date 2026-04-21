import { createClient } from '@/lib/supabase/client';
import { AutomationSource, AutomationRoute } from '@/types/automation';
import { SupabaseClient } from '@supabase/supabase-js';

const generateHash = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const automationService = {
  /**
   * Lista todas as fontes de automação do usuário com suas rotas iniciais
   */
  async listSources(userId: string, client?: SupabaseClient): Promise<AutomationSource[]> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_sources')
      .select(`
        *,
        automation_routes (
          id,
          target_type,
          target_id,
          template_config
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing automation sources:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Cria uma nova fonte de monitoramento
   */
  async createSource(source: Partial<AutomationSource> & { user_id: string; source_type: 'group_monitor' | 'radar_offers' }, client?: SupabaseClient): Promise<AutomationSource> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_sources')
      .insert(source)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cria um pipeline completo de automação (Fonte + Rota inicial)
   */
  async createPipeline(
    userId: string, 
    setup: {
      name: string;
      source_type: 'group_monitor' | 'radar_offers';
      channel_id?: string;
      external_group_id?: string;
      target_type: 'group' | 'list';
      target_id: string;
    },
    client?: any
  ): Promise<AutomationSource> {
    const supabase = client || createClient();
    
    // 1. Criar a Fonte
    const { data: source, error: sourceError } = await supabase
      .from('automation_sources')
      .insert({
        user_id: userId,
        name: setup.name,
        source_type: setup.source_type,
        channel_id: setup.channel_id,
        external_group_id: setup.external_group_id,
        is_active: true
      })
      .select()
      .single();

    if (sourceError) throw sourceError;

    // 2. Criar a Rota Inicial (Destino)
    const { error: routeError } = await supabase
      .from('automation_routes')
      .insert({
        source_id: source.id,
        target_type: setup.target_type,
        target_id: setup.target_id,
        is_active: true,
        filters: {},
        template_config: {}
      });

    if (routeError) throw routeError;

    return source;
  },

  /**
   * Busca fontes de automação ativas por canal e ID externo do grupo
   */
  async getSourceByExternalId(userId: string, channelId: string, externalGroupId: string, client?: SupabaseClient): Promise<AutomationSource | null> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('channel_id', channelId)
      .eq('external_group_id', externalGroupId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching automation source:', error);
      return null;
    }
    return data;
  },

  /**
   * Busca todas as rotas de destino de uma fonte específica
   */
  async getRoutesBySourceId(sourceId: string, client?: SupabaseClient): Promise<AutomationRoute[]> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_routes')
      .select('*')
      .eq('source_id', sourceId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching automation routes:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Lógica de Deduplicação Camada 1: Ingestão
   */
  async checkAndMarkDedupe(userId: string, normalizedUrl: string, sourceGroupId: string, client?: SupabaseClient): Promise<boolean> {
    const supabase = client || createClient();
    
    try {
      const hashKey = generateHash(`ingest:${userId}:${normalizedUrl}:${sourceGroupId}`);

      const { error } = await supabase
        .from('automation_dedupe')
        .insert({ hash_key: hashKey });

      if (error) {
        if (error.code === '23505') return true; 
        console.error('[AUTO-SERVICE] [DEDUPE] Error inserting ingest hash:', error);
        return false;
      }

      return false;
    } catch (err) {
      console.error('[AUTO-SERVICE] [DEDUPE-CRITICAL] ingest_check failed:', err);
      return false; // Fallback para não bloquear o pipeline
    }
  },

  /**
   * Lógica de Deduplicação Nível de Mensagem: Evita processar a mesma mensagem duas vezes (ex: eventos duplicados do provedor)
   */
  async checkAndMarkMessageDedupe(channelId: string, messageId: string, client?: SupabaseClient): Promise<boolean> {
    if (!messageId || !channelId) return false;
    const supabase = client || createClient();
    
    try {
      // Chave única composta pelo canal e ID da mensagem
      const hashKey = generateHash(`msg:${channelId}:${messageId}`);

      const { error } = await supabase
        .from('automation_dedupe')
        .insert({ hash_key: hashKey });

      if (error) {
        if (error.code === '23505') return true; 
        console.error('[AUTO-SERVICE] [DEDUPE] Error inserting message hash:', error);
        return false;
      }

      return false;
    } catch (err) {
      console.error('[AUTO-SERVICE] [DEDUPE-CRITICAL] message_check failed:', err);
      return false; // Fallback: processar de novo é melhor que sumir com a mensagem
    }
  },

  /**
   * Busca uma fonte específica por ID
   */
  async getById(id: string, client?: SupabaseClient): Promise<AutomationSource | null> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching automation source by id:', error);
      return null;
    }
    return data;
  },

  /**
   * Atualiza uma fonte (nome, status)
   */
  async updateSource(id: string, updates: Partial<AutomationSource>, client?: SupabaseClient): Promise<void> {
    const supabase = client || createClient();
    const { error } = await supabase
      .from('automation_sources')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Remove uma fonte e suas rotas
   */
  async deleteSource(id: string, client?: SupabaseClient): Promise<void> {
    const supabase = client || createClient();
    const { error } = await supabase
      .from('automation_sources')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Cria ou atualiza uma rota de destino
   */
  async upsertRoute(route: Partial<AutomationRoute> & { source_id: string; target_id: string }, client?: SupabaseClient): Promise<AutomationRoute> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_routes')
      .upsert(route)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove uma rota de destino
   */
  async deleteRoute(id: string, client?: SupabaseClient): Promise<void> {
    const supabase = client || createClient();
    const { error } = await supabase
      .from('automation_routes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Busca logs de execução de uma automação
   */
  async getLogs(sourceId: string, limit: number = 50, client?: SupabaseClient): Promise<any[]> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Busca logs de execução de TODAS as automações do usuário
   */
  async listAllLogs(userId: string, limit: number = 50, client?: SupabaseClient): Promise<any[]> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('automation_logs')
      .select(`
        *,
        source:automation_sources(name, source_type)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error listing all logs:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Obtém resumo de métricas factuais das automações
   */
  async getAutomationSummary(userId: string, client?: SupabaseClient): Promise<{ captured: number; processed: number; error: number }> {
    const supabase = client || createClient();
    
    // Contagem simples por status
    const { data: counts, error } = await supabase
      .from('automation_logs')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching automation summary:', error);
      return { captured: 0, processed: 0, error: 0 };
    }

    return {
      captured: counts.filter(c => c.status === 'captured').length,
      processed: counts.filter(c => c.status === 'processed').length,
      error: counts.filter(c => c.status === 'error').length
    };
  },

  /**
   * Busca as últimas campanhas geradas por uma automação,
   * baseando-se nos logs de 'job_created'.
   */
  async getRecentCampaigns(sourceId: string, limit: number = 10, client?: SupabaseClient) {
    const supabase = client || createClient();
    
    // 1. Buscar os IDs das campanhas nos logs
    const { data: logs, error: logsError } = await supabase
      .from('automation_logs')
      .select('details')
      .eq('source_id', sourceId)
      .eq('event_type', 'job_created')
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('Error fetching campaign ids from logs:', logsError);
      return [];
    }

    // 2. Extrair IDs únicos
    const campaignIds = Array.from(new Set(
      logs
        .map(log => log.details?.campaignId)
        .filter(Boolean)
    )).slice(0, limit);

    if (campaignIds.length === 0) return [];

    // 3. Buscar as campanhas (reutilizando campaignService se possível, 
    // mas aqui fazemos direto para evitar import circular se necessário, 
    // embora no client side não haja problema)
    // Vamos importar o campaignService dinamicamente ou apenas fazer a query aqui.
    // Como estamos no mesmo arquivo de serviços, vamos fazer a query direta para ser mais performático e isolado.
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `)
      .in('id', campaignIds)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('Error fetching campaigns for automation:', campaignsError);
      return [];
    }

    return campaigns || [];
  },

  /**
   * Registra um evento de automação para observabilidade
   */
  async logEvent(log: {
    source_id: string;
    user_id: string;
    status: 'captured' | 'filtered' | 'processed' | 'error';
    event_type: string;
    details: any;
  }, client?: SupabaseClient): Promise<void> {
    const supabase = client || createClient();
    await supabase.from('automation_logs').insert(log);
  },

  /**
   * Lógica de Deduplicação Camada 2: Destino
   */
  async checkAndMarkDestinationDedupe(userId: string, normalizedUrl: string, targetId: string, client?: SupabaseClient): Promise<boolean> {
    const supabase = client || createClient();
    
    try {
      const hashKey = generateHash(`dest:${userId}:${normalizedUrl}:${targetId}`);

      const { error } = await supabase
        .from('automation_dedupe')
        .insert({ hash_key: hashKey });

      if (error) {
        if (error.code === '23505') return true; 
        console.error('[AUTO-SERVICE] [DEDUPE] Error inserting destination hash:', error);
        return false;
      }

      return false;
    } catch (err) {
      console.error('[AUTO-SERVICE] [DEDUPE-CRITICAL] destination_check failed:', err);
      return false;
    }
  }
};
