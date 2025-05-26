-- Tabelle für Benutzer
CREATE TABLE users_zeiterfassung (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  pin VARCHAR(4),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee')),
  first_login BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für Zeiterfassungen
CREATE TABLE time_entries_zeiterfassung (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle für Pausen
CREATE TABLE breaks_zeiterfassung (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id UUID NOT NULL REFERENCES time_entries_zeiterfassung(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für bessere Performance
CREATE INDEX idx_time_entries_zeiterfassung_user_id ON time_entries_zeiterfassung(user_id);
CREATE INDEX idx_time_entries_zeiterfassung_date ON time_entries_zeiterfassung(date);
CREATE INDEX idx_breaks_zeiterfassung_time_entry_id ON breaks_zeiterfassung(time_entry_id);

-- Initial-Daten für Benutzer
INSERT INTO users_zeiterfassung (name, role) VALUES 
  ('Ines Cürten', 'admin'),
  ('Lisa Bayer', 'employee'),
  ('Emilia Rathmann', 'employee');

-- RLS (Row Level Security) aktivieren
ALTER TABLE users_zeiterfassung ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries_zeiterfassung ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks_zeiterfassung ENABLE ROW LEVEL SECURITY;

-- Policies für öffentlichen Zugriff (für diese Demo-App)
-- In Produktion würden Sie hier strikte Berechtigungen setzen
CREATE POLICY "Alle können Benutzer lesen" ON users_zeiterfassung FOR SELECT USING (true);
CREATE POLICY "Alle können Benutzer aktualisieren" ON users_zeiterfassung FOR UPDATE USING (true);

CREATE POLICY "Alle können Zeiteinträge lesen" ON time_entries_zeiterfassung FOR SELECT USING (true);
CREATE POLICY "Alle können Zeiteinträge erstellen" ON time_entries_zeiterfassung FOR INSERT WITH CHECK (true);
CREATE POLICY "Alle können Zeiteinträge aktualisieren" ON time_entries_zeiterfassung FOR UPDATE USING (true);

CREATE POLICY "Alle können Pausen lesen" ON breaks_zeiterfassung FOR SELECT USING (true);
CREATE POLICY "Alle können Pausen erstellen" ON breaks_zeiterfassung FOR INSERT WITH CHECK (true);
CREATE POLICY "Alle können Pausen aktualisieren" ON breaks_zeiterfassung FOR UPDATE USING (true);