-- TEMPORÄR: RLS deaktivieren (nur zum Testen!)
ALTER TABLE users_zeiterfassung DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries_zeiterfassung DISABLE ROW LEVEL SECURITY;
ALTER TABLE breaks_zeiterfassung DISABLE ROW LEVEL SECURITY;

-- WICHTIG: Nach dem Testen wieder aktivieren mit:
-- ALTER TABLE users_zeiterfassung ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE time_entries_zeiterfassung ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE breaks_zeiterfassung ENABLE ROW LEVEL SECURITY;