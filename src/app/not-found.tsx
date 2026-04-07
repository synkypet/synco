import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="text-6xl font-bold text-muted-foreground/20">404</div>
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          A página que você tentou acessar não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
