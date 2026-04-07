import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // 1. Atualizar a sessão (necessário para refresh tokens e recuperar usuário)
  const { supabaseResponse, user } = await updateSession(request);

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Listas de rotas
  const publicRoutes = ['/login', '/cadastro', '/recuperar-senha'];
  const protectedRoutes = [
    '/',
    '/grupos',
    '/marketplaces',
    '/listas-destino',
    '/canais',
    '/radar-ofertas',
    '/carrinho-ofertas',
    '/envio-rapido',
    '/monitoramento',
    '/campanhas',
    '/automacoes',
    '/relatorios',
    '/ganhos',
    '/configuracoes',
    '/assistente-ia',
  ];

  const isPublicRoute = publicRoutes.includes(pathname);
  const isProtectedRoute = protectedRoutes.includes(pathname) || protectedRoutes.some(route => route !== '/' && pathname.startsWith(route));

  // Redirecionamento 1: Se não estiver logado e tentar acessar rota protegida
  if (!user && isProtectedRoute) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirecionamento 2: Se estiver logado e tentar acessar rota pública (login/cadastro)
  if (user && isPublicRoute) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
