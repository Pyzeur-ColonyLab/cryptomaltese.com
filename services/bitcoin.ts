import axios from 'axios';

const BLOCKSTREAM_API_URL = 'https://blockstream.info/api';

/**
 * Fetch Bitcoin transactions for a given address using Blockstream public API
 */
export async function getBitcoinTransactions(address: string): Promise<any[]> {
  const url = `${BLOCKSTREAM_API_URL}/address/${address}/txs`;
  const res = await axios.get(url);
  return res.data;
} 