import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const gate = await requireAuthenticatedUser();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const body = await request.json();
    const { action, payload } = body;

    const supabase = createAdminClient();

    if (action === 'create' || action === 'clone') {
      const {
        coupon_label,
        code,
        custom_description,
        redemption_url,
        image_url
      } = payload;

      if (!coupon_label && !custom_description && !code && !redemption_url) {
        return NextResponse.json({ error: 'Os dados do cupom não podem estar vazios.' }, { status: 400 });
      }

      // Dedupe seguro
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const dedupe_key = `manual:${user.id}:${timestamp}:${random}`;

      const couponType = code ? 'codigo' : (redemption_url ? 'link_resgate' : 'pagina_cupons');

      const data = {
        user_id: user.id,
        marketplace: 'shopee',
        offer_type: 'coupon_offer',
        coupon_type: couponType,
        code: code || null,
        coupon_label: coupon_label || null,
        custom_title: coupon_label || null,
        custom_description: custom_description || null,
        raw_text: custom_description || null,
        redemption_url: redemption_url || null,
        image_url: image_url || null,
        is_manual: true,
        status: 'candidate',
        validation_status: 'verified',
        is_verified_coupon: true,
        dedupe_key,
        dispatchable: false,
        auto_dispatch_blocked: true,
        confidence: 1
      };

      const { data: result, error } = await supabase
        .from('discovered_coupons')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ status: 'SUCCESS', coupon: result });
    }

    if (action === 'update') {
      const {
        id,
        coupon_label,
        code,
        custom_description,
        redemption_url,
        image_url
      } = payload;

      if (!id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

      const couponType = code ? 'codigo' : (redemption_url ? 'link_resgate' : 'pagina_cupons');

      const { data: result, error } = await supabase
        .from('discovered_coupons')
        .update({
          coupon_label: coupon_label || null,
          custom_title: coupon_label || null,
          custom_description: custom_description || null,
          raw_text: custom_description || null,
          code: code || null,
          redemption_url: redemption_url || null,
          image_url: image_url || null,
          coupon_type: couponType
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('is_manual', true)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ status: 'SUCCESS', coupon: result });
    }

    if (action === 'delete') {
      const { id } = payload;
      if (!id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

      const { error } = await supabase
        .from('discovered_coupons')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('is_manual', true);

      if (error) throw error;
      return NextResponse.json({ status: 'SUCCESS' });
    }

    return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 });

  } catch (error: any) {
    console.error('[MANUAL-COUPON-ROUTE] Erro crítico:', error.message);
    return NextResponse.json(
      { error: 'Falha interna ao processar cupom manual.' }, 
      { status: 500 }
    );
  }
}
