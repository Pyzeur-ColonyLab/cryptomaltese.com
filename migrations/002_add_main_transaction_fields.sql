-- Add new columns for main transaction data
ALTER TABLE transaction_details 
ADD COLUMN IF NOT EXISTS gas_price VARCHAR(78),
ADD COLUMN IF NOT EXISTS max_fee_per_gas VARCHAR(78),
ADD COLUMN IF NOT EXISTS max_priority_fee_per_gas VARCHAR(78),
ADD COLUMN IF NOT EXISTS nonce BIGINT,
ADD COLUMN IF NOT EXISTS transaction_index INTEGER,
ADD COLUMN IF NOT EXISTS block_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS chain_id INTEGER;

-- Add indexes for the new fields that might be queried
CREATE INDEX IF NOT EXISTS idx_transaction_details_block_number ON transaction_details(block_number);
CREATE INDEX IF NOT EXISTS idx_transaction_details_nonce ON transaction_details(nonce);
CREATE INDEX IF NOT EXISTS idx_transaction_details_chain_id ON transaction_details(chain_id);
