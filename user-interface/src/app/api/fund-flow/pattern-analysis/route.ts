import { NextRequest, NextResponse } from 'next/server';
import { PatternDetector } from '@/services/fund-flow/pattern-detector';
import { getTransactionPaths } from '@/db/queries';

export async function POST(req: NextRequest) {
    try {
        const { analysisId } = await req.json();
        
        if (!analysisId) {
            return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
        }

        // Get transaction paths for the analysis (handle both UUID and numeric IDs)
        const paths = await getTransactionPaths(analysisId);
        
        if (!paths || paths.length === 0) {
            return NextResponse.json({ error: 'No transaction paths found for this analysis' }, { status: 404 });
        }

        // Initialize pattern detector
        const patternDetector = new PatternDetector();
        
        // Perform advanced pattern analysis
        const analysis = await patternDetector.performAdvancedAnalysis(paths);
        
        return NextResponse.json({
            success: true,
            analysis
        });
        
    } catch (error: any) {
        console.error('Pattern analysis failed:', error);
        return NextResponse.json({ 
            error: 'Pattern analysis failed', 
            details: error.message 
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

        // Get transaction paths for the analysis (handle both UUID and numeric IDs)
        const paths = await getTransactionPaths(analysisId);
        
        if (!paths || paths.length === 0) {
            return NextResponse.json({ error: 'No transaction paths found for this analysis' }, { status: 404 });
        }

        // Initialize pattern detector
        const patternDetector = new PatternDetector();
        
        // Get basic pattern detection
        const patterns = await patternDetector.analyzeAllPaths(paths);
        
        return NextResponse.json({
            success: true,
            patterns,
            totalPaths: paths.length
        });
        
    } catch (error: any) {
        console.error('Pattern detection failed:', error);
        return NextResponse.json({ 
            error: 'Pattern detection failed', 
            details: error.message 
        }, { status: 500 });
    }
} 