import { NextRequest, NextResponse } from 'next/server';
import { analyzeIncidentWithClaude } from '@/services/claude';

export async function POST(req: NextRequest) {
    try {
        const { testPrompt } = await req.json();
        
        console.log('🧪 Testing Claude API with prompt:', testPrompt);
        
        const result = await analyzeIncidentWithClaude(testPrompt || 'Hello Claude, please respond with "API test successful"');
        
        console.log('✅ Claude API test result:', result);
        
        return NextResponse.json({
            success: true,
            result,
            message: 'Claude API test completed'
        });
    } catch (error: any) {
        console.error('❌ Claude API test failed:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            message: 'Claude API test failed'
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Claude API test endpoint. Use POST with { "testPrompt": "your test message" }'
    });
} 