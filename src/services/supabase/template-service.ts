import { SupabaseClient } from '@supabase/supabase-js';

export interface MessageTemplate {
  id: string;
  user_id: string | null;
  name: string;
  template_key: string | null;
  template_type: string;
  category: 'product' | 'coupon' | 'campaign';
  content: string;
  is_active: boolean;
  is_system: boolean;
  is_system_default?: boolean; // Legacy compatibility
  is_default: boolean;
  is_editable: boolean;
  is_deletable: boolean;
  metadata: any;
  created_at: string;
}

export interface MessageTemplateUserSettings {
  id: string;
  user_id: string;
  template_type: string;
  system_template_enabled: boolean;
  active_user_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariables {
  titulo: string;
  titulo_maiusculo?: string;
  link: string;
  preco?: string;
  preco_original?: string;
  desconto?: string | number;
  loja?: string;
  // Variáveis para Cupons
  valor?: string | number;
  minimo?: string | number;
  frete_minimo?: string | number;
  codigo?: string;
}

export const templateService = {
  /**
   * Busca templates ativos para uma categoria e usuário (Legado)
   */
  async getActiveTemplates(
    supabase: SupabaseClient,
    category: 'product' | 'coupon' | 'campaign',
    userId?: string
  ): Promise<MessageTemplate[]> {
    let query = supabase
      .from('message_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true);

    if (userId) {
      query = query.or(`user_id.eq.${userId},is_system.eq.true,is_system_default.eq.true`);
    } else {
      query = query.or('is_system.eq.true,is_system_default.eq.true');
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Busca configurações de template de um usuário
   */
  async getUserSettings(
    supabase: SupabaseClient,
    userId: string,
    templateType: string
  ): Promise<MessageTemplateUserSettings> {
    const { data, error } = await supabase
      .from('message_template_user_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('template_type', templateType)
      .maybeSingle();

    if (error) throw error;
    
    if (data) return data;

    // Se não existir, cria o padrão
    const { data: newData, error: insertError } = await supabase
      .from('message_template_user_settings')
      .insert([{
        user_id: userId,
        template_type: templateType,
        system_template_enabled: true,
        active_user_template_id: null
      }])
      .select()
      .single();

    if (insertError) throw insertError;
    return newData;
  },

  /**
   * Lista todos os templates e o estado de ativação para o usuário
   */
  async listManagedTemplates(supabase: SupabaseClient, userId: string) {
    // 1. Buscar todos os templates (sistema + usuário)
    const { data: templates, error: tError } = await supabase
      .from('message_templates')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: false });

    if (tError) throw tError;

    // 2. Buscar todas as configurações do usuário
    const { data: settings, error: sError } = await supabase
      .from('message_template_user_settings')
      .select('*')
      .eq('user_id', userId);

    if (sError) throw sError;

    return {
      templates: (templates || []) as MessageTemplate[],
      settings: (settings || []) as MessageTemplateUserSettings[]
    };
  },

  /**
   * Alterna a ativação do template de sistema para o usuário
   */
  async toggleSystemTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateType: string,
    enabled: boolean
  ) {
    if (!enabled) {
      // Regra: Só pode desativar se houver template customizado ATIVO
      const { data: userTemplates, error } = await supabase
        .from('message_templates')
        .select('id')
        .eq('user_id', userId)
        .eq('template_type', templateType)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;

      if (!userTemplates || userTemplates.length === 0) {
        throw new Error('default_template_requires_active_user_template');
      }
    }

    const { error: updateError } = await supabase
      .from('message_template_user_settings')
      .upsert({
        user_id: userId,
        template_type: templateType,
        system_template_enabled: enabled
      }, { onConflict: 'user_id,template_type' });

    if (updateError) throw updateError;
  },

  /**
   * Define o template customizado ativo para o usuário
   */
  async setActiveUserTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateType: string,
    templateId: string | null
  ) {
    const { error } = await supabase
      .from('message_template_user_settings')
      .upsert({
        user_id: userId,
        template_type: templateType,
        active_user_template_id: templateId
      }, { onConflict: 'user_id,template_type' });

    if (error) throw error;
  },

  /**
   * Resolve o template efetivo a ser usado
   */
  async resolveEffectiveTemplate(
    supabase: SupabaseClient,
    userId: string | undefined,
    templateType: string
  ): Promise<{ content: string; isSystem: boolean }> {
    if (!userId) {
      // Se não houver usuário (ex: worker global), usa o sistema
      const { data } = await supabase
        .from('message_templates')
        .select('content')
        .eq('template_type', templateType)
        .eq('is_system', true)
        .eq('is_default', true)
        .maybeSingle();
      
      return { content: data?.content || '', isSystem: true };
    }

    // 1. Buscar configurações do usuário
    const { data: settings } = await supabase
      .from('message_template_user_settings')
      .select('*, active_user_template_id(content, is_active)')
      .eq('user_id', userId)
      .eq('template_type', templateType)
      .maybeSingle();

    const typedSettings = settings as any;

    // A) Se houver template customizado selecionado e ele estiver ativo
    if (typedSettings?.active_user_template_id && typedSettings.active_user_template_id.is_active) {
      return { 
        content: typedSettings.active_user_template_id.content, 
        isSystem: false 
      };
    }

    // B) Se o sistema estiver habilitado
    if (!typedSettings || typedSettings.system_template_enabled) {
      const { data: systemTemplate } = await supabase
        .from('message_templates')
        .select('content')
        .eq('template_type', templateType)
        .eq('is_system', true)
        .eq('is_default', true)
        .maybeSingle();
      
      if (systemTemplate) {
        return { content: systemTemplate.content, isSystem: true };
      }
    }

    // C) Se nada resolveu (ex: usuário desativou sistema mas excluiu o dele), reativa sistema
    if (typedSettings && !typedSettings.system_template_enabled) {
      await this.toggleSystemTemplate(supabase, userId, templateType, true);
      
      const { data: systemTemplate } = await supabase
        .from('message_templates')
        .select('content')
        .eq('template_type', templateType)
        .eq('is_system', true)
        .eq('is_default', true)
        .maybeSingle();
      
      return { content: systemTemplate?.content || '', isSystem: true };
    }

    return { content: '', isSystem: true };
  },




  /**
   * Renderiza o conteúdo do template com as variáveis
   */
  render(content: string, variables: TemplateVariables): string {
    let rendered = content;
    
    const replacements: Record<string, string> = {
      'titulo': variables.titulo,
      'titulo_maiusculo': variables.titulo.toUpperCase(),
      'link': variables.link,
      'preco': variables.preco || '',
      'preco_original': variables.preco_original || '',
      'desconto': variables.desconto?.toString() || '',
      'loja': variables.loja || '',
      'valor': variables.valor?.toString() || '',
      'minimo': variables.minimo?.toString() || '',
      'frete_minimo': variables.frete_minimo?.toString() || '',
      'codigo': variables.codigo || ''
    };

    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value);
    });

    return rendered;
  },

  /**
   * Lista todos os templates de um usuário (incluindo inativos e sistema)
   */
  async list(supabase: SupabaseClient, userId: string): Promise<MessageTemplate[]> {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Cria ou atualiza um template
   */
  async upsert(supabase: SupabaseClient, template: any): Promise<MessageTemplate> {
    const { data, error } = await supabase
      .from('message_templates')
      .upsert(template)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Exclui um template
   */
  async delete(supabase: SupabaseClient, id: string, userId: string): Promise<void> {
    // 1. Verificar se é template de sistema
    const { data: template } = await supabase
      .from('message_templates')
      .select('is_system, template_type')
      .eq('id', id)
      .single();
    
    if (template?.is_system) {
      throw new Error('system_template_cannot_be_deleted');
    }

    // 2. Excluir
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    // 3. Verificar se era o template ativo do usuário
    if (template) {
      const { data: settings } = await supabase
        .from('message_template_user_settings')
        .select('active_user_template_id')
        .eq('user_id', userId)
        .eq('template_type', template.template_type)
        .maybeSingle();
      
      if (settings?.active_user_template_id === id) {
        // Se era o ativo, reativa o sistema
        await this.toggleSystemTemplate(supabase, userId, template.template_type, true);
        await this.setActiveUserTemplate(supabase, userId, template.template_type, null);
      }
    }
  }

};
