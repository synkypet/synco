import { createClient } from '@/lib/supabase/client';
import { Template, TemplateCategory } from '@/types/template';

const supabase = createClient();

export const templateService = {
  async list(userId: string): Promise<Template[]> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Se estiver vazio, garantir os templates padrão
    if (!data || data.length === 0) {
      return this.ensureDefaultTemplates(userId);
    }

    return data as Template[];
  },

  async upsert(template: Partial<Template> & { user_id: string }): Promise<Template> {
    const { data, error } = await supabase
      .from('templates')
      .upsert(template)
      .select()
      .single();

    if (error) throw error;
    return data as Template;
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async incrementUsage(id: string): Promise<void> {
    // RPC seria melhor, mas para o MVP vamos fazer via service
    const { data: current } = await supabase
      .from('templates')
      .select('usage_count')
      .eq('id', id)
      .single();
    
    if (current) {
      await supabase
        .from('templates')
        .update({ usage_count: (current.usage_count || 0) + 1 })
        .eq('id', id);
    }
  },

  async ensureDefaultTemplates(userId: string): Promise<Template[]> {
    const defaults: Omit<Template, 'id' | 'created_at' | 'updated_at'>[] = [
      {
        user_id: userId,
        name: 'Oferta Irresistível',
        category: 'promo',
        is_favorite: true,
        usage_count: 234,
        content: `🔥 *OFERTA IRRESISTÍVEL* 🔥\n\n*{produto_nome}*\n\nDe ~R$ {preco_original}~ por apenas *R$ {preco_atual}*!\n\n💰 Economia de R$ {valor_economizado} ({desconto_percentual}% OFF)\n\n🛒 *{loja}*\n⭐ Nota: {score}\n\n🚀 *COMPRE AQUI:* {link_afiliado}`
      },
      {
        user_id: userId,
        name: 'Cupom Destaque',
        category: 'coupon',
        is_favorite: false,
        usage_count: 156,
        content: `🎟️ *CUPOM ATIVO!*\n\n*{produto_nome}*\n\nPreço: *R$ {preco_atual}* com cupom *{cupom}*\nDe R$ {preco_original} → Economia de {desconto_percentual}%\n\n💸 Comissão: {comissao_percentual}%\n\n🔗 {link_afiliado}\n\n⏰ Corre que acaba rápido!`
      },
      {
        user_id: userId,
        name: 'Flash Sale ⚡',
        category: 'flash',
        is_favorite: false,
        usage_count: 389,
        content: `⚡ *OFERTA RELÂMPAGO* ⚡\n\n{produto_nome}\n*R$ {preco_atual}* | -{desconto_percentual}%\n\n🛒 {link_afiliado}\n\n📦 Últimas unidades!`
      }
    ];

    const { data, error } = await supabase
      .from('templates')
      .insert(defaults)
      .select();

    if (error) throw error;
    return data as Template[];
  },

  renderTemplate(content: string, data: Record<string, any>): string {
    let rendered = content;
    const mockData: Record<string, string> = {
      produto_nome: 'Tênis Nike Air Max',
      preco_original: '899,90',
      preco_atual: '599,90',
      desconto_percentual: '33',
      valor_economizado: '300,00',
      cupom: 'NIKE30',
      link_afiliado: 'https://shpe.co/aff/abc123',
      loja: 'Shopee',
      categoria: 'Calçados',
      score: '⭐ 4.9',
      parcelamento: '10x sem juros',
      frete_gratis: 'Sim',
      comissao_percentual: '10',
      comissao_estimada: '59,99'
    };

    const finalData = { ...mockData, ...data };

    Object.entries(finalData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    });

    return rendered;
  }
};
