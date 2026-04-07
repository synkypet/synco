"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const INITIAL_MESSAGES = [
    {
        role: 'assistant',
        content: `Olá! Sou o Assistente IA do SYNCO 🤖✨

Posso te ajudar com:
- **Criar e melhorar textos** de ofertas
- **Explicar funcionalidades** do sistema
- **Sugerir estratégias** de envio
- **Orientação para iniciantes**
- **Qualquer dúvida** sobre a plataforma

O que você precisa hoje?`,
    }
];

export default function AssistenteIAPage() {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const simulateAIResponse = async (userText: string) => {
        setLoading(true);
        // Simulando delay de processamento da IA
        await new Promise(r => setTimeout(r, 1500));
        
        let response = "";
        const text = userText.toLowerCase();

        if (text.includes("shopee") || text.includes("afiliado")) {
            response = "Para configurar seu código de afiliado, vá em **Configurações > Programas de Afiliado**. Lá você pode inserir seu ID de Associado da Amazon, ID de Afiliado Shopee e outros. O SYNCO converterá automaticamente os links para você! 🚀";
        } else if (text.includes("horário") || text.includes("horario")) {
            response = "Segundo nossos dados, o melhor horário para conversões é entre **18:00 e 21:00**. Temos um pico de engajamento nesse período. Você pode agendar seus envios em **Envio Rápido** para esses horários! ⏰";
        } else if (text.includes("melhorar") || text.includes("texto")) {
            response = "Aqui está uma sugestão de texto melhorado:\n\n🔥 **OFERTA IMPERDÍVEL!**\n\nAcabamos de encontrar o menor preço histórico para este produto! 😱\n\n✅ Qualidade Premium\n✅ Entrega Grátis (Prime)\n✅ Menor preço do ano\n\n🛒 **Garanta o seu aqui:** [LINK]\n\n*Estoque limitado, aproveite agora!*";
        } else {
            response = "Entendi! Como estamos em modo de demonstração (Fase 3D), minhas respostas reais virão após a integração completa com os modelos de linguagem. Posso te ajudar com a estrutura visual ou lógica de alguma funcionalidade agora? 😊";
        }

        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        setLoading(false);
    };

    const sendMessage = async (text?: string) => {
        const userText = text || input.trim();
        if (!userText || loading) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userText }]);
        
        await simulateAIResponse(userText);
    };

    const copyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado para a área de transferência!');
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
            <PageHeader 
                title="Assistente IA" 
                description="IA integrada para criação de textos, estratégias e suporte especializado" 
            />

            <div className="grid lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
                {/* Sidebar de ações rápidas */}
                <div className="hidden lg:flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    <Card className="p-5 border-primary/20 bg-primary/5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <h3 className="font-bold text-sm">Ações Rápidas</h3>
                        </div>
                        <div className="space-y-2">
                            {QUICK_ACTIONS.map((action, i) => {
                                const Icon = action.icon;
                                return (
                                    <Button
                                        key={i}
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start text-xs h-10 border-primary/10 hover:border-primary/30 hover:bg-primary/5 bg-card"
                                        onClick={() => {
                                            setInput(action.prompt);
                                        }}
                                    >
                                        <Icon className="w-3.5 h-3.5 mr-2 text-primary" />
                                        {action.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <h3 className="font-bold text-sm">Dúvidas Comuns</h3>
                        </div>
                        <div className="space-y-1.5">
                            {SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(s)}
                                    className="w-full text-left text-xs p-2.5 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200 border border-transparent hover:border-border"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Chat principal */}
                <div className="lg:col-span-3 flex flex-col h-full">
                    <Card className="flex flex-col h-full border-primary/10 shadow-lg overflow-hidden">
                        {/* Header do Chat */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center shadow-md">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card ring-2 ring-transparent group-hover:ring-green-500/20 transition-all" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold tracking-tight">SYNCO Intelligence</p>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Ativo Agora</p>
                                    </div>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setMessages(INITIAL_MESSAGES)}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Área de Mensagens */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-dots-pattern">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1 mr-3">
                                            <Bot className="w-4 h-4 text-primary" />
                                        </div>
                                    )}
                                    <div className={`max-w-[85%] group ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                                        <div className={`rounded-2xl px-5 py-3.5 text-sm shadow-sm ${
                                            msg.role === 'user'
                                                ? 'bg-primary text-white rounded-br-none font-medium'
                                                : 'bg-muted/80 backdrop-blur-sm border border-border/50 rounded-bl-none text-foreground'
                                        }`}>
                                            <div className="whitespace-pre-wrap leading-relaxed">
                                                {msg.content}
                                            </div>
                                        </div>
                                        {msg.role === 'assistant' && (
                                            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                                                <button 
                                                    onClick={() => copyMessage(msg.content)}
                                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted text-[10px] font-bold text-muted-foreground transition-colors border border-transparent hover:border-border"
                                                >
                                                    <Copy className="w-3 h-3" /> COPIAR
                                                </button>
                                                <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted text-[10px] font-bold text-muted-foreground transition-colors border border-transparent hover:border-border">
                                                    <ThumbsUp className="w-3 h-3" /> ÚTIL
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 mt-1 ml-3 text-[10px] font-black">
                                            EU
                                        </div>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start animate-in fade-in duration-300">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1 mr-3">
                                        <Bot className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="bg-muted/50 rounded-2xl rounded-bl-none px-6 py-4 border border-border/50 flex gap-1.5 items-center shadow-sm">
                                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-2 h-2 bg-primary/80 rounded-full animate-bounce" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de Mensagem */}
                        <div className="p-6 border-t bg-card/50 backdrop-blur-sm">
                            <div className="relative flex items-center">
                                <Input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                    placeholder="Escreva sua dúvida ou peça para criar uma oferta..."
                                    className="pr-24 py-7 rounded-2xl border-primary/20 focus-visible:ring-primary/20 shadow-inner bg-background/50 text-base"
                                    disabled={loading}
                                />
                                <div className="absolute right-2 flex items-center gap-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-10 w-10 text-muted-foreground hover:text-primary rounded-xl"
                                        disabled={loading}
                                    >
                                        <MessageSquare className="w-5 h-5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        className="h-11 w-11 bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl"
                                        onClick={() => sendMessage()}
                                        disabled={loading || !input.trim()}
                                    >
                                        <Send className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-60">SYNCO Intelligence Engine</p>
                                <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-60">Fase 3D Preview</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
