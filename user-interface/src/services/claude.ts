import axios from 'axios';

export async function analyzeIncidentWithClaude(prompt: string): Promise<{ summary: string; content: string; success: boolean }> {
  const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
  const API_KEY = process.env.CLAUDE_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Claude API key not configured');
  }
  
  try {
    const res = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-3-opus-20240229', // Opus 3 model
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        timeout: 120000 // 2 minutes timeout
      }
    );

    console.log('Claude API raw response:', JSON.stringify(res.data, null, 2));
    
    const content = res.data.content?.[0]?.text || '';
    console.log('Extracted content length:', content.length);
    
    return {
      summary: content,
      content: content,
      success: true
    };
  } catch (err: any) {
    console.error('Claude API error after', Date.now() - Date.now(), 'ms:', err);
    
    // Handle specific error cases
    if (err.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    } else if (err.response?.status === 529) {
      // Server overload - provide a fallback response
      console.log('Claude API server overload (529), using fallback response');
      return {
        summary: 'Executive Summary:\n\nDue to high server load, the AI analysis is temporarily unavailable. The incident has been processed and the fund flow mapping is available below. Please try again in a few minutes for a detailed AI analysis.',
        content: 'Executive Summary:\n\nDue to high server load, the AI analysis is temporarily unavailable. The incident has been processed and the fund flow mapping is available below. Please try again in a few minutes for a detailed AI analysis.',
        success: false
      };
    } else if (err.response?.status >= 500) {
      // Other server errors - provide a fallback response
      console.log('Claude API server error, using fallback response');
      return {
        summary: 'Executive Summary:\n\nTechnical difficulties prevented AI analysis generation. The incident data has been processed and the fund flow mapping is available below. Please try again later for a detailed AI analysis.',
        content: 'Executive Summary:\n\nTechnical difficulties prevented AI analysis generation. The incident data has been processed and the fund flow mapping is available below. Please try again later for a detailed AI analysis.',
        success: false
      };
    } else {
      throw new Error(`Claude API error: ${err.message || 'Unknown error'}`);
    }
  }
} 