-- Migration script to add analysis table
-- Run this script to add the analysis table to your database

-- Create analysis table for storing enhanced fund flow analysis results
CREATE TABLE IF NOT EXISTS analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_analysis_incident_id ON analysis(incident_id);
CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis(created_at);

-- Verify the table was created
SELECT 'Analysis table created successfully' as status; 