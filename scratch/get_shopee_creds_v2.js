
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTER_KEY_RAW = process.env.SYNCO_MASTER_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

function decrypt(encryptedData) {
  const ALGORITHM = 'aes-256-gcm';
  let MASTER_KEY;
  if (MASTER_KEY_RAW.length === 64) {
    MASTER_KEY = Buffer.from(MASTER_KEY_RAW, 'hex');
  } else {
    MASTER_KEY = Buffer.from(MASTER_KEY_RAW, 'utf8');
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

async function getCredentials() {
  const userId = '09309082-83f3-45f9-b5b6-1752f95313ac';
  const marketplaceId = '5f051275-f36b-48a0-a526-ae1c8d0fc6ac';

  const { data: conn } = await supabase
    .from('user_marketplaces')
    .select('shopee_app_id')
    .eq('user_id', userId)
    .eq('marketplace_id', marketplaceId)
    .limit(1)
    .single();

  const { data: secretRow } = await supabase
    .from('user_marketplace_secrets')
    .select('*')
    .eq('user_id', userId)
    .eq('marketplace_id', marketplaceId)
    .single();

  if (conn && secretRow) {
    const appId = conn.shopee_app_id;
    const secret = decrypt({
      encryptedValue: secretRow.encrypted_secret,
      iv: secretRow.iv,
      authTag: secretRow.auth_tag
    });
    console.log('APP_ID:' + appId);
    console.log('SECRET:' + secret);
  } else {
    console.log('CREDENTIALS_NOT_FOUND');
    console.log('Conn:', conn);
    console.log('SecretRow:', secretRow);
  }
}

getCredentials();
