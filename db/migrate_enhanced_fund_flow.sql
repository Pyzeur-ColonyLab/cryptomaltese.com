-- Migration script for Enhanced Fund Flow Analysis Tables
-- Run this script to add the new tables required for enhanced fund flow analysis

-- Enhanced analysis tracking
CREATE TABLE IF NOT EXISTS fund_flow_analysis (
    id SERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    victim_wallet VARCHAR(42) NOT NULL,
    total_loss_amount DECIMAL(36,18),
    hack_timestamp TIMESTAMP,
    max_depth INTEGER DEFAULT 6,
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    confidence_score DECIMAL(3,2)
);

-- Transaction paths tracking
CREATE TABLE IF NOT EXISTS transaction_paths (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id) ON DELETE CASCADE,
    path_id VARCHAR(36) NOT NULL,
    depth_level INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    value_amount DECIMAL(36,18),
    timestamp TIMESTAMP,
    confidence_score DECIMAL(3,2),
    patterns JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Address classification cache
CREATE TABLE IF NOT EXISTS address_classifications (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    classification VARCHAR(20) NOT NULL, -- mixer, exchange, bridge, wallet, defi, other
    confidence DECIMAL(3,2),
    transaction_count INTEGER,
    analysis_data JSONB,
    ai_analysis_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pattern detection results
CREATE TABLE IF NOT EXISTS detected_patterns (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id) ON DELETE CASCADE,
    pattern_type VARCHAR(30) NOT NULL, -- peel_chain, rapid_movement, round_numbers, coordinated
    affected_addresses TEXT[],
    confidence DECIMAL(3,2),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analysis endpoints (final destinations)
CREATE TABLE IF NOT EXISTS analysis_endpoints (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    classification VARCHAR(20),
    total_amount DECIMAL(36,18),
    transaction_count INTEGER,
    confidence DECIMAL(3,2),
    risk_level VARCHAR(10), -- low, medium, high, critical
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fund_flow_analysis_incident_id ON fund_flow_analysis(incident_id);
CREATE INDEX IF NOT EXISTS idx_fund_flow_analysis_status ON fund_flow_analysis(status);
CREATE INDEX IF NOT EXISTS idx_fund_flow_analysis_created_at ON fund_flow_analysis(created_at);

CREATE INDEX IF NOT EXISTS idx_transaction_paths_analysis_id ON transaction_paths(analysis_id);
CREATE INDEX IF NOT EXISTS idx_transaction_paths_depth_level ON transaction_paths(depth_level);
CREATE INDEX IF NOT EXISTS idx_transaction_paths_from_address ON transaction_paths(from_address);
CREATE INDEX IF NOT EXISTS idx_transaction_paths_to_address ON transaction_paths(to_address);

CREATE INDEX IF NOT EXISTS idx_address_classifications_address ON address_classifications(address);
CREATE INDEX IF NOT EXISTS idx_address_classifications_classification ON address_classifications(classification);

CREATE INDEX IF NOT EXISTS idx_detected_patterns_analysis_id ON detected_patterns(analysis_id);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_pattern_type ON detected_patterns(pattern_type);

CREATE INDEX IF NOT EXISTS idx_analysis_endpoints_analysis_id ON analysis_endpoints(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_endpoints_risk_level ON analysis_endpoints(risk_level);

-- Add comments for documentation
COMMENT ON TABLE fund_flow_analysis IS 'Enhanced fund flow analysis tracking for incidents';
COMMENT ON TABLE transaction_paths IS 'Individual transaction paths in fund flow analysis';
COMMENT ON TABLE address_classifications IS 'AI-powered address classification cache';
COMMENT ON TABLE detected_patterns IS 'Detected laundering patterns in fund flows';
COMMENT ON TABLE analysis_endpoints IS 'Final destinations identified in fund flow analysis';

-- Verify the tables were created
SELECT 'Enhanced fund flow analysis tables created successfully' as status;

-- Show table information
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN (
    'fund_flow_analysis',
    'transaction_paths', 
    'address_classifications',
    'detected_patterns',
    'analysis_endpoints'
)
ORDER BY table_name, ordinal_position; 