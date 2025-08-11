import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { getEvmTransactionDetails } from '@/services/etherscan';
import { getBitcoinTransactionDetails } from '@/services/bitcoin';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  avalanche: 43114,
};

export async function POST(req: NextRequest) {
  const { wallet_address, chain, description, discovered_at, tx_hash } = await req.json();
  if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address) && chain !== 'bitcoin') {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }
  if (!['ethereum', 'avalanche', 'bitcoin'].includes(chain)) {
    return NextResponse.json({ error: 'Unsupported chain.' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
  }
  if (!discovered_at) {
    return NextResponse.json({ error: 'Discovery date/time is required.' }, { status: 400 });
  }
  if (!tx_hash) {
    return NextResponse.json({ error: 'Transaction hash is required.' }, { status: 400 });
  }
  try {
    // 1. Insert incident
    const result = await pool.query(
      `INSERT INTO incidents (wallet_address, chain, description, discovered_at, tx_hash, created_at, report_status)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'pending')
       RETURNING id`,
      [wallet_address, chain, description, discovered_at, tx_hash]
    );
    const incident_id = result.rows[0].id;
    // 2. Fetch and store transaction/token data
    let txData = null;
    let blockNumber = null;
    if (chain === 'ethereum' || chain === 'avalanche') {
      const chainId = CHAIN_IDS[chain];
      txData = await getEvmTransactionDetails(tx_hash, chainId);
      if (txData && txData.info && txData.info.blockNumberDecimal) {
        blockNumber = txData.info.blockNumberDecimal;
        await pool.query(
          'UPDATE incidents SET block_number = $1 WHERE id = $2',
          [blockNumber, incident_id]
        );
      }
    } else if (chain === 'bitcoin') {
      txData = await getBitcoinTransactionDetails(tx_hash);
    }
    await pool.query(
      `INSERT INTO incident_data (incident_id, data, created_at)
       VALUES ($1, $2, NOW())`,
      [incident_id, JSON.stringify(txData)]
    );
    return NextResponse.json({ incident_id });
  } catch (err) {
    console.error('DB insert error:', err);
    return NextResponse.json({ error: 'Failed to save incident.' }, { status: 500 });
  }
} 