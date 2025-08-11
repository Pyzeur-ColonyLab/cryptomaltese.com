import { NextRequest, NextResponse } from 'next/server';
import { analyzeIncidentWithClaude } from '@/services/claude';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      console.error('Claude API: No prompt provided');
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('Claude API called with prompt length:', prompt.length);
    console.log('Claude API prompt preview:', prompt.substring(0, 200) + '...');
    
    const result = await analyzeIncidentWithClaude(prompt);
    
    console.log('Claude API response received:');
    console.log('- Summary length:', result.summary?.length || 0);
    console.log('- Content length:', result.content?.length || 0);
    console.log('- Summary preview:', result.summary?.substring(0, 100) + '...');
    console.log('- Content preview:', result.content?.substring(0, 100) + '...');
    
    return NextResponse.json({
      summary: result.summary,
      content: result.content,
      success: true
    });
  } catch (error: any) {
    console.error('Claude API error:', error);
    console.error('Claude API error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Failed to analyze with Claude',
      summary: 'Executive summary generation failed due to technical error.',
      content: 'Executive summary generation failed due to technical error.'
    }, { status: 500 });
  }
} 