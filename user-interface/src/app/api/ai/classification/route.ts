import { NextRequest, NextResponse } from 'next/server';
import { ClassificationCache } from '@/services/ai/classification-cache';

const classificationCache = new ClassificationCache();

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');
        const address = searchParams.get('address');
        
        switch (action) {
            case 'stats':
                const stats = await classificationCache.getCacheStats();
                return NextResponse.json({
                    success: true,
                    stats
                });
                
            case 'get':
                if (!address) {
                    return NextResponse.json({ error: 'Address parameter required' }, { status: 400 });
                }
                const classification = await classificationCache.getClassification(address);
                return NextResponse.json({
                    success: true,
                    classification
                });
                
            case 'list':
                const keys = await classificationCache.getCacheKeys();
                return NextResponse.json({
                    success: true,
                    keys
                });
                
            case 'size':
                const size = await classificationCache.getCacheSize();
                return NextResponse.json({
                    success: true,
                    size
                });
                
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Classification API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { action, address, classification, confidence, reasoning, riskLevel, keyIndicators, transactionCount } = await req.json();
        
        switch (action) {
            case 'set':
                if (!address || !classification) {
                    return NextResponse.json({ error: 'Address and classification required' }, { status: 400 });
                }
                
                await classificationCache.setClassification(
                    address,
                    classification,
                    confidence || 0.8,
                    reasoning || 'Manual classification',
                    riskLevel || 'medium',
                    keyIndicators || [],
                    transactionCount || 0
                );
                
                return NextResponse.json({
                    success: true,
                    message: 'Classification cached successfully'
                });
                
            case 'update':
                if (!address) {
                    return NextResponse.json({ error: 'Address required' }, { status: 400 });
                }
                
                await classificationCache.updateClassification(address, {
                    classification,
                    confidence,
                    reasoning,
                    riskLevel,
                    keyIndicators,
                    transactionCount
                });
                
                return NextResponse.json({
                    success: true,
                    message: 'Classification updated successfully'
                });
                
            case 'invalidate':
                if (!address) {
                    return NextResponse.json({ error: 'Address required' }, { status: 400 });
                }
                
                await classificationCache.invalidateClassification(address);
                
                return NextResponse.json({
                    success: true,
                    message: 'Classification invalidated successfully'
                });
                
            case 'clear':
                await classificationCache.clearCache();
                
                return NextResponse.json({
                    success: true,
                    message: 'Cache cleared successfully'
                });
                
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Classification API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const address = searchParams.get('address');
        
        if (!address) {
            return NextResponse.json({ error: 'Address parameter required' }, { status: 400 });
        }
        
        const removed = await classificationCache.removeCacheEntry(address);
        
        return NextResponse.json({
            success: true,
            removed,
            message: removed ? 'Classification removed successfully' : 'Classification not found'
        });
    } catch (error: any) {
        console.error('Classification API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
} 