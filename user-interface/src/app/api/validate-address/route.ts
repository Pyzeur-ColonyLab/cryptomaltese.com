import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'bsc', 'arbitrum'];

export async function POST(req: NextRequest) {
  const { address, chain } = await req.json();
  if (!address || typeof address !== 'string') {
    return NextResponse.json({ valid: false, error: 'Address is required.' });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ valid: false, error: 'Invalid wallet address format.' });
  }
  if (!SUPPORTED_CHAINS.includes(chain)) {
    return NextResponse.json({ valid: false, error: 'Unsupported chain.' });
  }
  // If all checks pass
  return NextResponse.json({ valid: true });
} 