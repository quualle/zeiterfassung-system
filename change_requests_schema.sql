-- Tabelle für Änderungsanträge
CREATE TABLE change_requests_zeiterfassung (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  time_entry_id UUID NOT NULL REFERENCES time_entries_zeiterfassung(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('time_entry', 'break')),
  break_id UUID REFERENCES breaks_zeiterfassung(id) ON DELETE CASCADE,
  
  -- Aktuelle Werte
  current_start_time TIMESTAMP WITH TIME ZONE,
  current_end_time TIMESTAMP WITH TIME ZONE,
  current_reason TEXT,
  
  -- Gewünschte neue Werte
  new_start_time TIMESTAMP WITH TIME ZONE,
  new_end_time TIMESTAMP WITH TIME ZONE,
  new_reason TEXT,
  
  -- Begründung für die Änderung
  change_reason TEXT NOT NULL,
  
  -- Status und Verwaltung
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  admin_comment TEXT,
  
  -- Admin's finale Werte (falls modifiziert)
  final_start_time TIMESTAMP WITH TIME ZONE,
  final_end_time TIMESTAMP WITH TIME ZONE,
  final_reason TEXT,
  
  -- Zeitstempel
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users_zeiterfassung(id)
);

-- Index für bessere Performance
CREATE INDEX idx_change_requests_user_id ON change_requests_zeiterfassung(user_id);
CREATE INDEX idx_change_requests_status ON change_requests_zeiterfassung(status);
CREATE INDEX idx_change_requests_created_at ON change_requests_zeiterfassung(created_at);

-- RLS Policies
ALTER TABLE change_requests_zeiterfassung ENABLE ROW LEVEL SECURITY;

-- Mitarbeiter können ihre eigenen Anträge lesen und erstellen
CREATE POLICY "Users can view own change requests" ON change_requests_zeiterfassung
  FOR SELECT USING (true);

CREATE POLICY "Users can create change requests" ON change_requests_zeiterfassung
  FOR INSERT WITH CHECK (true);

-- Admins können alle Anträge aktualisieren
CREATE POLICY "Admins can update change requests" ON change_requests_zeiterfassung
  FOR UPDATE USING (true);