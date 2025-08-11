import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { getEvmTransactionDetails } from '@/services/etherscan';
import { getBitcoinTransactionDetails } from '@/services/bitcoin';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  avalanche: 43114,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Fetch incident from DB
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    const incident = result.rows[0];
    const { tx_hash, chain } = incident;
    let txDetails: any = null;
    if (chain === 'ethereum' || chain === 'avalanche') {
      const chainId = CHAIN_IDS[chain];
      txDetails = await getEvmTransactionDetails(tx_hash, chainId);
    } else if (chain === 'bitcoin') {
      txDetails = await getBitcoinTransactionDetails(tx_hash);
    } else {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
    }
    return NextResponse.json({ transaction: txDetails });
  } catch (err: any) {
    console.error('Error in /api/incident/[id]/data:', err);
    return NextResponse.json({ error: 'Failed to fetch transaction data' }, { status: 500 });
  }
} 