'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Helper: extrai texto legível de uma UIMessage (v6 usa parts, não content)
function getMessageText(msg: any): string {
    if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
    }
    if (typeof msg.content === 'string') return msg.content;
    return '';
}

const chatTransport = new DefaultChatTransport({
    api: '/api/ai/chat',
});

export default function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const { messages, status, sendMessage } = useChat({
    transport: chatTransport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    (sendMessage as any)({ text });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Container Aberto do Chat */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out origin-bottom-right rounded-2xl overflow-hidden shadow-skeuo-elevated bg-anthracite-surface border border-white/5 flex flex-col mb-4",
          isOpen ? "opacity-100 scale-100 h-[450px] w-[350px] sm:w-[400px]" : "opacity-0 scale-95 h-0 w-[400px] pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-deep-void flex items-center justify-center shadow-glow-orange overflow-hidden border border-kinetic-orange/30">
                 <Image src="/logo-synco.png" alt="SYNKY" width={40} height={40} className="object-cover" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] border-2 border-anthracite-surface" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white flex items-center gap-2">SYNKY
                 <Sparkles className="w-3 h-3 text-kinetic-orange" />
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-deep-void/40 custom-scrollbar min-h-0 flex flex-col">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 space-y-3">
               <Bot className="w-8 h-8 text-kinetic-orange" />
               <p className="text-xs text-white">Olá! Mande sua dúvida ou um link de produto para eu analisar.</p>
            </div>
          )}
          {messages.map((m: any) => (
            <div key={m.id} className={cn(
              "max-w-[85%] rounded-2xl p-3 text-sm flex flex-col",
              m.role === 'user' 
                ? "bg-kinetic-orange text-white rounded-br-none ml-auto shadow-glow-orange" 
                : "bg-anthracite-surface text-zinc-200 rounded-bl-none shadow-skeuo-flat border border-white/5 mr-auto"
            )}>
              <div className="whitespace-pre-wrap">{getMessageText(m)}</div>
            </div>
          ))}
          {isLoading && (
             <div className="max-w-[85%] rounded-2xl p-4 bg-anthracite-surface text-zinc-200 rounded-bl-none shadow-skeuo-flat border border-white/5 mr-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-kinetic-orange/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-kinetic-orange/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-kinetic-orange/80 rounded-full animate-bounce" />
             </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 bg-anthracite-surface border-t border-white/5">
          <form onSubmit={handleFormSubmit} className="relative flex items-center">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              placeholder="Fale com o SYNKY..."
              className="pr-12 bg-deep-void border-none shadow-skeuo-pressed text-white placeholder:text-zinc-500 rounded-xl w-full"
            />
            <Button
               type="submit"
               size="icon"
               disabled={isLoading || !inputValue.trim()}
               className="absolute right-1 w-8 h-8 rounded-lg bg-kinetic-orange hover:bg-orange-600 text-white shadow-glow-orange disabled:opacity-50"
            >
               <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Botão Flutuante (Fechado) */}
      <div className="flex items-center gap-3">
        {!isOpen && (
          <div className="bg-white px-4 py-2 rounded-2xl rounded-br-none shadow-skeuo-elevated border border-zinc-200 animate-in fade-in slide-in-from-right-4 duration-500 hidden sm:block">
            <p className="text-sm font-bold text-deep-void">Precisa de ajuda?</p>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative group focus:outline-none transition-transform hover:scale-105 active:scale-95"
        >
          <div className="w-16 h-16 rounded-full bg-deep-void shadow-skeuo-elevated flex items-center justify-center overflow-hidden border-2 border-kinetic-orange transition-all duration-300 group-hover:shadow-glow-orange-intense">
            <Image 
               src="/logo-synco.png" 
               alt="SYNKY Mascot" 
               width={64} 
               height={64} 
               className="object-cover"
            />
          </div>
          {/* Notification Dot indicator */}
          {!isOpen && (
            <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-deep-void animate-pulse" />
          )}
        </button>
      </div>

    </div>
  );
}
