import crypto from 'crypto';

interface PreapprovalOptions {
  reason: string;
  external_reference: string;
  payer_email: string;
  transaction_amount: number;
  back_url: string;
  notification_url?: string;
}

export const mercadoPagoClient = {
  /**
   * Cria uma assinatura recorrente no Mercado Pago usando /preapproval
   */
  createSubscription: async (options: PreapprovalOptions) => {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not defined");

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        back_url: options.back_url,
        reason: options.reason,
        external_reference: options.external_reference,
        payer_email: options.payer_email,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          start_date: new Date().toISOString(),
          transaction_amount: options.transaction_amount,
          currency_id: "BRL"
        },
        status: "pending",
        notification_url: options.notification_url
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Erro ao criar preapproval:", err);
        throw new Error("Failed to create Mercado Pago preapproval");
    }

    return response.json();
  },

  /**
   * Consulta os detalhes de uma assinatura recorrente
   */
  getSubscription: async (preapprovalId: string) => {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not defined");

    const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
        throw new Error("Failed to fetch Mercado Pago subscription status");
    }

    return response.json();
  },

  /**
   * Pausa/Cancela uma assinatura recorrente
   */
  cancelSubscription: async (preapprovalId: string) => {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not defined");

    const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: "cancelled" })
    });

    if (!response.ok) {
        throw new Error("Failed to cancel Mercado Pago subscription");
    }

    return response.json();
  },

  /**
   * Retorna os detalhes de um Pagamento
   */
  getPayment: async (paymentId: string) => {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not defined");

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
        throw new Error("Failed to fetch Mercado Pago payment");
    }

    return response.json();
  },

  /**
   * Valida a assinatura de um Webhook Oficial do Mercado Pago
   */
  validateWebhookSignature: (
    xSignature: string | null,
    xRequestId: string | null,
    dataId: string | null
  ): boolean => {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("MERCADO_PAGO_WEBHOOK_SECRET não configurado. Paginando webhook como inválido e bloqueando requisição.");
        return false;
    }
    
    if (!xSignature || !xRequestId || !dataId) return false;

    try {
        // xSignature = "ts=TIMESTAMP,v1=HASH"
        const parts = xSignature.split(',');
        let ts = '';
        let v1 = '';

        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (key === 'ts') ts = value;
            if (key === 'v1') v1 = value;
        });

        if (!ts || !v1) return false;

        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(manifest);
        const digest = hmac.digest('hex');

        // Proteção contra ataques de tempo (timing attacks)
        if (digest.length !== v1.length) {
            return false;
        }

        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(v1));
    } catch(err) {
        console.error("Erro validando webhook HMAC:", err);
        return false;
    }
  }
};
