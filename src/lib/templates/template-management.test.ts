// src/lib/templates/template-management.test.ts
import { templateService } from '../../services/supabase/template-service';
import { resolveAndRenderTemplate } from './universal-template-engine';
import { FactualData } from '../linkProcessor';

async function runTests() {
  console.log('--- [TEMPLATE-MANAGEMENT-TEST] INICIANDO ---');

  const mockUserIdA = 'user-a-uuid';
  const mockUserIdB = 'user-b-uuid';
  
  const baseFactual: FactualData = {
    originalUrl: 'https://shopee.com.br/product/1/2',
    cleanUrl: 'https://shopee.com.br/product/1/2',
    marketplace: 'Shopee',
    title: 'Produto Teste',
    price: 100,
    priceFormatted: 'R$ 100,00',
    finalLinkToSend: 'https://s.shopee.com.br/affiliate',
    fetchedAt: new Date().toISOString(),
    incoming_url: 'https://shopee.com.br/product/1/2',
    canonical_url: 'https://shopee.com.br/product/1/2',
    reaffiliation_status: 'success',
    eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' },
    pixDisplayEligible: false
  };

  // Mock Supabase storage
  const storage = {
    message_templates: [
      { id: 'sys-prod-1', user_id: null, name: 'Padrão Sistema', template_type: 'shopee_product', content: 'SISTEMA: {{product_name}}', is_system: true, is_default: true, is_active: true },
      { id: 'user-a-prod-1', user_id: mockUserIdA, name: 'Meu Template', template_type: 'shopee_product', content: 'USUÁRIO A: {{product_name}}', is_system: false, is_default: false, is_active: true }
    ],
    message_template_user_settings: [] as any[]
  };

  let currentUserId: string | null = null;
  let currentTemplateType: string | null = null;
  let currentIsActive: boolean | null = null;

  const mockSupabase = {
    from: (table: string) => {
      const chain = {
        select: (query: string = '*') => chain,
        or: (query: string) => chain,
        eq: (col: string, val: any) => {
          if (col === 'user_id') currentUserId = val;
          if (col === 'template_type') currentTemplateType = val;
          if (col === 'is_active') currentIsActive = val;
          return chain;
        },
        order: (col: string, options?: any) => chain,
        limit: (n: number) => {
          if (table === 'message_templates') {
            // Simular retorno de templates do usuário para a trava de segurança
            const filtered = storage.message_templates.filter(t => 
              t.user_id === currentUserId && 
              t.template_type === currentTemplateType && 
              (currentIsActive === null || t.is_active === currentIsActive)
            );
            return Promise.resolve({ data: filtered });
          }
          return chain;
        },
        maybeSingle: () => {
          if (table === 'message_template_user_settings') {
            const setting = storage.message_template_user_settings.find(s => s.user_id === currentUserId && s.template_type === currentTemplateType);
            if (setting && setting.active_user_template_id) {
              const t = storage.message_templates.find(x => x.id === setting.active_user_template_id);
              return Promise.resolve({ data: { ...setting, active_user_template_id: t } });
            }
            return Promise.resolve({ data: setting });
          }
          const template = storage.message_templates.find(t => t.template_type === currentTemplateType && t.is_system);
          return Promise.resolve({ data: template });
        },
        single: () => {
          const template = storage.message_templates.find(t => t.template_type === currentTemplateType && t.is_system);
          return Promise.resolve({ data: template });
        },
        upsert: (data: any, options?: any) => {
          const idx = storage.message_template_user_settings.findIndex(s => s.user_id === data.user_id && s.template_type === data.template_type);
          if (idx >= 0) {
            storage.message_template_user_settings[idx] = { ...storage.message_template_user_settings[idx], ...data };
          } else {
            storage.message_template_user_settings.push({ ...data, system_template_enabled: true });
          }
          return Promise.resolve({ error: null });
        },
        insert: (data: any[]) => {
          storage.message_template_user_settings.push(...data);
          return { select: () => ({ single: () => Promise.resolve({ data: data[0] }) }) };
        }
      };
      return chain;
    }
  } as any;




  // --- CENÁRIO A: Usuário sem template configurado (Usa padrão do sistema) ---
  console.log('\n[CENÁRIO A] Usuário sem template configurado');
  const resA = await resolveAndRenderTemplate(mockSupabase, baseFactual, mockUserIdA);
  console.log('Resultado:', resA.content);
  console.assert(resA.content.includes('SISTEMA:'), 'Deve usar template do sistema');
  console.assert(resA.isSystem === true, 'Deve marcar como sistema');

  // --- CENÁRIO B: Usuário ativa template próprio ---
  console.log('\n[CENÁRIO B] Usuário ativa template próprio');
  await templateService.setActiveUserTemplate(mockSupabase, mockUserIdA, 'shopee_product', 'user-a-prod-1');
  const resB = await resolveAndRenderTemplate(mockSupabase, baseFactual, mockUserIdA);
  console.log('Resultado:', resB.content);
  console.assert(resB.content.includes('USUÁRIO A:'), 'Deve usar template do usuário');
  console.assert(resB.isSystem === false, 'Deve marcar como customizado');

  // --- CENÁRIO C: Usuário A desativa padrão, mas Usuário B continua com ele ---
  console.log('\n[CENÁRIO C] Desativação independente (User A vs User B)');
  await templateService.toggleSystemTemplate(mockSupabase, mockUserIdA, 'shopee_product', false);
  const resC_A = await resolveAndRenderTemplate(mockSupabase, baseFactual, mockUserIdA);
  const resC_B = await resolveAndRenderTemplate(mockSupabase, baseFactual, mockUserIdB);
  
  console.log('User A (Sistema Off, Custom On):', resC_A.content);
  console.log('User B (Padrão):', resC_B.content);
  
  console.assert(resC_A.content.includes('USUÁRIO A'), 'User A continua com o dele');
  console.assert(resC_B.content.includes('SISTEMA'), 'User B continua com sistema');

  // --- CENÁRIO D: Tentar desativar padrão sem custom ativo ---
  console.log('\n[CENÁRIO D] Bloqueio de desativação sem alternativa');
  try {
    await templateService.toggleSystemTemplate(mockSupabase, mockUserIdB, 'shopee_product', false);
    console.error('ERRO: Não deveria permitir desativar sem custom');
  } catch (err: any) {
    console.log('Sucesso: Bloqueado corretamente:', err.message);
    console.assert(err.message === 'default_template_requires_active_user_template');
  }

  // --- CENÁRIO E: Auto-reativação ao "excluir" (ou desativar) o custom ativo ---
  console.log('\n[CENÁRIO E] Auto-reativação do padrão');
  // Simular desativação do template do usuário
  const userTemplate = storage.message_templates.find(t => t.id === 'user-a-prod-1');
  if (userTemplate) userTemplate.is_active = false;
  
  const resE = await resolveAndRenderTemplate(mockSupabase, baseFactual, mockUserIdA);
  console.log('Resultado:', resE.content);
  console.assert(resE.content.includes('SISTEMA'), 'Deve ter reativado o sistema automaticamente');
  console.assert(resE.isSystem === true, 'Deve ser sistema');

  console.log('\n--- [TEMPLATE-MANAGEMENT-TEST] CONCLUÍDO ---');
}

runTests().catch(err => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
