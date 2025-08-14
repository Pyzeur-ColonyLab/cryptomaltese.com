# Python Algorithm Microservice

This is the Python microservice that handles the fund flow analysis algorithm for Crypto-Sentinel.

## Architecture

The service provides a REST API that:
1. Receives analysis requests from the Next.js frontend
2. Runs the fund flow algorithm in the background
3. Sends progress updates back to the frontend
4. Returns final results when complete

## Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables:**
   ```bash
   export ETHERSCAN_API_KEY=your_key_here
   export DATABASE_URL=postgresql://user:pass@localhost:5432/db
   ```

3. **Run the service:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## API Endpoints

- `POST /analyze-fund-flow` - Start a new fund flow analysis
- `GET /health` - Health check endpoint
- `GET /status/{analysis_id}` - Get analysis status

## Development

The service is designed to be stateless and can be scaled horizontally. Each analysis request is processed independently. 