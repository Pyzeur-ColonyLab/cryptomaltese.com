# Etherscan Transaction Integration

This document explains how the CryptoMaltese incident reporting system integrates with the Etherscan API to fetch and store blockchain transaction data.

## Overview

When users submit incident reports, the system automatically fetches detailed transaction information from Etherscan and stores it in the database. This provides comprehensive blockchain data for analysis and verification of reported incidents.

## System Architecture

```
User Incident Submission
         ↓
   Input Validation
         ↓
   Etherscan API Call
         ↓
   Data Normalization
         ↓
   Database Storage
```

## Integration Flow

### 1. Incident Submission Process

When a user submits an incident via `POST /api/incidents`, the following process occurs:

1. **Input Validation**: Validates wallet address, transaction hash, and description
2. **Duplicate Check**: Verifies the transaction hasn't been reported before
3. **Transaction Verification**: Confirms the transaction exists on the Ethereum network
4. **Data Fetching**: Retrieves comprehensive transaction data from Etherscan
5. **Data Processing**: Normalizes hexadecimal values to decimal format
6. **Database Storage**: Saves both incident and transaction details atomically

### 2. Etherscan API Integration

#### Endpoint Used
```
https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash={hash}&apikey={key}
```

#### Example Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "blockHash": "0x597c95a4cc4044b0872d44487e065654eac355d5e11a457f82a4a76bc5f86adf",
    "blockNumber": "0x15e78ab",
    "from": "0x85ac393addd65bcf6ab0999f2a5c064e867f255f",
    "gas": "0x5208",
    "gasPrice": "0x10e2694f9",
    "maxFeePerGas": "0xe8d4a51000",
    "maxPriorityFeePerGas": "0x12596e96",
    "hash": "0xcf62440efd7057ba5f2ca4d912d09a7b2372678c963dcaeb0baf0d12cd936285",
    "input": "0x",
    "nonce": "0x2bae",
    "to": "0x3153972890cbd9fcdbbf1b4a52a1e66c954ae59c",
    "transactionIndex": "0x7e",
    "value": "0x24d9d547b4b5ea7",
    "type": "0x2",
    "chainId": "0x1"
  }
}
```

### 3. Data Normalization

The system converts hexadecimal values from Etherscan to decimal format for database storage:

| Field | Hex Example | Decimal Result |
|-------|-------------|----------------|
| Block Number | `0x15e78ab` | `22968491` |
| Gas Price | `0x10e2694f9` | `4532376825` |
| Max Fee Per Gas | `0xe8d4a51000` | `1000000000000` |
| Value (Wei) | `0x24d9d547b4b5ea7` | `165961747453927070` |
| Nonce | `0x2bae` | `11182` |
| Transaction Index | `0x7e` | `126` |
| Chain ID | `0x1` | `1` |

## Database Schema

### Incidents Table
```sql
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Transaction Details Table
```sql
CREATE TABLE transaction_details (
    id SERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Basic transaction data
    block_number BIGINT,
    timestamp_unix BIGINT,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    value VARCHAR(78), -- Wei amount as string
    contract_address VARCHAR(42),
    input TEXT,
    type VARCHAR(50),
    
    -- Gas information
    gas BIGINT,
    gas_used BIGINT,
    gas_price VARCHAR(78),
    max_fee_per_gas VARCHAR(78),
    max_priority_fee_per_gas VARCHAR(78),
    
    -- Transaction metadata
    nonce BIGINT,
    transaction_index INTEGER,
    block_hash VARCHAR(66),
    chain_id INTEGER,
    
    -- Error handling
    is_error BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(10),
    
    -- Etherscan metadata
    etherscan_status VARCHAR(10),
    etherscan_message TEXT,
    raw_json JSONB, -- Complete API response
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Code Components

### 1. Etherscan Service (`server/services/etherscanService.js`)

#### Key Methods:

**`getTransactionByHash(txHash)`**
- Fetches transaction data from Etherscan API
- Implements caching and retry logic
- Handles API errors gracefully

**`normalizeMainTransaction(etherscanResponse)`**
- Converts hex values to decimal
- Structures data for database storage
- Handles missing or null values

**`verifyTransactionExists(txHash)`**
- Confirms transaction exists on Ethereum network
- Used for validation before processing

#### Example Usage:
```javascript
const etherscanService = require('./services/etherscanService')

// Fetch transaction data
const response = await etherscanService.getTransactionByHash(txHash)

// Normalize for database
const normalized = etherscanService.normalizeMainTransaction(response)
```

### 2. Incident Controller (`server/controllers/incidentController.js`)

The `createIncident` method orchestrates the entire process:

```javascript
async createIncident(req, res, next) {
  try {
    // 1. Validate input and check for duplicates
    const { walletAddress, transactionHash, description } = req.body
    
    // 2. Verify transaction exists
    const exists = await etherscanService.verifyTransactionExists(transactionHash)
    
    // 3. Fetch transaction data
    const etherscanResponse = await etherscanService.getTransactionByHash(transactionHash)
    
    // 4. Store in database transaction
    await db.transaction(async (client) => {
      // Create incident
      const incident = await createIncidentRecord(client, data)
      
      // Normalize and store transaction details
      const normalized = etherscanService.normalizeMainTransaction(etherscanResponse)
      if (normalized) {
        await createTransactionDetail(client, incident.id, normalized)
      }
    })
  } catch (error) {
    // Handle errors appropriately
  }
}
```

### 3. Transaction Detail Model (`server/models/TransactionDetail.js`)

Handles database operations for transaction details:

```javascript
static async create(transactionData) {
  const query = `
    INSERT INTO transaction_details (
      incident_id, block_number, from_address, to_address, value,
      gas, gas_price, max_fee_per_gas, nonce, transaction_index,
      block_hash, chain_id, raw_json, ...
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ...)
    RETURNING *
  `
  
  return await db.query(query, [...values])
}
```

## Error Handling

### 1. Transaction Not Found
```json
{
  "status": "fail",
  "message": "Transaction hash not found on Ethereum network"
}
```

### 2. Etherscan API Error
```json
{
  "status": "error",
  "message": "Unable to retrieve blockchain data for this transaction. Please try again later.",
  "details": "API rate limit exceeded"
}
```

### 3. Duplicate Transaction
```json
{
  "status": "fail",
  "message": "This transaction has already been reported",
  "incidentId": "uuid-here",
  "reportedAt": "2025-08-20T10:30:20.250Z"
}
```

## Caching Strategy

The system implements intelligent caching to optimize API usage:

- **Cache Duration**: 10 minutes (configurable)
- **Cache Keys**: `tx_{transaction_hash}`
- **Benefits**: Reduces API calls, improves response time, handles rate limits

## Data Validation and Integrity

### 1. Input Validation
- **Wallet Address**: Must match `^0x[a-fA-F0-9]{40}$`
- **Transaction Hash**: Must match `^0x[a-fA-F0-9]{64}$`
- **Description**: 10-1000 characters

### 2. Database Constraints
- Unique transaction hash constraint prevents duplicates
- Foreign key relationships ensure data integrity
- Check constraints validate data ranges

### 3. Atomic Operations
All incident and transaction detail creation happens within a database transaction, ensuring consistency.

## API Response Format

### Successful Incident Creation
```json
{
  "status": "success",
  "message": "Incident reported successfully",
  "data": {
    "incidentId": "uuid-here",
    "walletAddress": "0x...",
    "transactionHash": "0x...",
    "description": "...",
    "createdAt": "2025-08-20T11:05:16.434Z",
    "transactionCount": 1,
    "etherscanStatus": "success",
    "etherscanMessage": "OK"
  }
}
```

### Incident Retrieval with Transaction Details
```json
{
  "status": "success",
  "data": {
    "incident": {
      "id": "uuid-here",
      "wallet_address": "0x...",
      "transaction_hash": "0x...",
      "description": "...",
      "created_at": "2025-08-20T11:05:16.434Z"
    },
    "transactionDetails": [
      {
        "id": 1,
        "block_number": "22968491",
        "from_address": "0x85ac393addd65bcf6ab0999f2a5c064e867f255f",
        "to_address": "0x3153972890cbd9fcdbbf1b4a52a1e66c954ae59c",
        "value": "165961747453927070",
        "gas": "21000",
        "gas_price": "4532376825",
        "max_fee_per_gas": "1000000000000",
        "nonce": 11182,
        "transaction_index": 126,
        "chain_id": 1,
        "block_hash": "0x597c95a4cc4044b0872d44487e065654eac355d5e11a457f82a4a76bc5f86adf",
        "raw_json": { /* complete etherscan response */ }
      }
    ]
  }
}
```

## Configuration

### Environment Variables
```bash
# Etherscan API Configuration
ETHERSCAN_API_KEY=your_api_key_here
ETHERSCAN_TIMEOUT_MS=30000
ETHERSCAN_RETRY_ATTEMPTS=3

# Cache Configuration
CACHE_TTL_SECONDS=600
```

### API Limits
- **Rate Limiting**: 100 requests per 15 minutes (configurable)
- **Timeout**: 30 seconds per request
- **Retry Logic**: Exponential backoff with 3 attempts

## Benefits

### 1. Universal Coverage
- Captures data for ALL transaction types (transfers, smart contracts, etc.)
- No longer limited to internal transactions only

### 2. Rich Data
- Comprehensive gas pricing information
- Block-level metadata
- Network identification (chain ID)
- Complete transaction context

### 3. Reliability
- Robust error handling and retry logic
- Atomic database operations
- Comprehensive logging and monitoring

### 4. Performance
- Intelligent caching reduces API calls
- Indexed database queries for fast retrieval
- Optimized data structures

## Monitoring and Observability

### Logs
- API request/response logging
- Error tracking with context
- Performance metrics
- Cache hit/miss ratios

### Metrics
- Transaction processing success rate
- API response times
- Database operation performance
- Error frequency by type

## Future Enhancements

1. **Multi-chain Support**: Extend to other blockchain networks
2. **Real-time Updates**: WebSocket integration for live transaction monitoring
3. **Advanced Analytics**: Pattern recognition and fraud detection
4. **Enhanced Caching**: Redis integration for distributed caching
