import { NextRequest, NextResponse } from 'next/server';
import { FundFlowTracker } from '@/services/fund-flow/tracker';
import { PatternDetector } from '@/services/fund-flow/pattern-detector';
import { AddressClassifier } from '@/services/fund-flow/address-classifier';
import { PathAnalyzer } from '@/services/fund-flow/path-analyzer';
import { EndpointDetector } from '@/services/fund-flow/endpoint-detector';
import { getIncidentById } from '@/db/queries';

export async function POST(req: NextRequest) {
    try {
        const { incidentId, enableAIAnalysis = true } = await req.json();
        
        if (!incidentId) {
            return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
        }
        
        // Get incident details
        const incident = await getIncidentById(incidentId);
        if (!incident) {
            return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
        }
        
        // Initialize services
        const patternDetector = new PatternDetector();
        const addressClassifier = new AddressClassifier();
        const pathAnalyzer = new PathAnalyzer();
        const endpointDetector = new EndpointDetector();
        
        // Initialize tracker with real Etherscan service
        const { getEvmTransactions } = await import('@/services/etherscan');
        
        // Create a real Etherscan service wrapper
        const etherscanService = {
            async getTransactions(address: string, timestamp: Date) {
                return await getEvmTransactions(address, 1);
            },
            async getOutgoingTransactions(address: string) {
                return await getEvmTransactions(address, 1);
            }
        };
        
        const tracker = new FundFlowTracker(
            etherscanService,
            patternDetector,
            addressClassifier,
            pathAnalyzer
        );
        
        // Start async analysis
        const analysisPromise = tracker.analyzeIncident(
            incidentId,
            incident.wallet_address,
            '0', // lossAmount placeholder
            new Date(incident.discovered_at),
            { 
                maxDepth: 6, 
                highVolumeThreshold: 5000,
                enableAIClassification: enableAIAnalysis
            }
        );
        
        // Don't await - return immediately with analysis ID
        const analysisId = await tracker.createAnalysisRecord(incidentId, incident.wallet_address, '0', new Date(incident.discovered_at));
        
        // Process in background
        analysisPromise.catch(error => {
            console.error('Analysis failed:', error);
            // Update analysis status to failed
        });
        
        return NextResponse.json({ 
            analysisId,
            status: 'started',
            message: 'Enhanced fund flow analysis started'
        });
        
    } catch (error) {
        console.error('Fund flow analysis failed:', error);
        return NextResponse.json({ 
            error: 'Analysis failed',
            details: error instanceof Error ? error.message : 'Unknown error'
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
        
        // This would typically fetch analysis results from database
        // For now, return placeholder response
        return NextResponse.json({
            analysisId,
            status: 'completed',
            progress: 100,
            message: 'Analysis completed successfully'
        });
        
    } catch (error) {
        console.error('Failed to get analysis status:', error);
        return NextResponse.json({ 
            error: 'Failed to get analysis status',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 