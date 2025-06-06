-- Activity Log Schema for Supabase
-- This stores all communication activities from BigQuery, Gmail, and Aircall

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main activities table
CREATE TABLE IF NOT EXISTS activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('email', 'ticket', 'call')),
    direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
    timestamp TIMESTAMP NOT NULL,
    duration_seconds INTEGER, -- for calls
    
    -- Contact information
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    lead_id VARCHAR(100), -- BigQuery lead ID
    
    -- Activity details
    subject TEXT, -- for emails and tickets
    preview TEXT, -- first 200 chars of content
    
    -- Source information
    source_id VARCHAR(255) NOT NULL, -- unique ID from source system
    source_system VARCHAR(50) NOT NULL CHECK (source_system IN ('gmail', 'bigquery', 'aircall')),
    
    -- User who performed the activity
    user_email VARCHAR(255), -- who sent/received
    user_name VARCHAR(255),
    
    -- Metadata
    raw_data JSONB, -- store complete data from source
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure no duplicates from same source
    UNIQUE(source_system, source_id)
);

-- Indexes for performance
CREATE INDEX idx_activities_timestamp ON activities(timestamp DESC);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_user_email ON activities(user_email);
CREATE INDEX idx_activities_lead_id ON activities(lead_id);

-- Sync status table to track last sync times
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_system VARCHAR(50) NOT NULL UNIQUE,
    last_sync_timestamp TIMESTAMP,
    last_successful_sync TIMESTAMP,
    sync_status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial sync status records
INSERT INTO sync_status (source_system, sync_status) 
VALUES 
    ('gmail', 'pending'),
    ('bigquery', 'pending'),
    ('aircall', 'pending')
ON CONFLICT (source_system) DO NOTHING;

-- RLS Policies - Only admin can access
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Policy for activities - only users with admin role can access
CREATE POLICY "Admin users can view all activities" ON activities
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            JOIN users ON auth.users.email = users.email 
            WHERE users.role = 'admin'
        )
    );

-- Policy for sync_status - only admin can access
CREATE POLICY "Admin users can manage sync status" ON sync_status
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            JOIN users ON auth.users.email = users.email 
            WHERE users.role = 'admin'
        )
    );

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();