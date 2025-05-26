-- Erst alle alten Policies löschen
DROP POLICY IF EXISTS "Alle können Benutzer lesen" ON users_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Benutzer aktualisieren" ON users_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Zeiteinträge lesen" ON time_entries_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Zeiteinträge erstellen" ON time_entries_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Zeiteinträge aktualisieren" ON time_entries_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Pausen lesen" ON breaks_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Pausen erstellen" ON breaks_zeiterfassung;
DROP POLICY IF EXISTS "Alle können Pausen aktualisieren" ON breaks_zeiterfassung;

-- Neue Policies mit anon Rolle erstellen
CREATE POLICY "Enable read access for all users" ON users_zeiterfassung
  FOR SELECT USING (true);

CREATE POLICY "Enable update for all users" ON users_zeiterfassung
  FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON time_entries_zeiterfassung
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON time_entries_zeiterfassung
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON time_entries_zeiterfassung
  FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON breaks_zeiterfassung
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON breaks_zeiterfassung
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON breaks_zeiterfassung
  FOR UPDATE USING (true);

-- Sicherstellen, dass RLS aktiviert ist
ALTER TABLE users_zeiterfassung ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries_zeiterfassung ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks_zeiterfassung ENABLE ROW LEVEL SECURITY;