import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incident_id, analysis_data } = body;

    if (!incident_id || !analysis_data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Clean and validate the incident ID
    const cleanIncidentId = incident_id.trim();
    
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanIncidentId)) {
      return NextResponse.json({ error: 'Invalid incident ID format' }, { status: 400 });
    }

    // Generate a new analysis ID
    const analysisId = uuidv4();

    // Store the analysis data
    const result = await pool.query(
      'INSERT INTO analysis (id, incident_id, analysis_data, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
      [analysisId, cleanIncidentId, JSON.stringify(analysis_data)]
    );

    console.log('Analysis stored successfully with ID:', analysisId);

    return NextResponse.json({ 
      id: analysisId,
      message: 'Analysis stored successfully' 
    });

  } catch (error: any) {
    console.error('Error storing analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to store analysis data' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id');
    const incidentId = searchParams.get('incident_id');
    const listAll = searchParams.get('list');

    // If list=true, return all analyses
    if (listAll === 'true') {
      const result = await pool.query(
        'SELECT id, incident_id, created_at FROM analysis ORDER BY created_at DESC'
      );
      return NextResponse.json(result.rows);
    }

    // If incident_id is provided, return analyses for that incident
    if (incidentId) {
      const cleanIncidentId = incidentId.trim();
      
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(cleanIncidentId)) {
        return NextResponse.json({ error: 'Invalid incident ID format' }, { status: 400 });
      }

      const result = await pool.query(
        'SELECT * FROM analysis WHERE incident_id = $1 ORDER BY created_at DESC',
        [cleanIncidentId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'No analyses found for this incident' }, { status: 404 });
      }

      // Return all analyses for this incident
      return NextResponse.json(result.rows.map(analysis => ({
        id: analysis.id,
        incident_id: analysis.incident_id,
        analysis_data: analysis.analysis_data,
        created_at: analysis.created_at
      })));
    }

    // If analysisId is provided, return specific analysis
    if (analysisId) {
      const result = await pool.query(
        'SELECT * FROM analysis WHERE id = $1',
        [analysisId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
      }

      const analysis = result.rows[0];
      return NextResponse.json({
        id: analysis.id,
        incident_id: analysis.incident_id,
        analysis_data: analysis.analysis_data,
        created_at: analysis.created_at
      });
    }

    // If no parameters provided, return error
    return NextResponse.json({ 
      error: 'Please provide either analysis ID, incident ID, or list=true parameter' 
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error retrieving analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve analysis data' 
    }, { status: 500 });
  }
} 