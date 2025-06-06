import { supabase } from '../lib/supabase';

// Simple activity sync that runs from the client
// This is a temporary solution until proper backend OAuth is set up

// Aircall sync temporarily disabled - requires backend implementation
// export async function syncAircallActivities() {
//   // Implementation requires axios and proper CORS setup
//   console.log('Aircall sync not yet implemented');
// }

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