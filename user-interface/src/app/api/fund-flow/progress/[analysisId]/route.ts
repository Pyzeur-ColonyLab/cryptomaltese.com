import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ analysisId: string }> }
) {
    try {
        const { analysisId } = await params;
        
        if (!analysisId) {
            return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
        }
        
        // This would typically fetch progress from database
        // For now, return mock progress data
        const mockProgress = {
            analysisId,
            status: 'running' as const,
            progress: Math.floor(Math.random() * 100),
            currentStep: 'Analyzing transaction paths',
            estimatedTimeRemaining: '2-3 minutes',
            details: {
                addressesAnalyzed: Math.floor(Math.random() * 1000),
                pathsDiscovered: Math.floor(Math.random() * 500),
                patternsDetected: Math.floor(Math.random() * 10)
            }
        };
        
        return NextResponse.json(mockProgress);
        
    } catch (error) {
        console.error('Failed to get analysis progress:', error);
        return NextResponse.json({ 
            error: 'Failed to get analysis progress',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 