require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { BigQuery } = require('@google-cloud/bigquery');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware with explicit CORS configuration
app.use(cors({
  origin: [
    'https://zeiterfassung-system.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: 'gcpxbixpflegehilfesenioren',
  credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}')
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Sync backend is running' });
});

// Main sync endpoint
app.post('/sync', async (req, res) => {
  console.log('Starting sync process...');
  
  const results = {
    bigquery: { success: false, count: 0, message: '' },
    aircall: { success: false, count: 0, message: '' },
    gmail: { success: false, count: 0, message: '' }
  };

  try {
    // Run all syncs in parallel
    const [bigqueryResult, aircallResult, gmailResult] = await Promise.allSettled([
      syncBigQueryTickets(),
      syncAircallCalls(),
      syncGmailEmails()
    ]);

    if (bigqueryResult.status === 'fulfilled') {
      results.bigquery = bigqueryResult.value;
    } else {
      results.bigquery = { 
        success: false, 
        count: 0, 
        message: bigqueryResult.reason?.message || 'BigQuery sync failed' 
      };
    }

    if (aircallResult.status === 'fulfilled') {
      results.aircall = aircallResult.value;
    } else {
      results.aircall = { 
        success: false, 
        count: 0, 
        message: aircallResult.reason?.message || 'Aircall sync failed' 
      };
    }

    if (gmailResult.status === 'fulfilled') {
      results.gmail = gmailResult.value;
    } else {
      results.gmail = { 
        success: false, 
        count: 0, 
        message: gmailResult.reason?.message || 'Gmail sync failed' 
      };
    }

    const totalCount = results.bigquery.count + results.aircall.count + results.gmail.count;
    
    res.json({
      success: true,
      message: `Sync completed: ${totalCount} activities`,
      details: results
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      details: results
    });
  }
});

// BigQuery sync function - FIXED for STRING type created_at
async function syncBigQueryTickets() {
  console.log('Syncing BigQuery tickets...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoString = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Fixed query - using STRING comparison since created_at is STRING in your BigQuery
    const query = `
      WITH ticket_data AS (
        SELECT 
          t._id AS ticket_id,
          t.subject,
          t.messages,
          t.created_at AS ticket_created_at,
          tc.seller AS ticket_seller
        FROM \`gcpxbixpflegehilfesenioren.PflegehilfeSeniore_BI.tickets\` t
        LEFT JOIN \`gcpxbixpflegehilfesenioren.dataform_staging.tickets_creation_end\` tc
          ON t._id = tc.Ticket_ID
        WHERE tc.seller = 'Pflegeteam Heer'
          AND t.created_at >= '${thirtyDaysAgoString}'
      )
      SELECT * FROM ticket_data
      ORDER BY ticket_created_at DESC
      LIMIT 500
    `;

    const [rows] = await bigquery.query({ query });
    
    let syncedCount = 0;
    
    for (const row of rows) {
      let preview = '';
      try {
        const messages = JSON.parse(row.messages || '[]');
        if (messages.length > 0) {
          preview = messages[0].body?.substring(0, 200) || '';
        }
      } catch (e) {
        preview = row.subject || '';
      }

      // Convert string timestamp to ISO format
      let timestamp;
      try {
        // Handle various date formats
        timestamp = new Date(row.ticket_created_at).toISOString();
      } catch (e) {
        // If parsing fails, use current time
        timestamp = new Date().toISOString();
        console.warn('Could not parse timestamp:', row.ticket_created_at);
      }

      const { error } = await supabase.from('activities').upsert({
        source_system: 'bigquery',
        source_id: `bigquery_${row.ticket_id}`,
        activity_type: 'ticket',
        direction: 'outbound',
        timestamp: timestamp,
        subject: row.subject,
        preview,
        user_name: row.ticket_seller,
        raw_data: row,
      }, {
        onConflict: 'source_system,source_id',
      });
      
      if (!error) {
        syncedCount++;
      } else {
        console.error('Error inserting activity:', error);
      }
    }

    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        last_successful_sync: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .eq('source_system', 'bigquery');

    return { success: true, count: syncedCount, message: `${syncedCount} tickets synced` };
  } catch (error) {
    console.error('BigQuery sync error:', error);
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        sync_status: 'error',
        error_message: error.message,
      })
      .eq('source_system', 'bigquery');
    
    throw error;
  }
}

// Aircall sync function - with better error handling
async function syncAircallCalls() {
  console.log('Syncing Aircall calls...');
  
  try {
    // Check if API key is configured
    if (!process.env.AIRCALL_API_KEY) {
      console.log('Aircall API Key not configured');
      return { 
        success: false, 
        count: 0, 
        message: 'Aircall API Key not configured in environment variables' 
      };
    }
    
    console.log('Aircall API Key present:', process.env.AIRCALL_API_KEY.substring(0, 10) + '...');
    
    const thirtyDaysAgo = Math.floor(new Date().getTime() / 1000) - (30 * 24 * 60 * 60);
    
    // Aircall uses API ID and API Token for authentication
    // The API Key should be in format "api_id:api_token"
    const [apiId, apiToken] = process.env.AIRCALL_API_KEY.includes(':') 
      ? process.env.AIRCALL_API_KEY.split(':')
      : [process.env.AIRCALL_API_KEY, ''];
    
    console.log('Using Aircall API ID:', apiId);
    console.log('API Token length:', apiToken.length);
    console.log('Full auth string length:', process.env.AIRCALL_API_KEY.length);
    
    // Try also with direct auth object syntax
    const response = await axios.get('https://api.aircall.io/v1/calls', {
      auth: {
        username: apiId,
        password: apiToken
      },
      params: {
        per_page: 50,
        order: 'desc'
      },
      timeout: 10000, // 10 second timeout
      validateStatus: function (status) {
        return status < 500; // Don't throw on 4xx errors
      }
    });

    // Check if we got a 403 or other error
    if (response.status === 403) {
      console.error('Aircall API returned 403 Forbidden');
      return { 
        success: false, 
        count: 0, 
        message: 'Aircall API Key ist ungültig oder hat keine Berechtigung. Bitte prüfen Sie den API Key.' 
      };
    }
    
    if (response.status !== 200) {
      console.error('Aircall API returned status:', response.status);
      return { 
        success: false, 
        count: 0, 
        message: `Aircall API Fehler: ${response.status} ${response.statusText}` 
      };
    }

    const calls = response.data.calls || [];
    let syncedCount = 0;
    
    for (const call of calls) {
      // Only sync calls from last 30 days
      if (call.started_at < thirtyDaysAgo) continue;
      
      const contactName = call.contact ? 
        `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim() : 
        null;
      
      const { error } = await supabase.from('activities').upsert({
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
      
      if (!error) {
        syncedCount++;
      } else {
        console.error('Error inserting call:', error);
      }
    }

    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        last_successful_sync: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .eq('source_system', 'aircall');

    return { success: true, count: syncedCount, message: `${syncedCount} calls synced` };
  } catch (error) {
    console.error('Aircall sync error:', error.response?.data || error.message);
    
    // If 403 Forbidden, the API key might be invalid
    if (error.response?.status === 403) {
      console.error('Aircall API Key seems to be invalid or lacks permissions');
    }
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        sync_status: 'error',
        error_message: error.response?.data?.message || error.message,
      })
      .eq('source_system', 'aircall');
    
    // Don't throw, just return error
    return { 
      success: false, 
      count: 0, 
      message: `Aircall error: ${error.response?.data?.message || error.message}` 
    };
  }
}

// Gmail sync function (requires OAuth setup)
async function syncGmailEmails() {
  console.log('Syncing Gmail emails...');
  
  try {
    // OAuth not yet implemented - return 0 activities
    // In production, implement proper OAuth2 flow here
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        last_successful_sync: new Date().toISOString(),
        sync_status: 'success',
        error_message: 'OAuth not configured - no data synced',
      })
      .eq('source_system', 'gmail');

    return { success: true, count: 0, message: 'Gmail OAuth not configured' };
  } catch (error) {
    console.error('Gmail sync error:', error);
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        sync_status: 'error',
        error_message: error.message,
      })
      .eq('source_system', 'gmail');
    
    return { 
      success: false, 
      count: 0, 
      message: `Gmail error: ${error.message}` 
    };
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Sync backend running on port ${PORT}`);
  console.log('Environment check:');
  console.log('- Supabase URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
  console.log('- Supabase Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  console.log('- BigQuery Credentials:', process.env.BIGQUERY_CREDENTIALS ? 'Set' : 'Missing');
  console.log('- Aircall API Key:', process.env.AIRCALL_API_KEY ? 'Set' : 'Missing');
});