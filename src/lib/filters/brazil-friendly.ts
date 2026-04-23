/**
 * Brazil-Friendly Filter Logic
 * Thresholds:
 * - accept >= 60
 * - review = 35–59
 * - reject < 35
 * Veto: CJK (Chinese, Japanese, Korean) characters.
 */

export interface BrazilFriendlyResult {
  decision: 'accept' | 'review' | 'reject';
  score: number;
  reasons: string[];
}

export function isBrazilFriendlyProduct(product: { name: string }): BrazilFriendlyResult {
  const name = product.name || '';
  const reasons: string[] = [];
  let score = 60; // Base score elevado: item limpo passa por padrão (accept >= 60)

  // 1. Veto CJK (Chinese, Japanese, Korean characters)
  const cjkRegex = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/;
  if (cjkRegex.test(name)) {
    return {
      decision: 'reject',
      score: 0,
      reasons: ['Contém caracteres asiáticos (CJK Veto)']
    };
  }

  // 2. Positive signals (+ points)
  const positiveKeywords = [
    { word: 'original', points: 10 },
    { word: 'brasil', points: 10 },
    { word: 'pronta entrega', points: 15 },
    { word: 'garantia', points: 5 },
    { word: 'envio imediato', points: 10 },
    { word: 'oficial', points: 5 },
    { word: 'nacional', points: 10 }
  ];

  positiveKeywords.forEach(k => {
    if (name.toLowerCase().includes(k.word)) {
      score += k.points;
      reasons.push(`Sinal positivo: ${k.word}`);
    }
  });

  // 3. Negative signals (- points)
  const negativeKeywords = [
    { word: 'china', points: -25 },
    { word: 'importado', points: -15 },
    { word: 'réplica', points: -40 },
    { word: 'primeira linha', points: -20 },
    { word: 'venda quente', points: -25 }, 
    { word: 'estilo coreano', points: -15 },
    { word: 'overseas', points: -25 },
    { word: 'ready stock', points: -20 },
    { word: 'ship from', points: -25 },
    { word: 'delivery within', points: -15 }
  ];

  negativeKeywords.forEach(k => {
    if (name.toLowerCase().includes(k.word)) {
      score += k.points;
      reasons.push(`Sinal negativo: ${k.word}`);
    }
  });

  // 4. Structural signals
  if (name.length < 12) {
    score -= 15;
    reasons.push('Título extremamente curto/vago');
  }

  if (name === name.toUpperCase() && name.length > 40) {
    score -= 5;
    reasons.push('Título longo todo em maiúsculas');
  }

  // 5. Special characters cleanup signal
  const specialChars = /[\[\]\(\)\-\|\_\/\*]/g;
  const count = (name.match(specialChars) || []).length;
  if (count > 8) {
    score -= 5;
    reasons.push('Excesso de caracteres decorativos');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Decision
  let decision: 'accept' | 'review' | 'reject';
  if (score >= 60) decision = 'accept';
  else if (score >= 35) decision = 'review';
  else decision = 'reject';

  return { decision, score, reasons };
}
