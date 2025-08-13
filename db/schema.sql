-- incidents table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    description TEXT NOT NULL,
    discovered_at TIMESTAMP NOT NULL,
    tx_hash VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    report_status VARCHAR NOT NULL CHECK (report_status IN ('pending', 'complete', 'error'))
);

-- api_cache table
CREATE TABLE api_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    pdf_url VARCHAR NOT NULL,
    summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- analysis table for storing enhanced fund flow analysis results
CREATE TABLE IF NOT EXISTS analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enhanced analysis tracking
CREATE TABLE IF NOT EXISTS fund_flow_analysis (
    id SERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    victim_wallet VARCHAR(42) NOT NULL,
    total_loss_amount DECIMAL(36,18),
    hack_timestamp TIMESTAMP,
    max_depth INTEGER DEFAULT 6,
    status VARCHAR(20) DEFAULT 'pending',
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