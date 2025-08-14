import { NextRequest, NextResponse } from 'next/server';
import { createFundFlowAnalysis, updateFundFlowAnalysisStatus } from '@/db/queries';

export async function POST(req: NextRequest) {
    try {
        const { incidentId, config } = await req.json();
        
        // Validate request
        if (!incidentId) {
            return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
        }

        // Create analysis record in database
        const analysisId = await createFundFlowAnalysis(
            incidentId,
            '0x0000000000000000000000000000000000000000', // Will be updated by Python service
            '0',
            new Date(),
            config?.maxDepth || 6
        );

        // Update status to running
        await updateFundFlowAnalysisStatus(analysisId, 'running');

        // Call Python microservice
        const pythonResponse = await fetch('http://python-service:8000/analyze-fund-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analysis_id: analysisId,
                incident_id: incidentId,
                algorithm_config: config || {}
            })
        });

        if (!pythonResponse.ok) {
            throw new Error(`Python service error: ${pythonResponse.statusText}`);
        }

        const pythonResult = await pythonResponse.json();

        // Return immediately (Python runs in background)
        return NextResponse.json({ 
            analysisId, 
            status: 'started',
            pythonServiceId: pythonResult.service_id,
            message: 'Analysis started in Python microservice'
        });
        
    } catch (error) {
        console.error('Failed to start fund flow analysis:', error);
        return NextResponse.json({ 
            error: 'Failed to start analysis' 
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const analysisId = searchParams.get('analysisId');
        
        if (!analysisId) {
            return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
        }

        // Get analysis status from database
        const analysis = await getFundFlowAnalysis(parseInt(analysisId));
        
        if (!analysis) {
            return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
        }

        return NextResponse.json({ analysis });
        
    } catch (error) {
        console.error('Failed to get analysis:', error);
        return NextResponse.json({ 
            error: 'Failed to get analysis' 
        }, { status: 500 });
    }
}

async function getFundFlowAnalysis(analysisId: number) {
    // This would be implemented in your database queries
    // For now, returning a mock response
    return {
        id: analysisId,
        status: 'running',
        progress: 0
    };
} 