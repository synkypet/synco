// src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { KineticButton } from '@/components/ui/KineticButton';
import { TactileCard } from '@/components/ui/TactileCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, KeyRound, Mail, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' 
          ? 'Credenciais inválidas. Verifique seu e-mail e senha.' 
          : authError.message);
        return;
      }

      await supabase.auth.getSession();
      router.refresh();
      router.push('/');
    } catch (err) {
      setError('Ocorreu um erro inesperado ao fazer login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TactileCard className="w-full max-w-md p-6 md:p-10 relative border-none shadow-skeuo-elevated group mx-auto">
      {/* Animated Glow on Card Top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-kinetic-orange/40 to-transparent blur-sm rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-deep-void shadow-skeuo-pressed flex items-center justify-center mb-6 relative group/icon overflow-hidden">
          <div className="absolute inset-0 bg-kinetic-orange/10 opacity-0 group-hover/icon:opacity-100 transition-opacity duration-300" />
          <Zap className="w-8 h-8 text-kinetic-orange shadow-glow-orange-intense relative z-10" />
        </div>
        
        <h1 className="text-4xl font-black font-headline tracking-tighter text-white mb-2 italic">
          SYNCO
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
          Affiliate Command Center
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border-none shadow-skeuo-pressed flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs font-bold text-red-400 leading-relaxed uppercase tracking-tight">{error}</p>
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">E-mail Operacional</Label>
            <div className="relative group/input">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within/input:text-kinetic-orange transition-colors duration-300" />
              <Input
                id="email"
                type="email"
                placeholder="sessao@transmissao.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 bg-deep-void shadow-skeuo-pressed border-none text-sm font-bold text-white/80 pl-12 placeholder:text-white/5 rounded-2xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/40 transition-all duration-300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-white/30">Chave de Acesso</Label>
              <Link 
                href="/recuperar-senha" 
                className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-kinetic-orange transition-colors duration-300"
              >
                Esqueci
              </Link>
            </div>
            <div className="relative group/input">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within/input:text-kinetic-orange transition-colors duration-300" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-14 bg-deep-void shadow-skeuo-pressed border-none text-sm font-bold text-white/80 pl-12 placeholder:text-white/5 rounded-2xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/40 transition-all duration-300"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-4">
          <KineticButton 
            type="submit" 
            className="w-full h-14 font-black uppercase tracking-widest text-sm shadow-glow-orange-intense"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : 'Iniciar Sessão'}
          </KineticButton>

          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-tight text-white/20 italic">
              Ainda não possui credenciais?{' '}
              <Link href="/cadastro" className="text-kinetic-orange hover:text-kinetic-orange/70 font-black transition-colors ml-1 uppercase">
                Criar Conta
              </Link>
            </p>
          </div>
        </div>
      </form>

      {/* System Footer Info */}
      <div className="mt-10 text-center opacity-10 flex flex-col items-center gap-1 group-hover:opacity-30 transition-opacity duration-700">
        <div className="w-8 h-px bg-white/50 mb-2" />
        <p className="text-[8px] font-black uppercase tracking-[0.4em]">Secure Command Link</p>
        <p className="text-[8px] font-bold uppercase tracking-widest">v0.5.0-kinetic</p>
      </div>
    </TactileCard>
  );
}
