import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';
export async function POST(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const routeId = params.routeId;
    if (!routeId) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'global', 'coupon', 'page'
    const useSameForAllStr = formData.get('use_same_for_all');

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    
    if (!type || !['global', 'coupon', 'page'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de upload inválido.' }, { status: 400 });
    }

    // Validações
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Apenas PNG, JPEG ou WEBP são permitidos.' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'O tamanho máximo permitido é 5MB.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Validar owner da rota (buscando a source)
    const { data: routeData, error: routeError } = await supabaseAdmin
      .from('automation_routes')
      .select('source_id, template_config')
      .eq('id', routeId)
      .single();

    if (routeError || !routeData) {
      return NextResponse.json({ error: 'Rota não encontrada.' }, { status: 404 });
    }

    const { data: sourceData, error: sourceError } = await supabaseAdmin
      .from('automation_sources')
      .select('user_id')
      .eq('id', routeData.source_id)
      .single();

    if (sourceError || sourceData.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado à automação.' }, { status: 403 });
    }

    const ext = file.type.split('/')[1] || 'png';
    const uuid = crypto.randomUUID();
    const newPath = `${user.id}/${routeId}/${type}/${uuid}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload usando a service role para bypass de RLS no backend
    const { error: uploadError } = await supabaseAdmin.storage
      .from('automation-media')
      .upload(newPath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('[MEDIA-UPLOAD]', uploadError);
      return NextResponse.json({ error: 'Falha ao fazer upload para o Storage.' }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('automation-media')
      .getPublicUrl(newPath);

    const publicUrl = publicUrlData.publicUrl;

    // Recupera a config atual
    let config = routeData.template_config || {};
    if (!config.media) {
      config.media = {};
    }

    const useSameForAll = useSameForAllStr === 'true' 
      ? true 
      : useSameForAllStr === 'false' 
        ? false 
        : config.media.use_same_for_all ?? true;
        
    config.media.use_same_for_all = useSameForAll;

    // Guarda path antigo para deletar
    const oldPathKey = `${type}_path`;
    const oldPath = config.media[oldPathKey];

    // Atualiza o JSON
    config.media[`${type}_url`] = publicUrl;
    config.media[`${type}_path`] = newPath;

    // Atualiza o banco
    const { error: updateError } = await supabaseAdmin
      .from('automation_routes')
      .update({ template_config: config })
      .eq('id', routeId);

    if (updateError) {
      console.error('[MEDIA-UPDATE-DB]', updateError);
      return NextResponse.json({ error: 'Falha ao salvar url da imagem no banco de dados.' }, { status: 500 });
    }

    // Remove arquivo antigo de forma não-bloqueante se houver
    if (oldPath && oldPath !== newPath) {
      supabaseAdmin.storage.from('automation-media').remove([oldPath]).catch(err => {
        console.error('[MEDIA-CLEANUP]', err);
      });
    }

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      path: newPath,
      config: config
    });

  } catch (error: any) {
    console.error('POST /api/automation-routes/[routeId]/media ERROR:', error);
    return NextResponse.json(
      { error: 'Erro não esperado no servidor.' }, 
      { status: 500 }
    );
  }
}
