
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSources() {
    const { data, error } = await supabase
        .from('automation_sources')
        .select('*')
        .eq('source_type', 'radar_offers')
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} Radar sources:`);
    data.forEach(s => {
        console.log(`- ID: ${s.id} | Name: ${s.name}`);
        console.log(`  Config: ${JSON.stringify(s.config)}`);
    });
}

checkSources();
