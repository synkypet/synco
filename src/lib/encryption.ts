import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// A chave mestre precisa ter exatamente 32 bytes (256 bits).
// Você verá avisos se process.env.SYNCO_MASTER_KEY estiver inválida ou vazia.
const RAW_MASTER_KEY = process.env.SYNCO_MASTER_KEY || '';

// A chave mestre precisa ter exatamente 32 bytes (256 bits).
// Suportamos 32 caracteres raw ou 64 caracteres hexadecimais.
let MASTER_KEY: Buffer;

try {
  if (RAW_MASTER_KEY.length === 64) {
    MASTER_KEY = Buffer.from(RAW_MASTER_KEY, 'hex');
  } else {
    MASTER_KEY = Buffer.from(RAW_MASTER_KEY, 'utf8');
  }
} catch (e) {
  MASTER_KEY = Buffer.alloc(0);
}

export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
}

export function encrypt(text: string): EncryptedData {
  if (!MASTER_KEY || MASTER_KEY.length !== 32) {
    throw new Error('SYNCO_MASTER_KEY precisa ter exatos 32 bytes (32 caracteres ou 64 hex). Verifique o .env');
  }

  const iv = crypto.randomBytes(16); // IV para GCM normalmente é de 12 bytes mas 16 suporta padronização
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedValue: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag
  };
}

export function decrypt(encryptedData: EncryptedData): string {
  if (!MASTER_KEY || MASTER_KEY.length !== 32) {
    throw new Error('SYNCO_MASTER_KEY precisa ter exatos 32 bytes (32 caracteres ou 64 hex). Verifique o .env');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    MASTER_KEY, 
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encryptedValue, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
