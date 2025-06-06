import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import axios from 'axios';

// Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Gmail OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URL
);

// Set credentials from environment
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// BigQuery setup
const bigquery = new BigQuery({
  projectId: 'gcpxbixpflegehilfesenioren',
  credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS!),
});

// Aircall setup
const AIRCALL_API_KEY = process.env.AIRCALL_API_KEY;
const AIRCALL_AUTH = Buffer.from(`${AIRCALL_API_KEY}:`).toString('base64');

// Team email addresses
const TEAM_EMAILS = [
  'pflegeteam.heer@pflegehilfe-senioren.de',
  'ines.cuerten@pflegehilfe-senioren.de',
  'lisa.bayer@pflegehilfe-senioren.de'
];

export const handler: Handler = async (event, context) => {
  console.log('Starting activity sync...');
  
  try {
    const results = await Promise.allSettled([
      syncGmailActivities(),
      syncBigQueryActivities(),
      syncAircallActivities(),
    ]);

    // Update sync status
    for (let i = 0; i < results.length; i++) {
      const sources = ['gmail', 'bigquery', 'aircall'];
      const result = results[i];
      
      await supabase
        .from('sync_status')
        .update({
          last_sync_timestamp: new Date().toISOString(),
          last_successful_sync: result.status === 'fulfilled' ? new Date().toISOString() : undefined,
          sync_status: result.status === 'fulfilled' ? 'success' : 'error',
          error_message: result.status === 'rejected' ? result.reason?.message : null,
        })
        .eq('source_system', sources[i]);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Sync completed',
        results: results.map(r => r.status),
      }),
    };
  } catch (error: any) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function syncGmailActivities() {
  console.log('Syncing Gmail activities...');
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  for (const email of TEAM_EMAILS) {
    // Get sent emails
    const sentQuery = `from:${email} after:${thirtyDaysAgo.toISOString().split('T')[0]}`;
    const sentResponse = await gmail.users.messages.list({
      userId: 'me',
      q: sentQuery,
      maxResults: 100,
    });

    if (sentResponse.data.messages) {
      for (const message of sentResponse.data.messages) {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
        });

        const headers = fullMessage.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        // Extract preview text
        let preview = '';
        if (fullMessage.data.snippet) {
          preview = fullMessage.data.snippet.substring(0, 200);
        }

        await supabase.from('activities').upsert({
          source_system: 'gmail',
          source_id: `gmail_${message.id}`,
          activity_type: 'email',
          direction: 'outbound',
          timestamp: new Date(date).toISOString(),
          subject,
          preview,
          user_email: email,
          contact_email: to,
          raw_data: { headers, snippet: fullMessage.data.snippet },
        }, {
          onConflict: 'source_system,source_id',
        });
      }
    }
  }
}

async function syncBigQueryActivities() {
  console.log('Syncing BigQuery activities...');
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Query for tickets from Pflegeteam Heer
  const query = `
    WITH ticket_data AS (
      SELECT 
        t._id AS ticket_id,
        t.subject,
        t.messages,
        t.created_at AS ticket_created_at,
        t.ticketable_id,
        t.ticketable_type,
        tc.seller AS ticket_seller
      FROM \`gcpxbixpflegehilfesenioren.PflegehilfeSeniore_BI.tickets\` t
      LEFT JOIN \`gcpxbixpflegehilfesenioren.dataform_staging.tickets_creation_end\` tc
        ON t._id = tc.Ticket_ID
      WHERE tc.seller = 'Pflegeteam Heer'
        AND t.created_at >= TIMESTAMP('${thirtyDaysAgo.toISOString()}')
    )
    SELECT * FROM ticket_data
    ORDER BY ticket_created_at DESC
    LIMIT 1000
  `;

  const [rows] = await bigquery.query({ query });

  for (const row of rows) {
    // Parse messages to get preview
    let preview = '';
    try {
      const messages = JSON.parse(row.messages || '[]');
      if (messages.length > 0) {
        preview = messages[0].body?.substring(0, 200) || '';
      }
    } catch (e) {
      preview = row.subject || '';
    }

    await supabase.from('activities').upsert({
      source_system: 'bigquery',
      source_id: `bigquery_${row.ticket_id}`,
      activity_type: 'ticket',
      direction: 'outbound',
      timestamp: row.ticket_created_at,
      subject: row.subject,
      preview,
      user_name: row.ticket_seller,
      raw_data: row,
    }, {
      onConflict: 'source_system,source_id',
    });
  }
}

async function syncAircallActivities() {
  console.log('Syncing Aircall activities...');
  
  const thirtyDaysAgo = Math.floor(new Date().getTime() / 1000) - (30 * 24 * 60 * 60);
  
  const response = await axios.get('https://api.aircall.io/v1/calls/search', {
    headers: {
      'Authorization': `Basic ${AIRCALL_AUTH}`,
    },
    params: {
      per_page: 100,
      order: 'desc',
      from: thirtyDaysAgo,
      fetch_contact: 'true',
    },
  });

  const calls = response.data.calls || [];
  
  for (const call of calls) {
    const contactName = call.contact ? 
      `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim() : 
      null;
    
    await supabase.from('activities').upsert({
      source_system: 'aircall',
      source_id: `aircall_${call.id}`,
      activity_type: 'call',
      direction: call.direction,
      timestamp: new Date(call.started_at * 1000).toISOString(),
      duration_seconds: call.duration,
      contact_name: contactName,
      contact_phone: call.raw_digits,
      user_name: call.user?.name,
      user_email: call.user?.email,
      raw_data: call,
    }, {
      onConflict: 'source_system,source_id',
    });
  }
}