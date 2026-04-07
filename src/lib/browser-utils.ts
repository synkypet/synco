/**
 * BrowserUtils — Guardas de SSR e Browser (Fase 2A)
 * 
 * Protege o acesso a APIs globais do navegador (window, document, localStorage)
 * para evitar erros de hidratação e quebras durante a renderização no servidor.
 */

export const browser = {
    /** Verifica se o código está sendo executado no lado do cliente. */
    get isClient(): boolean {
        return typeof window !== 'undefined';
    },

    /** Acessa o localStorage de forma segura (retorna null no servidor). */
    getStorage(key: string): string | null {
        if (!this.isClient) return null;
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },

    /** Define um item no localStorage de forma segura. */
    setStorage(key: string, value: string): void {
        if (!this.isClient) return;
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            console.error('Erro ao acessar localStorage:', e);
        }
    },

    /** Remove um item no localStorage de forma segura. */
    removeStorage(key: string): void {
        if (!this.isClient) return;
        try {
            window.localStorage.removeItem(key);
        } catch (e) {
            console.error('Erro ao acessar localStorage:', e);
        }
    },

    /** Executa um callback apenas se estiver no navegador. */
    run(callback: () => void): void {
        if (this.isClient) callback();
    }
};
