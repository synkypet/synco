import { SupabaseClient } from '@supabase/supabase-js';

export interface MessageTemplate {
  id: string;
  user_id: string | null;
  name: string;
  category: 'product' | 'coupon' | 'campaign';
  content: string;
  is_active: boolean;
  is_system_default: boolean;
  created_at: string;
}

export interface TemplateVariables {
  titulo: string;
  link: string;
  preco?: string;
  preco_original?: string;
  desconto?: string | number;
  comissao?: string | number;
  loja?: string;
}

export const templateService = {
  /**
   * Busca templates ativos para uma categoria e usuário
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
      query = query.or(`user_id.eq.${userId},is_system_default.eq.true`);
    } else {
      query = query.eq('is_system_default', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Resolve um template aleatório para a categoria
   */
  async resolveTemplate(
    supabase: SupabaseClient,
    category: 'product' | 'coupon' | 'campaign',
    variables: TemplateVariables,
    userId?: string
  ): Promise<string | null> {
    try {
      const templates = await this.getActiveTemplates(supabase, category, userId);
      if (templates.length === 0) return null;

      // Escolher um aleatoriamente
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
      
      return this.render(randomTemplate.content, variables);
    } catch (err) {
      console.error('[TEMPLATE-SERVICE] Error resolving template:', err);
      return null;
    }
  },

  /**
   * Renderiza o conteúdo do template com as variáveis
   */
  render(content: string, variables: TemplateVariables): string {
    let rendered = content;
    
    const replacements: Record<string, string> = {
      'titulo': variables.titulo,
      'link': variables.link,
      'preco': variables.preco || '',
      'preco_original': variables.preco_original || '',
      'desconto': variables.desconto?.toString() || '',
      'comissao': variables.comissao?.toString() || '',
      'loja': variables.loja || ''
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
      .or(`user_id.eq.${userId},is_system_default.eq.true`)
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
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }
};
