-- Benutzer einfügen, falls noch nicht vorhanden
INSERT INTO users_zeiterfassung (name, role) 
VALUES 
  ('Ines Cürten', 'admin'),
  ('Christiane Rohde', 'employee'),
  ('Emilia Rathmann', 'employee')
ON CONFLICT (name) DO NOTHING;