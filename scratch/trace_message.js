const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function traceMessage(messageId) {
    console.log(`Tracing Message ID: ${messageId}`);

    // 1. Check Dedupe
    const { data: dedupe, error: dedupeError } = await supabase
        .from('automation_dedupe')
        .select('*')
        .eq('message_id', messageId);
    
    if (dedupeError) console.error('Dedupe Error:', dedupeError);
    else console.log('--- Deduplication ---\n', dedupe);

    // 2. Check Automation Events
    const { data: events, error: eventsError } = await supabase
        .from('automation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
    
    if (eventsError) {
        console.error('Events Error:', eventsError);
    } else if (events) {
        const relevantEvents = events.filter(e => JSON.stringify(e.details || {}).includes(messageId));
        console.log('--- Automation Events ---\n', relevantEvents);

        if (relevantEvents.length > 0) {
            const jobEvent = relevantEvents.find(e => e.event_type === 'job_created');
            if (jobEvent && jobEvent.details?.campaignId) {
                const campaignId = jobEvent.details.campaignId;
                console.log(`\nFound Campaign ID: ${campaignId}`);

                const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
                console.log('--- Campaign ---\n', campaign);

                const { data: jobs } = await supabase.from('send_jobs').select('*').eq('campaign_id', campaignId);
                console.log('--- Send Jobs ---\n', jobs);
            }
        }
    }

    // 3. Fallback: Search for recent send_jobs that might match this message
    // User said destination was 76b9e2f9-277d-4747-b4cb-9e67ecdaf26c
    console.log('\n--- Searching Recent Jobs for Target Destination ---');
    const { data: recentJobs } = await supabase
        .from('send_jobs')
        .select('*')
        .eq('destination', '120363407334133457@g.us') // Target ID from user's earlier logs
        .order('created_at', { ascending: false })
        .limit(3);
    console.log(recentJobs);
}

const targetMsgId = '3EB09C9FC20310B69FC87F';
traceMessage(targetMsgId);
