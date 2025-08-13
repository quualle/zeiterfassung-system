-- Zeige alle Benutzer in der Datenbank
SELECT 
    id,
    name,
    role,
    weekly_hours,
    created_at
FROM users_zeiterfassung
ORDER BY name;

-- Prüfe speziell nach Ines Kürten
SELECT * FROM users_zeiterfassung 
WHERE LOWER(name) LIKE '%ines%' 
   OR LOWER(name) LIKE '%kürten%'
   OR LOWER(name) LIKE '%kurten%';

-- Zeige alle nicht-Admin Benutzer (diese sollten in der Statistik erscheinen)
SELECT 
    name,
    role,
    weekly_hours
FROM users_zeiterfassung
WHERE role != 'admin' OR role IS NULL
ORDER BY name;

-- Falls Ines Kürten als Admin markiert ist, kann sie mit diesem Update zur Mitarbeiterin gemacht werden:
-- UPDATE users_zeiterfassung 
-- SET role = 'employee', 
--     weekly_hours = 40  -- Setze die gewünschte Wochenstundenzahl
-- WHERE name = 'Ines Kürten';