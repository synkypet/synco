'use client';

import React, { useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Info, 
  Lock, 
  Unlock, 
  Link as LinkIcon, 
  RefreshCw,
  ArrowLeft,
  Calendar,
  MoreHorizontal,
  Mail,
  UserCheck
} from 'lucide-react';
import { useGroupDetail } from '@/hooks/use-groups';
import { useAuth } from '@/contexts/AuthContext';
import { KineticButton } from '@/components/ui/KineticButton';
import { TactileCard } from '@/components/ui/TactileCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface GroupDetailViewProps {
  groupId: string;
}

export function GroupDetailView({ groupId }: GroupDetailViewProps) {
  const { user } = useAuth();
  const { 
    group, 
    participants,
    meshData,
    isLoading, 
    isSyncing, 
    sync, 
    isError 
  } = useGroupDetail(groupId, user?.id);

  const metadata = meshData?.metadata || {};

  // Gatilho de Deep Sync Automático no primeiro carregamento
  useEffect(() => {
    // A query em useGroupDetail já é disparada automaticamente mediante 'enabled'.
  }, [isLoading, group?.id, sync]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-[32px] bg-white/5" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-white/5" />
            <Skeleton className="h-4 w-40 bg-white/5" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
             <Skeleton className="h-64 w-full rounded-3xl bg-white/5" />
          </div>
          <Skeleton className="h-64 w-full rounded-3xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-red-500/5 rounded-[40px] shadow-skeuo-pressed">
        <Info className="w-12 h-12 text-red-500/40 mb-4" />
        <h2 className="text-xl font-bold text-white/90">Grupo não encontrado ou inacessível</h2>
        <p className="text-white/40 text-sm mt-1">Verifique as permissões ou se o grupo ainda existe no WhatsApp.</p>
        <Link href="/grupos" className="mt-8">
          <KineticButton variant="flat" className="bg-white/5 shadow-skeuo-flat hover:bg-white/10 text-white/60">Voltar para listagem</KineticButton>
        </Link>
      </div>
    );
  }

  const admins = participants.filter((p: any) => p.role === 'admin' || p.role === 'creator' || p.role === 'superadmin');
  const members = participants.filter((p: any) => !['admin', 'creator', 'superadmin'].includes(p.role));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header — Malha Operacional */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="w-24 h-24 rounded-[32px] shadow-skeuo-elevated border-none ring-4 ring-deep-void">
              <AvatarImage src={metadata.avatar_url || group.avatar_url || ''} className="object-cover" />
              <AvatarFallback className="bg-anthracite-surface text-3xl font-black text-white/20">
                {group.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-deep-void border-none flex items-center justify-center shadow-glow-orange">
               <ShieldCheck className="w-4 h-4 text-kinetic-orange" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-white drop-shadow-sm">{group.name}</h1>
            <div className="flex items-center gap-3 text-white/40 text-sm font-medium">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {group.members_count || 0} membros</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" /> {group.admin_count || 0} admins</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-kinetic-orange/60 font-bold">{group.channel_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <KineticButton 
            variant="flat"
            onClick={() => sync()} 
            disabled={isSyncing || !(group as any).has_valid_key}
            className="bg-white/5 border-none h-12 px-6 shadow-skeuo-flat hover:bg-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin text-kinetic-orange' : 'text-white/40'}`} />
            {isSyncing ? 'Sincronizando...' : 'Atualizar Malha'}
          </KineticButton>
          
          {metadata.invite_link && (
            <KineticButton 
              onClick={() => {
                navigator.clipboard.writeText(metadata.invite_link!);
                toast.success('Link copiado!');
              }}
              className="bg-kinetic-orange shadow-glow-orange h-12 px-6"
            >
              <LinkIcon className="w-4 h-4 mr-2" /> Copiar Link
            </KineticButton>
          )}
        </div>
      </div>

      {/* Alerta de Sessão Desconectada (Físico) */}
      {(isError as any)?.response?.data?.error === 'session_disconnected' && (
        <TactileCard className="p-6 bg-red-500/5 border-none shadow-skeuo-elevated animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shadow-skeuo-flat shrink-0">
               <ShieldCheck className="w-6 h-6 text-red-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-red-500 uppercase tracking-widest text-sm italic">WhatsApp Desconectado</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Sessão desconectada — reconecte via QR Code para sincronizar participantes e administradores.
              </p>
              <div className="flex items-center gap-4 mt-4">
                <Link href="/canais">
                  <KineticButton className="bg-kinetic-orange shadow-glow-orange h-10 px-4 text-xs">
                    Reconectar Canal
                  </KineticButton>
                </Link>
                <Link href="/canais" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/60">
                  Gerar novo QR →
                </Link>
              </div>
            </div>
          </div>
        </TactileCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel de Participantes */}
        <div className="lg:col-span-2 space-y-6">
          <TactileCard className="p-0 overflow-hidden">
            <div className="p-6 bg-deep-void/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-deep-void flex items-center justify-center shadow-skeuo-flat">
                   <Users className="w-5 h-5 text-kinetic-orange" />
                </div>
                <h3 className="font-bold text-white/80">Participantes Identificados</h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20 bg-white/5 px-2 py-1 rounded-md">
                Última sincronização: {group.updated_at ? new Date(group.updated_at).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            
            <div className="divide-y-none max-h-[600px] overflow-y-auto custom-scrollbar">
              {participants.length === 0 ? (
                <div className="p-12 text-center text-white/20 italic text-sm">
                  Nenhum detalhe de participante carregado. Clique em "Atualizar Malha".
                </div>
              ) : (
                participants.map((p: any) => (
                  <div key={p.remote_id} className="p-4 flex items-center justify-between group hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10 rounded-xl shadow-skeuo-flat border-none">
                        <AvatarImage src={p.avatar_url} />
                        <AvatarFallback className="bg-deep-void text-xs font-bold text-white/20">
                          {p.push_name?.substring(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold text-white/90">{p.push_name || p.remote_id}</p>
                        <p className="text-[10px] text-white/30 font-mono tracking-tight">{p.remote_id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {p.role === 'creator' ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-kinetic-orange/10 shadow-skeuo-flat">
                          <ShieldCheck className="w-3 h-3 text-kinetic-orange" />
                          <span className="text-[9px] font-black uppercase text-kinetic-orange tracking-wider">Criador</span>
                        </div>
                      ) : (p.role === 'admin' || p.role === 'superadmin') ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 shadow-skeuo-flat">
                          <UserCheck className="w-3 h-3 text-emerald-500" />
                          <span className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">
                            {p.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest">Membro</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TactileCard>
        </div>

        {/* Sidebar de Metadados e Permissões */}
        <div className="space-y-8">
          <TactileCard className="p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Info className="w-4 h-4" /> Metadados do Grupo
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Descrição</p>
                <div className="p-3 rounded-xl bg-deep-void/50 shadow-skeuo-pressed text-xs text-white/60 leading-relaxed italic">
                  {metadata.description || 'Nenhuma descrição fornecida pela malha.'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Dono / Criador</p>
                  <p className="text-xs text-white/70 font-mono flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3 h-3 text-kinetic-orange/60 shrink-0" /> 
                    {metadata.owner || 'Não identificado'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Criado em</p>
                    <p className="text-xs text-white/70 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-kinetic-orange/60" /> 
                      {metadata.remote_created_at ? new Date(metadata.remote_created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Última Sync</p>
                    <p className="text-xs text-white/70 font-medium flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 text-emerald-500/60" />
                      {group.updated_at ? new Date(group.updated_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TactileCard>

          <TactileCard className="p-6 space-y-6 bg-emerald-500/[0.02]">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Permissões da Malha
            </h3>
            
            <div className="space-y-3">
              {[
                { label: 'Somente Admins mandam', active: metadata.permissions?.announcement },
                { label: 'Restringir Edição', active: metadata.permissions?.restrict },
                { label: 'Entrada aprovada', active: metadata.permissions?.joinApprovalMode }
              ].map((perm, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-deep-void/40 shadow-skeuo-pressed">
                  <span className="text-xs font-medium text-white/60">{perm.label}</span>
                  {perm.active ? (
                    <div className="flex items-center gap-1.5 text-emerald-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase">Sim</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-white/20">
                      <Unlock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase">Não</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TactileCard>
        </div>
      </div>
    </div>
  );
}
