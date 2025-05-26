-- Alle Zeiterfassungen anzeigen
SELECT * FROM time_entries_zeiterfassung
ORDER BY start_time DESC;

-- Alle Pausen anzeigen
SELECT * FROM breaks_zeiterfassung
ORDER BY start_time DESC;

-- Zeiterfassungen mit Benutzer-Namen
SELECT 
  te.*,
  u.name as user_name
FROM time_entries_zeiterfassung te
JOIN users_zeiterfassung u ON te.user_id = u.id
ORDER BY te.start_time DESC;