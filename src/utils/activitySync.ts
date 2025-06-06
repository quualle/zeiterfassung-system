import { supabase } from '../lib/supabase';
import axios from 'axios';

// Simple activity sync that runs from the client
// This is a temporary solution until proper backend OAuth is set up

export async function syncAircallActivities() {
  console.log('Starting Aircall sync...');
  
  try {
    const AIRCALL_API_KEY = 'c1f3df1855afc3ce2f6661b41b154ce7';
    const thirtyDaysAgo = Math.floor(new Date().getTime() / 1000) - (30 * 24 * 60 * 60);
    
    // Note: This will require CORS to be enabled on Aircall's side
    // For production, this should be moved to a backend function
    const response = await axios.get('https://api.aircall.io/v1/calls/search', {
      auth: {
        username: AIRCALL_API_KEY,
        password: ''
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

    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        last_successful_sync: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .eq('source_system', 'aircall');

    console.log('Aircall sync completed');
  } catch (error: any) {
    console.error('Aircall sync error:', error);
    
    await supabase
      .from('sync_status')
      .update({
        last_sync_timestamp: new Date().toISOString(),
        sync_status: 'error',
        error_message: error.message,
      })
      .eq('source_system', 'aircall');
  }
}

// For now, we'll create sample data to test the UI
export async function createSampleActivities() {
  const sampleActivities = [
    // Calls
    {
      source_system: 'aircall',
      source_id: 'sample_call_1',
      activity_type: 'call',
      direction: 'inbound',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      duration_seconds: 245,
      contact_name: 'Max Mustermann',
      contact_phone: '+49 171 1234567',
      user_name: 'Ines Cürten',
      user_email: 'ines.cuerten@pflegehilfe-senioren.de',
    },
    {
      source_system: 'aircall',
      source_id: 'sample_call_2',
      activity_type: 'call',
      direction: 'outbound',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      duration_seconds: 180,
      contact_name: 'Anna Schmidt',
      contact_phone: '+49 151 9876543',
      user_name: 'Lisa Bayer',
      user_email: 'lisa.bayer@pflegehilfe-senioren.de',
    },
    // Emails
    {
      source_system: 'gmail',
      source_id: 'sample_email_1',
      activity_type: 'email',
      direction: 'outbound',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      subject: 'Terminbestätigung für Pflegeberatung',
      preview: 'Sehr geehrte Frau Schmidt, hiermit bestätige ich Ihnen den Termin für die Pflegeberatung am...',
      contact_email: 'anna.schmidt@email.de',
      user_email: 'pflegeteam.heer@pflegehilfe-senioren.de',
    },
    // Tickets
    {
      source_system: 'bigquery',
      source_id: 'sample_ticket_1',
      activity_type: 'ticket',
      direction: 'outbound',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      subject: 'Anfrage zu Pflegekraft für Herrn Müller',
      preview: 'Bitte um Rückmeldung bezüglich der Verfügbarkeit einer Pflegekraft für Herrn Müller ab dem 15.01...',
      user_name: 'Pflegeteam Heer',
      lead_id: 'lead_12345',
    },
    {
      source_system: 'bigquery',
      source_id: 'sample_ticket_2',
      activity_type: 'ticket',
      direction: 'outbound',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      subject: 'Update zu Vertragsstatus Familie Weber',
      preview: 'Der Vertrag wurde erfolgreich abgeschlossen. Die Pflegekraft beginnt am Montag...',
      user_name: 'Pflegeteam Heer',
      lead_id: 'lead_67890',
    },
  ];

  for (const activity of sampleActivities) {
    await supabase.from('activities').upsert({
      ...activity,
      raw_data: {},
    }, {
      onConflict: 'source_system,source_id',
    });
  }

  console.log('Sample activities created');
}