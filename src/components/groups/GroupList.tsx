'use client';

import React from 'react';
import { Group, Channel } from '@/types/group';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, ExternalLink, Hash, MessageCircle, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GroupListProps {
  groups: Group[];
  channels: Channel[];
  onEdit: (group: Group) => void;
  onDelete: (group: Group) => void;
}

export function GroupList({ groups, channels, onEdit, onDelete }: GroupListProps) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
          <Hash className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold">Nenhum grupo encontrado</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
          Você ainda não cadastrou nenhum grupo de destino. Vincule seus grupos aos canais de envio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead className="w-[100px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const channel = channels.find(c => c.id === group.channel_id);
            return (
              <TableRow key={group.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold">{group.name}</TableCell>
                <TableCell>
                  {channel ? (
                    <div className="flex items-center gap-2">
                      {channel.type === 'whatsapp' ? (
                        <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-100">
                          <MessageCircle size={14} />
                          <span className="text-xs font-semibold uppercase">{channel.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                          <Send size={14} />
                          <span className="text-xs font-semibold uppercase">{channel.name}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="destructive">Sem Canal</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuItem onClick={() => onEdit(group)} className="gap-2 cursor-pointer">
                        <Edit size={14} className="text-primary" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(group)} 
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                      >
                        <Trash2 size={14} /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
