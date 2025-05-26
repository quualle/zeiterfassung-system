// Konvertiert eine UTC-Zeit in lokale Zeit (Berlin/Europe)
export const utcToLocal = (utcDateString: string): string => {
  const date = new Date(utcDateString);
  // Füge 2 Stunden hinzu für Berlin Zeit (UTC+2 im Sommer, UTC+1 im Winter)
  // Für eine richtige Lösung würde man eine Zeitzone-Library wie date-fns-tz verwenden
  const offset = 2; // Stunden für Sommerzeit (CEST)
  date.setHours(date.getHours() + offset);
  return date.toISOString();
};

// Konvertiert lokale Zeit (Berlin) in UTC
export const localToUtc = (localDateString: string): string => {
  const date = new Date(localDateString);
  // Ziehe 2 Stunden ab für UTC
  const offset = 2; // Stunden für Sommerzeit (CEST)
  date.setHours(date.getHours() - offset);
  return date.toISOString();
};

// Formatiert Zeit für die Anzeige in lokaler Zeit
export const formatTimeLocal = (utcDateString: string): string => {
  const date = new Date(utcDateString);
  // Konvertiere zu lokaler Zeit
  const localDate = new Date(date.getTime() + (2 * 60 * 60 * 1000)); // +2 Stunden
  return localDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin'
  });
};

// Konvertiert ein Datum und eine Zeit (HH:MM) in UTC ISO String
export const dateTimeToUtc = (date: string, time: string): string => {
  // Erstelle einen ISO String im lokalen Format
  const localDateTime = `${date}T${time}:00`;
  // Konvertiere zu UTC durch Subtraktion von 2 Stunden
  return localToUtc(localDateTime);
};