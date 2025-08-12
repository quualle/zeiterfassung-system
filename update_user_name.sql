-- Update Lisa Bayer to Christiane Rohde in the database
UPDATE users_zeiterfassung 
SET name = 'Christiane Rohde' 
WHERE name = 'Lisa Bayer';