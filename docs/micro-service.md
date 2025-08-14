# Simple Architecture Overview

## Current vs Target Architecture

### **Current Architecture (What You Have Now)**
```
┌─────────────────────────────────────────────────────────┐
│                 CryptoMaltese App                       │
├─────────────────────────────────────────────────────────┤
│  Next.js Frontend  →  Node.js API  →  PostgreSQL       │
│     (React)           (TypeScript)      (Database)     │
└─────────────────────────────────────────────────────────┘
```

### **Target Architecture (With Python Microservice)**
```
┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App    │    │  Python Service  │    │   PostgreSQL    │
│   (Frontend)     │    │   (Algorithm)    │    │   (Database)    │
├──────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • User Interface │◄──►│ • Fund Flow      │◄──►│ • Incidents     │
│ • Progress UI    │    │   Algorithm      │    │ • Analysis      │
│ • Visualization  │    │ • Block Filtering│    │ • Results       │
│ • Reports        │    │ • AI Integration │    │ • Cache         │
└──────────────────┘    └──────────────────┘    └─────────────────┘
```

## Simple Communication Flow

### **Step-by-Step Process:**

1. **User starts analysis** in your Next.js app
2. **Next.js API** receives request → stores in PostgreSQL → calls Python service
3. **Python service** runs algorithm → sends progress updates → returns results
4. **Next.js app** updates UI with progress → displays final results

## What You Need to Adapt in Your Current App

### **1. Modify Your API Routes**

**Current**: `user-interface/src/app/api/fund-flow/analyze/route.ts`
```typescript
// OLD WAY - Algorithm runs in Node.js
export async function POST(req: NextRequest) {
    // Run algorithm directly in Node.js
    const result = await runFundFlowAnalysis(data);
    return NextResponse.json(result);
}
```

**New**: Same file, but calls Python service
```typescript
// NEW WAY - Algorithm runs in Python microservice
export async function POST(req: NextRequest) {
    const { incidentId, config } = await req.json();
    
    // 1. Store analysis request in database
    const analysisId = await createAnalysisRecord(incidentId, config);
    
    // 2. Call Python microservice
    const pythonResponse = await fetch('http://python-service:8000/analyze-fund-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            analysis_id: analysisId,
            incident_data: await getIncidentData(incidentId),
            algorithm_config: config
        })
    });
    
    // 3. Return immediately (Python runs in background)
    return NextResponse.json({ analysisId, status: 'started' });
}
```

### **2. Add Progress Tracking**

**New file**: `user-interface/src/app/api/fund-flow/progress-update/route.ts`
```typescript
// Python service calls this to send progress updates
export async function POST(req: NextRequest) {
    const { analysis_id, progress } = await req.json();
    
    // Update database with progress
    await updateAnalysisProgress(analysis_id, progress);
    
    // Optional: Send real-time updates to frontend via WebSocket
    await sendProgressToFrontend(analysis_id, progress);
    
    return NextResponse.json({ status: 'received' });
}
```

### **3. Update Your Frontend Components**

**Current**: `user-interface/src/app/analysis/AnalysisComponent.tsx`
```typescript
// OLD WAY - Wait for complete result
const [result, setResult] = useState(null);

const runAnalysis = async () => {
    const response = await fetch('/api/fund-flow/analyze');
    const result = await response.json(); // Complete result
    setResult(result);
};
```

**New**: Same component with progress tracking
```typescript
// NEW WAY - Track progress, get result when complete
const [result, setResult] = useState(null);
const [progress, setProgress] = useState(null);
const [isRunning, setIsRunning] = useState(false);

const runAnalysis = async () => {
    setIsRunning(true);
    
    // Start analysis
    const response = await fetch('/api/fund-flow/analyze');
    const { analysisId } = await response.json();
    
    // Poll for progress
    const interval = setInterval(async () => {
        const progressResponse = await fetch(`/api/fund-flow/progress/${analysisId}`);
        const progressData = await progressResponse.json();
        
        setProgress(progressData.progress);
        
        if (progressData.status === 'completed') {
            clearInterval(interval);
            setResult(progressData.results);
            setIsRunning(false);
        }
    }, 3000); // Check every 3 seconds
};
```

### **4. Add New Database Tables**

**File**: `db/schema.sql` (add these tables)
```sql
-- Track analysis requests and progress
CREATE TABLE fund_flow_analysis (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    progress_data JSONB,
    results_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

## Deployment Setup

### **Development Environment**
```yaml
# docker-compose.yml
version: '3.8'
services:
  # Your existing app
  nextjs-app:
    build: ./user-interface
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - python-algorithm

  # New Python microservice  
  python-algorithm:
    build: ./python-service
    ports:
      - "8000:8000"
    environment:
      - ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY}
    depends_on:
      - postgres

  # Your existing database
  postgres:
    image: postgres:15
    # ... your existing config
```

### **Simple File Structure**
```
cryptomaltese.com/
├── user-interface/          # Your existing Next.js app
│   ├── src/app/api/         # Modified API routes
│   └── src/components/      # Modified components
├── python-service/          # New Python microservice
│   ├── main.py             # FastAPI app
│   ├── algorithm/          # Algorithm code
│   └── requirements.txt    # Python dependencies
├── db/                     # Your existing database
│   └── schema.sql          # Add new tables
└── docker-compose.yml      # Run both services
```

## Migration Strategy

### **Phase 1**: Prepare Your App 
1. Add new database tables
2. Modify API routes to prepare for microservice calls
3. Update frontend components for progress tracking
4. Test with mock Python service responses

### **Phase 2**: Build Python Service 
1. Create basic FastAPI service
2. Implement simple algorithm endpoint
3. Test communication between services

### **Phase 3**: Full Integration 
1. Complete algorithm implementation in Python
2. Full end-to-end testing
3. Deploy both services together

## Key Benefits

### **For Your Current App:**
- **Minimal changes** - mostly just API route modifications
- **Better performance** - algorithm runs separately, doesn't block UI
- **Progress tracking** - users see real-time updates
- **Easier maintenance** - algorithm logic separated from business logic

### **For Development:**
- **Team can work separately** on algorithm vs web app
- **Algorithm can be developed/tested independently**
- **Easy to scale** algorithm service separately if needed

