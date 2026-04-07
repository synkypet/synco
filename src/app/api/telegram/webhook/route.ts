// src/app/api/telegram/webhook/route.ts
// Webhook do Telegram — recebe atualizações e faz auto-discovery de grupos.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // ─── 1. Validar secret token ─────────────────────────────────────────
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretToken !== expectedSecret) {
      console.warn('[TG-WEBHOOK] Invalid secret token received');
      return NextResponse.json({ ok: true }); // Sempre retornar 200 pro Telegram
    }

    const update = await request.json();

    // ─── 2. Processar my_chat_member (bot adicionado/removido) ───────────
    if (update.my_chat_member) {
      const chatMember = update.my_chat_member;
      const chat = chatMember.chat;
      const newStatus = chatMember.new_chat_member?.status;

      // Só processar grupos e supergrupos
      if (chat.type !== 'group' && chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true });
      }

      const chatId = chat.id.toString();
      const chatName = chat.title || `Grupo ${chatId}`;

      if (newStatus === 'member' || newStatus === 'administrator') {
        // Bot foi adicionado ao grupo → auto-discovery
        console.log(`[TG-WEBHOOK] Bot adicionado ao grupo: ${chatName} (${chatId})`);

        await handleGroupDiscovery(chatId, chatName, chat.type);

      } else if (newStatus === 'left' || newStatus === 'kicked') {
        // Bot foi removido do grupo
        console.log(`[TG-WEBHOOK] Bot removido do grupo: ${chatName} (${chatId})`);

        await handleGroupRemoval(chatId);
      }
    }

    // ─── 3. Processar message com new_chat_members (fallback) ────────────
    if (update.message?.new_chat_members) {
      const chat = update.message.chat;
      const newMembers = update.message.new_chat_members;

      // Verificar se algum dos novos membros é o bot
      for (const member of newMembers) {
        if (member.is_bot) {
          const chatId = chat.id.toString();
          const chatName = chat.title || `Grupo ${chatId}`;

          console.log(`[TG-WEBHOOK] Bot detectado como novo membro em: ${chatName} (${chatId})`);
          await handleGroupDiscovery(chatId, chatName, chat.type);
          break;
        }
      }
    }

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('[TG-WEBHOOK] Error:', error.message);
    // Sempre retornar 200 para o Telegram não ficar reenviando
    return NextResponse.json({ ok: true });
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleGroupDiscovery(chatId: string, chatName: string, chatType: string) {
  try {
    const supabase = createAdminClient();

    // Buscar todos os canais Telegram que estão conectados
    const { data: telegramChannels } = await supabase
      .from('channels')
      .select('id, user_id')
      .eq('type', 'telegram')
      .eq('is_active', true);

    if (!telegramChannels || telegramChannels.length === 0) return;

    // Para cada canal Telegram ativo, verificar se o grupo já existe
    for (const channel of telegramChannels) {
      const { data: existingGroup } = await supabase
        .from('groups')
        .select('id')
        .eq('channel_id', channel.id)
        .eq('remote_id', chatId)
        .maybeSingle();

      if (!existingGroup) {
        // Criar novo grupo automaticamente
        await supabase
          .from('groups')
          .insert({
            user_id: channel.user_id,
            channel_id: channel.id,
            name: chatName,
            remote_id: chatId,
            status: 'active',
            is_destination: true,
            is_active: true,
          });

        console.log(`[TG-WEBHOOK] Grupo auto-descoberto: ${chatName} (${chatId}) → canal ${channel.id}`);
      }
    }
  } catch (err: any) {
    console.error('[TG-WEBHOOK] handleGroupDiscovery error:', err.message);
  }
}

async function handleGroupRemoval(chatId: string) {
  try {
    const supabase = createAdminClient();

    // Marcar o grupo como inativo
    await supabase
      .from('groups')
      .update({ status: 'inactive', is_active: false })
      .eq('remote_id', chatId);

    console.log(`[TG-WEBHOOK] Grupo desativado: ${chatId}`);

  } catch (err: any) {
    console.error('[TG-WEBHOOK] handleGroupRemoval error:', err.message);
  }
}
