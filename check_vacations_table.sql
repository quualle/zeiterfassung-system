-- Prüfe ob die vacations Tabelle existiert und die korrekten Spalten hat
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'vacations'
ORDER BY 
    ordinal_position;

-- Zeige die letzten 10 Einträge
SELECT * FROM vacations 
ORDER BY created_at DESC 
LIMIT 10;

-- Prüfe ob es Einträge für Christian Erode gibt
SELECT 
    v.*,
    u.name as user_name
FROM 
    vacations v
    JOIN users_zeiterfassung u ON v.user_id = u.id
WHERE 
    u.name LIKE '%Christian%' OR u.name LIKE '%Erode%'
ORDER BY 
    v.created_at DESC;

-- Zeige alle Benutzer mit dem Namen Christian oder Erode
SELECT * FROM users_zeiterfassung 
WHERE name LIKE '%Christian%' OR name LIKE '%Erode%';