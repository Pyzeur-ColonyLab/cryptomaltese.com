-- Create incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL UNIQUE,
    description TEXT NOT NULL CHECK (LENGTH(description) <= 1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transaction_details table
CREATE TABLE IF NOT EXISTS transaction_details (
    id SERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    block_number BIGINT,
    timestamp_unix BIGINT,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    value VARCHAR(78), -- Store as string to handle large numbers
    contract_address VARCHAR(42),
    input TEXT,
    type VARCHAR(50),
    gas BIGINT,
    gas_used BIGINT,
    is_error BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(10),
    etherscan_status VARCHAR(10),
    etherscan_message TEXT,
    raw_json JSONB, -- Store the complete API response
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_wallet_address ON incidents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_incidents_transaction_hash ON incidents(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_details_incident_id ON transaction_details(incident_id);
CREATE INDEX IF NOT EXISTS idx_transaction_details_from_address ON transaction_details(from_address);
CREATE INDEX IF NOT EXISTS idx_transaction_details_to_address ON transaction_details(to_address);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_incidents_updated_at 
    BEFORE UPDATE ON incidents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
