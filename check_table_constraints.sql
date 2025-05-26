-- Tabellen-Struktur prüfen
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'users_zeiterfassung'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Constraints prüfen
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    cc.check_clause
FROM 
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.check_constraints AS cc
      ON tc.constraint_name = cc.constraint_name
      AND tc.table_schema = cc.constraint_schema
WHERE 
    tc.table_name = 'users_zeiterfassung'
    AND tc.table_schema = 'public';