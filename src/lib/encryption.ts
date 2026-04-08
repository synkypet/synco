import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// A chave mestre precisa ter exatamente 32 bytes (256 bits).
// Você verá avisos se process.env.SYNCO_MASTER_KEY estiver inválida ou vazia.
const MASTER_KEY = process.env.SYNCO_MASTER_KEY || '';

export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
}

export function encrypt(text: string): EncryptedData {
  if (!MASTER_KEY || MASTER_KEY.length !== 32) {
    throw new Error('SYNCO_MASTER_KEY precisa ter exatos 32 caracteres gerados no .env');
  }

  const iv = crypto.randomBytes(16); // IV para GCM normalmente é de 12 bytes mas 16 suporta padronização
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(MASTER_KEY), iv);
  
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
    throw new Error('SYNCO_MASTER_KEY precisa ter exatos 32 caracteres gerados no .env');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    Buffer.from(MASTER_KEY), 
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encryptedValue, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
