'use client';

import React from 'react';
import { DestinationList as DestinationType } from '@/types/destination-list';
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
import { MoreHorizontal, Edit, Trash2, List, Layers, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DestinationListProps {
  destinations: DestinationType[];
  onEdit: (dest: DestinationType) => void;
  onDelete: (dest: DestinationType) => void;
}

export function DestinationList({ destinations, onEdit, onDelete }: DestinationListProps) {
  if (destinations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
          <Layers className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold">Nenhuma lista encontrada</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
          Organize seus grupos em listas para facilitar o envio simultâneo para múltiplos destinos.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Nome da Lista</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-[100px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {destinations.map((dest) => (
            <TableRow key={dest.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-semibold flex items-center gap-2">
                <List size={16} className="text-primary" />
                {dest.name}
              </TableCell>
              <TableCell>
                {dest.is_active ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none gap-1 py-0.5">
                    <CheckCircle2 size={12} /> Ativa
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="py-0.5">Inativa</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">
                {dest.description || <span className="text-muted-foreground/30 italic">Sem descrição</span>}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuItem onClick={() => onEdit(dest)} className="gap-2 cursor-pointer">
                      <Edit size={14} className="text-primary" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(dest)} 
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                    >
                      <Trash2 size={14} /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
