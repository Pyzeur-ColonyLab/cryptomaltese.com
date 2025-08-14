import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { analysis_id, progress, status, results, error_message } = await req.json();
        
        if (!analysis_id) {
            return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
        }

        // Update database with progress
        await updateAnalysisProgress(analysis_id, {
            status,
            progress_data: progress,
            results_data: results,
            error_message,
            completed_at: status === 'completed' || status === 'failed' ? new Date() : null
        });

        // Log microservice communication
        await logMicroserviceCommunication(analysis_id, 'python-algorithm', status, {
            progress,
            results,
            error_message
        });

        // Optional: Send real-time updates to frontend via WebSocket
        // await sendProgressToFrontend(analysis_id, progress);

        return NextResponse.json({ 
            status: 'received',
            message: `Progress update for analysis ${analysis_id} received`
        });
        
    } catch (error) {
        console.error('Failed to process progress update:', error);
        return NextResponse.json({ 
            error: 'Failed to process progress update' 
        }, { status: 500 });
    }
}

async function updateAnalysisProgress(analysisId: number, data: any) {
    // This would be implemented in your database queries
    // For now, just logging
    console.log(`Updating analysis ${analysisId} with:`, data);
}

async function logMicroserviceCommunication(analysisId: number, serviceName: string, action: string, data: any) {
    // This would be implemented in your database queries
    // For now, just logging
    console.log(`Microservice log: ${serviceName} ${action} for analysis ${analysisId}:`, data);
} 