"use client";

import React, { useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import {
    Bot, Send, Sparkles, MessageSquare, Loader2,
    RefreshCw, Copy, ThumbsUp, Wand2, FileText,
    Zap, TrendingUp, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

const QUICK_ACTIONS = [
    { icon: Wand2, label: 'Melhorar texto', prompt: 'Melhore este texto de oferta para ficar mais atrativo e vendedor: ' },
    { icon: FileText, label: '3 variações', prompt: 'Crie 3 variações diferentes de texto para divulgação de produto de afiliado. Use emojis e seja persuasivo.' },
    { icon: Zap, label: 'Deixar mais curto', prompt: 'Deixe este texto mais curto e direto ao ponto, mantendo a persuasão: ' },
    { icon: TrendingUp, label: 'Deixar mais vendedor', prompt: 'Reescreva este texto de oferta para ser muito mais vendedor e urgente: ' },
];

const SUGGESTIONS = [
    "Como configurar meu código de afiliado?",
    "Melhor horário para enviar ofertas?",
    "Como criar um template de mensagem?",
    "O que é score de oportunidade?",
    "Como funciona o monitoramento?",
    "Melhores práticas de envio em massa?",
];

// Mensagem de boas-vindas no formato v6 (com parts)
const INITIAL_MESSAGES = [
    {
        id: 'welcome-1',
        role: 'assistant' as const,
        parts: [
            {
                type: 'text' as const,
                text: `Olá! Sou o Assistente IA do SYNCO 🤖✨

Posso te ajudar com:
- **Criar e melhorar textos** de ofertas
- **Analisar links de produtos** (cole o link aqui!)
- **Explicar funcionalidades** do sistema
- **Sugerir estratégias** de envio
- **Qualquer dúvida** sobre a plataforma

O que você precisa hoje?`,
            }
        ],
    }
];

// Helper: extrai texto legível de uma UIMessage (v6 usa parts, não content)
function getMessageText(msg: any): string {
    // v6: msg.parts é um array de objetos com type e text/content
    if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
    }
    // Fallback para o campo content legado (mensagens iniciais antigas, etc.)
    if (typeof msg.content === 'string') return msg.content;
    return '';
}

// Transporte explícito: garante que o useChat envie ao endpoint correto
const chatTransport = new DefaultChatTransport({
    api: '/api/ai/chat',
});

export default function AssistenteIAPage() {
    const [inputValue, setInputValue] = React.useState('');

    const { messages, status, sendMessage, setMessages } = useChat({
        transport: chatTransport,
        messages: INITIAL_MESSAGES as any,
        onError: (e: any) => toast.error('Erro no assistente: ' + e.message),
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = inputValue.trim();
        if (!text || isLoading) return;

        setInputValue('');
        sendMessage({ text });
    };

    const copyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado para a área de transferência!');
    };

    return (
        <div className="p-6 h-[calc(100vh-64px)] flex flex-col max-w-7xl mx-auto space-y-6">
            <PageHeader 
                title="Assistente IA" 
                description="Centro de Comando Cinético e Inteligência da Plataforma" 
            />

            <div className="grid lg:grid-cols-4 gap-6 flex-1 overflow-hidden min-h-0">
                {/* Sidebar de ações rápidas */}
                <div className="hidden lg:flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    <TactileCard variant="flat" className="p-5 bg-anthracite-surface/50">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-kinetic-orange/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-kinetic-orange" />
                            </div>
                            <h3 className="font-bold text-sm text-white">Ações Rápidas</h3>
                        </div>
                        <div className="space-y-2">
                            {QUICK_ACTIONS.map((action, i) => {
                                const Icon = action.icon;
                                return (
                                    <Button
                                        key={i}
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start text-xs h-10 border-none bg-deep-void shadow-skeuo-pressed text-muted-foreground hover:text-white hover:shadow-glow-orange transition-all"
                                        onClick={() => {
                                            sendMessage({ text: action.prompt });
                                        }}
                                    >
                                        <Icon className="w-3.5 h-3.5 mr-2 text-kinetic-orange" />
                                        {action.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </TactileCard>

                    <TactileCard variant="flat" className="p-5 bg-anthracite-surface/50">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <h3 className="font-bold text-sm text-white">Dúvidas Comuns</h3>
                        </div>
                        <div className="space-y-1.5">
                            {SUGGESTIONS.map((s: string, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage({ text: s })}
                                    className="w-full text-left text-xs p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all duration-200"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </TactileCard>
                </div>

                {/* Chat principal */}
                <div className="lg:col-span-3 flex flex-col h-full min-h-0">
                    <TactileCard className="flex flex-col h-full overflow-hidden bg-anthracite-surface min-h-0">
                        {/* Header do Chat */}
                        <div className="flex items-center justify-between px-6 py-4 bg-white/5 backdrop-blur-sm shadow-skeuo-flat border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-kinetic-orange flex items-center justify-center shadow-glow-orange">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold tracking-tight text-white">SYNCO Intelligence</p>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Ativo Agora</p>
                                    </div>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all"
                                onClick={() => setMessages(INITIAL_MESSAGES as any)}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Área de Mensagens */}
                        <div 
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-deep-void/40 min-h-0"
                        >
                            {messages.map((msg: any, i: number) => {
                                const text = getMessageText(msg);

                                // Se for ferramenta, exibir um indicador visual no chat
                                const hasToolCalls = msg.parts?.some((p: any) => p.type === 'tool-invocation' || p.type === 'tool-call');
                                const hasToolResults = msg.parts?.some((p: any) => p.type === 'tool-result');

                                if (!text && msg.role !== 'user' && !hasToolCalls && !hasToolResults) return null;

                                return (
                                    <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-full bg-kinetic-orange/20 flex items-center justify-center flex-shrink-0 mt-1 mr-3 shadow-glow-orange-intense">
                                                <Bot className="w-4 h-4 text-kinetic-orange" />
                                            </div>
                                        )}
                                        <div className={`max-w-[85%] group ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                                            <div className={`rounded-3xl px-5 py-4 text-sm ${
                                                msg.role === 'user'
                                                    ? 'bg-kinetic-orange text-white rounded-br-none shadow-glow-orange-intense font-medium'
                                                    : 'bg-anthracite-surface rounded-bl-none shadow-skeuo-elevated text-zinc-200'
                                            }`}>
                                                {text && (
                                                    <div className="whitespace-pre-wrap leading-relaxed">
                                                        {text}
                                                    </div>
                                                )}
                                                
                                                {/* Tool Call / Result Indicator */}
                                                {(hasToolCalls || hasToolResults) && msg.role === 'assistant' && (
                                                    <div className="mt-2 p-3 rounded-xl bg-deep-void/80 border-none shadow-skeuo-pressed flex flex-col gap-2">
                                                        <div className="flex items-center gap-2 text-xs text-kinetic-orange font-bold uppercase tracking-wider">
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            Analisando Link de Produto...
                                                        </div>
                                                        {hasToolResults && (
                                                            <div className="text-xs text-green-400 font-medium">
                                                                ✓ Dados extraídos com sucesso.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {msg.role === 'assistant' && text && (
                                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                                                    <button 
                                                        onClick={() => copyMessage(text)}
                                                        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 text-[10px] font-bold text-muted-foreground transition-colors border-none"
                                                    >
                                                        <Copy className="w-3 h-3" /> COPIAR
                                                    </button>
                                                    <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 text-[10px] font-bold text-muted-foreground transition-colors border-none">
                                                        <ThumbsUp className="w-3 h-3" /> ÚTIL
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {isLoading && (
                                <div className="flex justify-start animate-in fade-in duration-300">
                                    <div className="w-8 h-8 rounded-full bg-kinetic-orange/20 flex items-center justify-center flex-shrink-0 mt-1 mr-3 shadow-glow-orange-intense">
                                        <Bot className="w-4 h-4 text-kinetic-orange" />
                                    </div>
                                    <div className="bg-anthracite-surface rounded-3xl rounded-bl-none px-6 py-4 flex gap-1.5 items-center shadow-skeuo-elevated">
                                        <div className="w-2 h-2 bg-kinetic-orange/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-2 h-2 bg-kinetic-orange/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-2 h-2 bg-kinetic-orange/80 rounded-full animate-bounce" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de Mensagem */}
                        <div className="p-6 bg-anthracite-surface shadow-skeuo-flat border-t border-white/5 relative">
                            <form onSubmit={handleFormSubmit} className="relative flex items-center">
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Escreva sua dúvida ou peça para analisar um link..."
                                    className="pr-24 py-7 rounded-2xl border-none shadow-skeuo-pressed bg-deep-void text-white focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 text-base"
                                    disabled={isLoading}
                                />
                                <div className="absolute right-2 flex items-center gap-1">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-10 w-10 text-muted-foreground hover:text-white rounded-xl border-none"
                                        disabled={isLoading}
                                    >
                                        <MessageSquare className="w-5 h-5" />
                                    </Button>
                                    <KineticButton
                                        type="submit"
                                        disabled={isLoading || !inputValue.trim()}
                                        className="h-11 w-11 px-0 py-0 disabled:opacity-30 disabled:hover:shadow-glow-orange"
                                    >
                                        <Send className="w-5 h-5" />
                                    </KineticButton>
                                </div>
                            </form>
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-60">SYNCO Intelligence Engine</p>
                                <div className="h-1 w-1 rounded-full bg-kinetic-orange/50 shadow-glow-orange" />
                                <p className="text-[10px] text-kinetic-orange font-bold tracking-widest uppercase opacity-80">Online</p>
                            </div>
                        </div>
                    </TactileCard>
                </div>
            </div>
        </div>
    );
}
