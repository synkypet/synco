const { createAdminClient } = require('./src/lib/supabase/admin');

async function getRecentUser() {
  try {
    const supabase = createAdminClient();
    // Como não podemos listar auth.users diretamente pelo client comum sem admin SDK completo,
    // vamos tentar pegar de alguma tabela de negócio que tenha user_id, como 'channels' ou 'campaigns'.
    const { data, error } = await supabase
      .from('channels')
      .select('user_id')
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      console.log('USER_ID_FOUND:' + data[0].user_id);
    } else {
      console.log('NO_USER_FOUND');
    }
  } catch (e) {
    console.error(e);
  }
}

getRecentUser();
