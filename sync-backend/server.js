require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { BigQuery } = require('@google-cloud/bigquery');
const axios = require('axios');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const crypto = require('crypto');

// Set default timezone to Europe/Berlin
moment.tz.setDefault('Europe/Berlin');

// Helper function to convert timestamps to UTC ISO format
// The frontend will handle conversion to Berlin timezone for display
function convertToUTC(timestamp, source = 'unix') {
  let utcTime;
  
  switch(source) {
    case 'unix':
      // Unix timestamp (seconds since epoch) - already in UTC
      utcTime = moment.unix(timestamp).utc();
      break;
    case 'iso':
      // ISO string - parse and ensure UTC
      utcTime = moment.utc(timestamp);
      break;
    case 'string':
      // Generic string format - parse as UTC
      utcTime = moment.utc(timestamp);
      break;
    default:
      utcTime = moment.utc(timestamp);
  }
  
  return utcTime.toISOString();
}

// Helper function to log timestamp conversions for debugging
function logTimestampConversion(source, originalTimestamp, convertedTimestamp) {
  const utcMoment = moment.utc(convertedTimestamp);
  const berlinMoment = utcMoment.clone().tz('Europe/Berlin');
  
  console.log(`${source} timestamp conversion:`);
  console.log(`  - Original: ${originalTimestamp}`);
  console.log(`  - UTC (stored): ${utcMoment.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`  - Berlin (display): ${berlinMoment.format('YYYY-MM-DD HH:mm:ss')}`);
}

// Log timezone information on startup
console.log('Server timezone configuration:');
console.log('- Server timezone:', moment.tz.guess());
console.log('- Storage format: UTC (ISO 8601)');
console.log('- Display timezone: Europe/Berlin (handled by frontend)');
console.log('- Current UTC time:', moment.utc().format('YYYY-MM-DD HH:mm:ss'));
console.log('- Current Berlin time:', moment.tz('Europe/Berlin').format('YYYY-MM-DD HH:mm:ss z'));

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

// Initialize Gmail OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI || 'https://zeiterfassung-sync-backend.onrender.com/auth/gmail/callback'
);

// Set credentials if we have a refresh token stored
if (process.env.GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Sync backend is running' });
});

// Gmail OAuth2 endpoints
app.get('/auth/gmail', (req, res) => {
  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in session or as environment variable temporarily
  // In production, use proper session management
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.metadata'
    ],
    state: state,
    prompt: 'consent' // Force consent to get refresh token
  });
  
  res.redirect(authUrl);
});

app.get('/auth/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }
  
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store refresh token
    if (tokens.refresh_token) {
      console.log('Received refresh token, please add to environment variables:');
      console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
      
      // In production, store this securely
      process.env.GMAIL_REFRESH_TOKEN = tokens.refresh_token;
    }
    
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #28a745;">✅ Gmail Authorization Successful!</h1>
          <p>Die Gmail-Verbindung wurde erfolgreich hergestellt.</p>
          <p>Der Refresh Token wurde in der Konsole ausgegeben.</p>
          <p>Bitte fügen Sie ihn zu den Umgebungsvariablen in Render.com hinzu.</p>
          <p style="margin-top: 30px;">
            <a href="https://zeiterfassung-system.netlify.app/admin/activity-log" 
               style="background: #4299e1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Zurück zum Activity Log
            </a>
          </p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).send('Authorization failed: ' + error.message);
  }
});

// Debug endpoint to check recent activities and their timestamps
app.get('/debug/activities', async (req, res) => {
  try {
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    const debugInfo = activities.map(activity => {
      const utcTime = moment.utc(activity.timestamp);
      const berlinTime = utcTime.clone().tz('Europe/Berlin');
      
      return {
        id: activity.id,
        source: activity.source_system,
        type: activity.activity_type,
        stored_timestamp: activity.timestamp,
        utc_time: utcTime.format('YYYY-MM-DD HH:mm:ss'),
        berlin_time: berlinTime.format('YYYY-MM-DD HH:mm:ss z'),
        timezone_offset: berlinTime.format('Z'),
        is_dst: berlinTime.isDST() ? 'Yes (CEST)' : 'No (CET)'
      };
    });
    
    res.json({
      current_time: {
        utc: moment.utc().format('YYYY-MM-DD HH:mm:ss'),
        berlin: moment.tz('Europe/Berlin').format('YYYY-MM-DD HH:mm:ss z')
      },
      activities: debugInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

      // Convert string timestamp to ISO format with proper timezone handling
      let timestamp;
      try {
        // Parse the timestamp - BigQuery timestamps might be in various formats
        // Store as UTC, frontend will convert to Berlin time for display
        timestamp = convertToUTC(row.ticket_created_at, 'string');
        logTimestampConversion('BigQuery', row.ticket_created_at, timestamp);
      } catch (e) {
        // If parsing fails, use current time in Berlin timezone
        timestamp = moment.tz('Europe/Berlin').toISOString();
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
        last_sync_timestamp: moment.tz('Europe/Berlin').toISOString(),
        last_successful_sync: moment.tz('Europe/Berlin').toISOString(),
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
        last_sync_timestamp: moment.tz('Europe/Berlin').toISOString(),
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
    
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    console.log(`Fetching Aircall calls from last 30 days (since Unix timestamp: ${thirtyDaysAgo})`);
    
    // Aircall uses API ID and API Token for authentication
    // The API Key should be in format "api_id:api_token"
    const [apiId, apiToken] = process.env.AIRCALL_API_KEY.includes(':') 
      ? process.env.AIRCALL_API_KEY.split(':')
      : [process.env.AIRCALL_API_KEY, ''];
    
    console.log('Using Aircall API ID:', apiId);
    console.log('API Token length:', apiToken.length);
    console.log('Full auth string length:', process.env.AIRCALL_API_KEY.length);
    
    // Aircall has a max of 50 per page, so we need to paginate
    let allCalls = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    console.log('Fetching Aircall calls with pagination...');
    
    while (hasMorePages && allCalls.length < 500) { // Limit to 500 calls for safety
      const response = await axios.get('https://api.aircall.io/v1/calls', {
        auth: {
          username: apiId,
          password: apiToken
        },
        params: {
          per_page: 50,  // Aircall max is 50
          page: currentPage,
          order: 'desc',
          from: thirtyDaysAgo  // Only get calls from last 30 days
        },
        timeout: 30000, // 30 second timeout
        validateStatus: function (status) {
          return status < 500; // Don't throw on 4xx errors
        }
      });
      
      if (response.status !== 200) {
        console.error('Aircall API returned status:', response.status);
        break;
      }
      
      const pageCalls = response.data.calls || [];
      allCalls = allCalls.concat(pageCalls);
      
      console.log(`Fetched page ${currentPage} with ${pageCalls.length} calls (total: ${allCalls.length})`);
      
      // Check if there are more pages
      hasMorePages = pageCalls.length === 50;
      currentPage++;
      
      // Small delay to avoid rate limiting
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const calls = allCalls;
    let syncedCount = 0;
    let skippedCount = 0;
    
    // Filter for specific phone numbers (Marco, Ines, and local numbers)
    // Store without any formatting for comparison
    const allowedNumbers = [
      '4915735999713',     // Marco mobil
      '49303149420347',    // Marco Festnetz
      '49303149420357',    // Ines Festnetz  
      '4991815473001'      // lokal
    ];
    
    console.log(`Processing ${calls.length} calls from Aircall...`);
    
    // Debug: Show first few calls to check format
    if (calls.length > 0) {
      console.log('Sample call format:', {
        from: calls[0].from,
        to: calls[0].to,
        raw_digits: calls[0].raw_digits,
        number_digits: calls[0].number?.digits,
        direction: calls[0].direction,
        user: calls[0].user?.name
      });
      
      // Count calls by number to see distribution
      const numberCounts = {};
      calls.forEach(call => {
        const number = call.number?.digits || 'unknown';
        numberCounts[number] = (numberCounts[number] || 0) + 1;
      });
      console.log('Calls by number:', numberCounts);
    }
    
    for (const call of calls) {
      // Only sync calls from last 30 days
      if (call.started_at < thirtyDaysAgo) continue;
      
      // Log the timestamp conversion for debugging
      const isoTime = convertToUTC(call.started_at, 'unix');
      logTimestampConversion('Aircall', call.started_at, isoTime);
      
      // Filter by phone numbers - check both from and to numbers
      const callNumbers = [call.from, call.to, call.raw_digits, call.number?.digits].filter(Boolean);
      
      // Normalize numbers for comparison (remove all non-digits)
      const normalizeNumber = (num) => num ? num.replace(/\D/g, '') : '';
      
      const isRelevantCall = callNumbers.some(num => {
        const normalizedNum = normalizeNumber(num);
        return allowedNumbers.some(allowed => {
          // Check if the number contains our allowed number
          return normalizedNum.includes(allowed);
        });
      });
      
      if (!isRelevantCall) {
        skippedCount++;
        // Log first few skipped calls to debug
        if (skippedCount <= 5) {
          console.log(`Skipped call - from: ${call.raw_digits || call.from}, to: ${call.to}, number: ${call.number?.digits}`);
        }
        continue;
      }
      
      const contactName = call.contact ? 
        `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim() : 
        null;
      
      const { error } = await supabase.from('activities').upsert({
        source_system: 'aircall',
        source_id: `aircall_${call.id}`,
        activity_type: 'call',
        direction: call.direction,
        // Aircall timestamps are Unix timestamps in UTC
        // Store as UTC, frontend will convert to Berlin time for display
        timestamp: convertToUTC(call.started_at, 'unix'),
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
        last_sync_timestamp: moment.tz('Europe/Berlin').toISOString(),
        last_successful_sync: moment.tz('Europe/Berlin').toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .eq('source_system', 'aircall');

    console.log(`Aircall sync complete: ${syncedCount} synced, ${skippedCount} skipped (not from allowed numbers)`);
    return { success: true, count: syncedCount, message: `${syncedCount} relevante Anrufe synchronisiert` };
  } catch (error) {
    console.error('Aircall sync error:', error.response?.data || error.message);
    
    // If 403 Forbidden, the API key might be invalid
    if (error.response?.status === 403) {
      console.error('Aircall API Key seems to be invalid or lacks permissions');
    }
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: moment.tz('Europe/Berlin').toISOString(),
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

// Gmail sync function with OAuth2
async function syncGmailEmails() {
  console.log('Syncing Gmail emails...');
  
  try {
    // Check if we have credentials
    if (!process.env.GMAIL_REFRESH_TOKEN) {
      console.log('Gmail refresh token not configured');
      return { 
        success: false, 
        count: 0, 
        message: 'Gmail OAuth not configured. Visit /auth/gmail to authorize.' 
      };
    }
    
    // Create Gmail API instance
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateQuery = `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`;
    
    // Search for sent emails from the team
    const teamEmails = [
      'pflegeteam.heer@pflegehilfe-senioren.de',
      'ines.cuerten@pflegehilfe-senioren.de'
    ];
    
    let allMessages = [];
    let syncedCount = 0;
    
    for (const email of teamEmails) {
      console.log(`Fetching sent emails for ${email}...`);
      
      try {
        // List messages
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: `from:${email} in:sent ${dateQuery}`,
          maxResults: 100
        });
        
        const messages = response.data.messages || [];
        console.log(`Found ${messages.length} sent emails for ${email}`);
        
        // Fetch details for each message
        for (const message of messages) {
          try {
            const details = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date']
            });
            
            const headers = details.data.payload.headers || [];
            const getHeader = (name) => headers.find(h => h.name === name)?.value || '';
            
            const fromHeader = getHeader('From');
            const toHeader = getHeader('To');
            const subject = getHeader('Subject');
            const dateStr = getHeader('Date');
            
            // Parse email addresses
            const fromMatch = fromHeader.match(/<(.+?)>/) || [null, fromHeader];
            const toMatch = toHeader.match(/<(.+?)>/) || [null, toHeader];
            const fromEmail = fromMatch[1];
            const toEmail = toMatch[1];
            
            // Parse sender name
            const fromName = fromHeader.split('<')[0].trim().replace(/"/g, '') || fromEmail;
            const toName = toHeader.split('<')[0].trim().replace(/"/g, '') || toEmail;
            
            // Convert date to UTC
            const timestamp = convertToUTC(new Date(dateStr).toISOString(), 'iso');
            logTimestampConversion('Gmail', dateStr, timestamp);
            
            // Get snippet as preview
            const preview = details.data.snippet || '';
            
            // Upsert to database
            const { error } = await supabase.from('activities').upsert({
              source_system: 'gmail',
              source_id: `gmail_${message.id}`,
              activity_type: 'email',
              direction: 'outbound', // We're only fetching sent emails
              timestamp: timestamp,
              subject: subject,
              preview: preview.substring(0, 200),
              contact_name: toName,
              contact_email: toEmail,
              user_name: fromName,
              user_email: fromEmail,
              raw_data: {
                id: message.id,
                threadId: message.threadId,
                headers: headers
              }
            }, {
              onConflict: 'source_system,source_id',
            });
            
            if (!error) {
              syncedCount++;
            } else {
              console.error('Error inserting email:', error);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (err) {
            console.error(`Error fetching message ${message.id}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error listing messages for ${email}:`, err);
        // If it's an auth error, clear the refresh token
        if (err.code === 401 || err.message?.includes('invalid_grant')) {
          console.error('Gmail authentication failed. Refresh token may be invalid.');
          throw new Error('Gmail authentication failed. Please re-authorize at /auth/gmail');
        }
      }
    }
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: moment.tz('Europe/Berlin').toISOString(),
        last_successful_sync: moment.tz('Europe/Berlin').toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .eq('source_system', 'gmail');

    console.log(`Gmail sync complete: ${syncedCount} emails synced`);
    return { success: true, count: syncedCount, message: `${syncedCount} E-Mails synchronisiert` };
    
  } catch (error) {
    console.error('Gmail sync error:', error);
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: moment.tz('Europe/Berlin').toISOString(),
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
  console.log('- Gmail Client ID:', process.env.GMAIL_CLIENT_ID ? 'Set' : 'Missing');
  console.log('- Gmail Client Secret:', process.env.GMAIL_CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('- Gmail Refresh Token:', process.env.GMAIL_REFRESH_TOKEN ? 'Set' : 'Missing');
});