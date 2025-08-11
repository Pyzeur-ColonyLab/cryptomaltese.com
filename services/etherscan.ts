import axios from 'axios';

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_API_URL = 'https://api.etherscan.io/v2/api';

/**
 * Fetch EVM transactions for a given address and chainId (Ethereum: 1, Avalanche: 43114)
 */
export async function getEvmTransactions(address: string, chainId: number): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY not set');
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
  const res = await axios.get(url);
  if (res.data.status !== '1') throw new Error(res.data.message || 'Failed to fetch transactions');
  return res.data.result;
} 