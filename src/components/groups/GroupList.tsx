'use client';

import React from 'react';
import { 
  Users, 
  ShieldCheck, 
  ExternalLink, 
  MoreVertical,
  Link as LinkIcon
} from 'lucide-react';
import { Group } from '@/types/group';
import { KineticButton } from '@/components/ui/KineticButton';
import { TactileCard } from '@/components/ui/TactileCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

interface GroupListProps {
  groups: Group[];
  isLoading?: boolean;
}

export function GroupList({ groups, isLoading }: GroupListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 rounded-[32px] bg-anthracite-surface/50 shadow-skeuo-flat animate-pulse" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-[40px] shadow-skeuo-pressed">
        <Users className="w-12 h-12 text-white/10 mb-4" />
        <p className="text-white/40 font-medium">Nenhum grupo encontrado na malha.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groups.map((group) => (
        <TactileCard key={group.id} className="p-5 group hover:scale-[1.01] transition-all duration-300">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar do Grupo */}
            <Avatar className="w-14 h-14 rounded-2xl shadow-skeuo-flat border-none flex-shrink-0">
              <AvatarImage src={group.avatar_url || ''} alt={group.name} className="object-cover" />
              <AvatarFallback className="bg-deep-void text-white/30 text-lg font-black italic">
                {group.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Informações Principais */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-black text-white/90 truncate pr-2 tracking-tight">{group.name}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full shadow-sm ${group.status === 'active' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
                </div>
              </div>
              
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 truncate">
                {group.channel_name || 'Desconhecido'}
              </p>

              {/* Badges de Malha */}
              <div className="flex items-center gap-2.5 mt-2.5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-deep-void/50 shadow-skeuo-pressed">
                  <Users className="w-3 h-3 text-kinetic-orange" />
                  <span className="text-[10px] font-black text-white/70">{group.members_count}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-deep-void/50 shadow-skeuo-pressed">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black text-white/70">{group.admin_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer de Ações Táteis */}
          <div className="mt-4 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
               {group.is_source && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-kinetic-orange/10 shadow-skeuo-flat">
                   <div className="w-1 h-1 rounded-full bg-kinetic-orange animate-pulse" />
                   <span className="text-[9px] font-black uppercase tracking-wider text-kinetic-orange">Fonte</span>
                 </div>
               )}
               {group.is_destination && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 shadow-skeuo-flat">
                   <div className="w-1 h-1 rounded-full bg-emerald-500" />
                   <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Destino</span>
                 </div>
               )}
            </div>

            <Link href={`/grupos/${group.id}`}>
              <KineticButton className="h-9 py-0 px-4 bg-transparent shadow-none hover:bg-white/10 flex items-center gap-2 transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest">Detalhes</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </KineticButton>
            </Link>
          </div>
        </TactileCard>
      ))}
    </div>
  );
}
