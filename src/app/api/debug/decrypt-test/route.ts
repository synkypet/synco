import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';

const TARGET_USER_ID = '59cd0337-2f39-43ce-a596-cd068a1df7f6';
const TARGET_MARKETPLACE_ID = '5f051275-f36b-48a0-a526-ae1c8d0fc6ac';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: secretRow, error: fetchError } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('*')
      .eq('user_id', TARGET_USER_ID)
      .eq('marketplace_id', TARGET_MARKETPLACE_ID)
      .single();

    if (fetchError || !secretRow) {
      return NextResponse.json({ 
        success: false, 
        error: 'Secret not found in database',
        details: fetchError?.message 
      });
    }

    try {
      const decrypted = decrypt({
        encryptedValue: secretRow.encrypted_secret,
        iv: secretRow.iv,
        authTag: secretRow.auth_tag
      });

      const isSampleValid = decrypted && decrypted.length > 5;

      return NextResponse.json({ 
        success: true, 
        message: 'Decryption successful',
        is_valid_sample: isSampleValid
      });
    } catch (decryptErr: any) {
      return NextResponse.json({ 
        success: false, 
        error: 'Decryption failed', 
        message: decryptErr.message 
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Internal Error', message: err.message });
  }
}
