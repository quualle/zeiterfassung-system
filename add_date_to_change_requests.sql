-- Add new_date column to change_requests_zeiterfassung table
ALTER TABLE change_requests_zeiterfassung 
ADD COLUMN new_date DATE;

-- Also add final_date for admin modifications
ALTER TABLE change_requests_zeiterfassung 
ADD COLUMN final_date DATE;