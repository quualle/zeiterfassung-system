import { supabase } from '../lib/supabase';

// Sample ticket data that would come from BigQuery
const sampleTickets = [
  {
    ticket_id: 'ticket_001',
    subject: 'Anfrage Pflegekraft für Frau Schmidt',
    preview: 'Sehr geehrte Damen und Herren, wir benötigen ab dem 15.01. eine Pflegekraft für meine Mutter...',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    seller: 'Pflegeteam Heer'
  },
  {
    ticket_id: 'ticket_002',
    subject: 'Vertragsverlängerung Familie Weber',
    preview: 'Der aktuelle Vertrag läuft am 31.01. aus. Die Familie möchte gerne verlängern...',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    seller: 'Pflegeteam Heer'
  },
  {
    ticket_id: 'ticket_003',
    subject: 'Rückfrage zu Abrechnungsmodalitäten',
    preview: 'Bezüglich der Abrechnung für Januar haben wir noch folgende Fragen...',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    seller: 'Pflegeteam Heer'
  }
];

// Sample call data that would come from Aircall
const sampleCalls = [
  {
    call_id: 'call_001',
    direction: 'inbound',
    duration: 245,
    contact_name: 'Max Mustermann',
    contact_phone: '+49 171 1234567',
    user_name: 'Ines Cürten',
    started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },
  {
    call_id: 'call_002',
    direction: 'outbound',
    duration: 180,
    contact_name: 'Anna Schmidt',
    contact_phone: '+49 151 9876543',
    user_name: 'Lisa Bayer',
    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    call_id: 'call_003',
    direction: 'inbound',
    duration: 420,
    contact_name: 'Peter Weber',
    contact_phone: '+49 162 5555555',
    user_name: 'Pflegeteam Heer',
    started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  }
];

// Sample email data that would come from Gmail
const sampleEmails = [
  {
    email_id: 'email_001',
    subject: 'Terminbestätigung Pflegeberatung',
    preview: 'Sehr geehrte Frau Schmidt, hiermit bestätige ich Ihnen den Termin am 15.01. um 14:00 Uhr...',
    contact_email: 'schmidt@email.de',
    user_email: 'pflegeteam.heer@pflegehilfe-senioren.de',
    date: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    email_id: 'email_002',
    subject: 'Unterlagen für Pflegegrad-Antrag',
    preview: 'Anbei sende ich Ihnen die besprochenen Unterlagen für den Pflegegrad-Antrag...',
    contact_email: 'weber@email.de',
    user_email: 'ines.cuerten@pflegehilfe-senioren.de',
    date: new Date(Date.now() - 90 * 60 * 1000).toISOString()
  }
];

export async function importManualData() {
  console.log('Starting manual data import...');
  
  try {
    // Import tickets
    for (const ticket of sampleTickets) {
      await supabase.from('activities').upsert({
        source_system: 'bigquery',
        source_id: `bigquery_${ticket.ticket_id}`,
        activity_type: 'ticket',
        direction: 'outbound',
        timestamp: ticket.created_at,
        subject: ticket.subject,
        preview: ticket.preview,
        user_name: ticket.seller,
        raw_data: ticket,
      }, {
        onConflict: 'source_system,source_id',
      });
    }

    // Import calls
    for (const call of sampleCalls) {
      await supabase.from('activities').upsert({
        source_system: 'aircall',
        source_id: `aircall_${call.call_id}`,
        activity_type: 'call',
        direction: call.direction as 'inbound' | 'outbound',
        timestamp: call.started_at,
        duration_seconds: call.duration,
        contact_name: call.contact_name,
        contact_phone: call.contact_phone,
        user_name: call.user_name,
        raw_data: call,
      }, {
        onConflict: 'source_system,source_id',
      });
    }

    // Import emails
    for (const email of sampleEmails) {
      await supabase.from('activities').upsert({
        source_system: 'gmail',
        source_id: `gmail_${email.email_id}`,
        activity_type: 'email',
        direction: 'outbound',
        timestamp: email.date,
        subject: email.subject,
        preview: email.preview,
        contact_email: email.contact_email,
        user_email: email.user_email,
        raw_data: email,
      }, {
        onConflict: 'source_system,source_id',
      });
    }

    // Update sync status
    const now = new Date().toISOString();
    await supabase.from('sync_status').update({
      last_sync_timestamp: now,
      last_successful_sync: now,
      sync_status: 'success',
      error_message: null,
    }).eq('source_system', 'bigquery');

    await supabase.from('sync_status').update({
      last_sync_timestamp: now,
      last_successful_sync: now,
      sync_status: 'success',
      error_message: null,
    }).eq('source_system', 'aircall');

    await supabase.from('sync_status').update({
      last_sync_timestamp: now,
      last_successful_sync: now,
      sync_status: 'success',
      error_message: null,
    }).eq('source_system', 'gmail');

    console.log('Manual data import completed');
    return { success: true, message: 'Daten erfolgreich importiert' };
  } catch (error: any) {
    console.error('Import error:', error);
    return { success: false, message: error.message };
  }
}

// Function to add more realistic data
export async function generateRealisticActivities() {
  const activities = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Generate activities for the last 30 days
  for (let day = 0; day < 30; day++) {
    const dayStart = now - (day * oneDay);
    
    // 2-5 calls per day
    const callCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < callCount; i++) {
      const timestamp = new Date(dayStart - Math.random() * oneDay);
      activities.push({
        source_system: 'aircall',
        source_id: `aircall_generated_${day}_${i}`,
        activity_type: 'call',
        direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
        timestamp: timestamp.toISOString(),
        duration_seconds: 60 + Math.floor(Math.random() * 600),
        contact_name: getRandomName(),
        contact_phone: getRandomPhone(),
        user_name: getRandomUser(),
        raw_data: {},
      });
    }
    
    // 1-3 emails per day
    const emailCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < emailCount; i++) {
      const timestamp = new Date(dayStart - Math.random() * oneDay);
      activities.push({
        source_system: 'gmail',
        source_id: `gmail_generated_${day}_${i}`,
        activity_type: 'email',
        direction: 'outbound',
        timestamp: timestamp.toISOString(),
        subject: getRandomEmailSubject(),
        preview: getRandomEmailPreview(),
        contact_email: getRandomEmail(),
        user_email: getRandomUserEmail(),
        raw_data: {},
      });
    }
    
    // 0-2 tickets per day
    const ticketCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < ticketCount; i++) {
      const timestamp = new Date(dayStart - Math.random() * oneDay);
      activities.push({
        source_system: 'bigquery',
        source_id: `bigquery_generated_${day}_${i}`,
        activity_type: 'ticket',
        direction: 'outbound',
        timestamp: timestamp.toISOString(),
        subject: getRandomTicketSubject(),
        preview: getRandomTicketPreview(),
        user_name: 'Pflegeteam Heer',
        lead_id: `lead_${Math.floor(Math.random() * 1000)}`,
        raw_data: {},
      });
    }
  }
  
  // Insert all activities
  for (const activity of activities) {
    await supabase.from('activities').upsert(activity, {
      onConflict: 'source_system,source_id',
    });
  }
  
  return { success: true, message: `${activities.length} Aktivitäten generiert` };
}

// Helper functions
function getRandomName() {
  const firstNames = ['Max', 'Anna', 'Peter', 'Maria', 'Thomas', 'Sarah', 'Michael', 'Julia'];
  const lastNames = ['Müller', 'Schmidt', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function getRandomPhone() {
  return `+49 ${1 + Math.floor(Math.random() * 8)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${Math.floor(Math.random() * 10000000)}`;
}

function getRandomUser() {
  const users = ['Ines Cürten', 'Lisa Bayer', 'Pflegeteam Heer'];
  return users[Math.floor(Math.random() * users.length)];
}

function getRandomUserEmail() {
  const emails = ['pflegeteam.heer@pflegehilfe-senioren.de', 'ines.cuerten@pflegehilfe-senioren.de', 'lisa.bayer@pflegehilfe-senioren.de'];
  return emails[Math.floor(Math.random() * emails.length)];
}

function getRandomEmail() {
  const domains = ['gmail.com', 'web.de', 'gmx.de', 't-online.de'];
  return `${getRandomName().toLowerCase().replace(' ', '.')}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function getRandomEmailSubject() {
  const subjects = [
    'Terminbestätigung Pflegeberatung',
    'Unterlagen für Pflegegrad-Antrag',
    'Rückfrage zu Vertragsbedingungen',
    'Informationen zur Pflegekraft',
    'Terminverschiebung gewünscht',
    'Bestätigung Erstgespräch',
    'Kostenvoranschlag Pflegeleistungen'
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

function getRandomEmailPreview() {
  const previews = [
    'Sehr geehrte Damen und Herren, vielen Dank für Ihr Interesse an unseren Pflegeleistungen...',
    'Hiermit bestätige ich Ihnen den vereinbarten Termin am...',
    'Anbei sende ich Ihnen die gewünschten Unterlagen...',
    'Bezüglich unseres Telefonats möchte ich Ihnen folgende Informationen zukommen lassen...',
    'Vielen Dank für das angenehme Gespräch. Wie besprochen...'
  ];
  return previews[Math.floor(Math.random() * previews.length)];
}

function getRandomTicketSubject() {
  const subjects = [
    'Anfrage Pflegekraft',
    'Vertragsverlängerung',
    'Rückfrage Abrechnung',
    'Änderung Pflegezeiten',
    'Neue Anfrage Familie',
    'Urlaubsvertretung benötigt',
    'Feedback zu Pflegekraft'
  ];
  return subjects[Math.floor(Math.random() * subjects.length)] + ' ' + getRandomName();
}

function getRandomTicketPreview() {
  const previews = [
    'Die Familie benötigt ab sofort Unterstützung bei der Grundpflege...',
    'Der aktuelle Vertrag soll um weitere 6 Monate verlängert werden...',
    'Es gibt Fragen zur letzten Abrechnung, insbesondere...',
    'Die Pflegezeiten müssen angepasst werden aufgrund...',
    'Eine neue Familie hat sich gemeldet und benötigt...'
  ];
  return previews[Math.floor(Math.random() * previews.length)];
}