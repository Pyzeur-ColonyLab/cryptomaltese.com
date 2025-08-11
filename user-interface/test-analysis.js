const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
  incidentId: '0febeeaf-6b51-4917-b97d-e9b3ed774c32',
  victimAddress: '0x85AC393adDd65bcf6Ab0999F2a5c064E867F255f',
  chain: 'ethereum',
  chainId: 1,
  startBlock: 22968491, // Block number from the incident
  maxDepth: 3
};

// Mock the analysis function to test Etherscan queries
async function testEtherscanQueries() {
  console.log('🔍 Testing Etherscan Queries for Analysis');
  console.log('==========================================');
  console.log(`Incident ID: ${TEST_CONFIG.incidentId}`);
  console.log(`Victim Address: ${TEST_CONFIG.victimAddress}`);
  console.log(`Start Block: ${TEST_CONFIG.startBlock}`);
  console.log(`Max Depth: ${TEST_CONFIG.maxDepth}`);
  console.log('');

  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'PX2BTACPYA6H4M6HV1EZJB7PAPFVJDVXT1';
  const ETHERSCAN_API_URL = 'https://api.etherscan.io/v2/api';

  // Test queries for the victim address
  console.log('📊 Testing Queries for Victim Address:');
  console.log('----------------------------------------');

  // 1. Normal transactions
  console.log('1. Normal Transactions:');
  const normalTxUrl = `${ETHERSCAN_API_URL}?chainid=${TEST_CONFIG.chainId}&module=account&action=txlist&address=${TEST_CONFIG.victimAddress}&startblock=${TEST_CONFIG.startBlock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log(`   URL: ${normalTxUrl}`);
  
  try {
    const normalResponse = await axios.get(normalTxUrl);
    console.log(`   Status: ${normalResponse.data.status}`);
    console.log(`   Message: ${normalResponse.data.message}`);
    console.log(`   Transactions found: ${normalResponse.data.result?.length || 0}`);
    
    if (normalResponse.data.result && normalResponse.data.result.length > 0) {
      console.log(`   First transaction: ${normalResponse.data.result[0].hash}`);
      console.log(`   Last transaction: ${normalResponse.data.result[normalResponse.data.result.length - 1].hash}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // 2. Internal transactions
  console.log('2. Internal Transactions:');
  const internalTxUrl = `${ETHERSCAN_API_URL}?chainid=${TEST_CONFIG.chainId}&module=account&action=txlistinternal&address=${TEST_CONFIG.victimAddress}&startblock=${TEST_CONFIG.startBlock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log(`   URL: ${internalTxUrl}`);
  
  try {
    const internalResponse = await axios.get(internalTxUrl);
    console.log(`   Status: ${internalResponse.data.status}`);
    console.log(`   Message: ${internalResponse.data.message}`);
    console.log(`   Internal transactions found: ${internalResponse.data.result?.length || 0}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // 3. ERC-20 transfers
  console.log('3. ERC-20 Transfers:');
  const erc20Url = `${ETHERSCAN_API_URL}?chainid=${TEST_CONFIG.chainId}&module=account&action=tokentx&address=${TEST_CONFIG.victimAddress}&startblock=${TEST_CONFIG.startBlock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log(`   URL: ${erc20Url}`);
  
  try {
    const erc20Response = await axios.get(erc20Url);
    console.log(`   Status: ${erc20Response.data.status}`);
    console.log(`   Message: ${erc20Response.data.message}`);
    console.log(`   ERC-20 transfers found: ${erc20Response.data.result?.length || 0}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // Test queries for the first recipient address
  const firstRecipient = '0x3153972890cbd9fcdbbf1b4a52a1e66c954ae59c';
  console.log('📊 Testing Queries for First Recipient:');
  console.log('----------------------------------------');
  console.log(`Address: ${firstRecipient}`);

  // 1. Normal transactions for first recipient
  console.log('1. Normal Transactions:');
  const recipientNormalUrl = `${ETHERSCAN_API_URL}?chainid=${TEST_CONFIG.chainId}&module=account&action=txlist&address=${firstRecipient}&startblock=${TEST_CONFIG.startBlock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log(`   URL: ${recipientNormalUrl}`);
  
  try {
    const recipientNormalResponse = await axios.get(recipientNormalUrl);
    console.log(`   Status: ${recipientNormalResponse.data.status}`);
    console.log(`   Message: ${recipientNormalResponse.data.message}`);
    console.log(`   Transactions found: ${recipientNormalResponse.data.result?.length || 0}`);
    
    if (recipientNormalResponse.data.result && recipientNormalResponse.data.result.length > 0) {
      console.log(`   First transaction: ${recipientNormalResponse.data.result[0].hash}`);
      console.log(`   Last transaction: ${recipientNormalResponse.data.result[recipientNormalResponse.data.result.length - 1].hash}`);
      
      // Show some sample transactions
      console.log('   Sample transactions:');
      recipientNormalResponse.data.result.slice(0, 3).forEach((tx, index) => {
        console.log(`     ${index + 1}. Hash: ${tx.hash}`);
        console.log(`        From: ${tx.from}`);
        console.log(`        To: ${tx.to}`);
        console.log(`        Value: ${tx.value} wei (${tx.value / 1e18} ETH)`);
        console.log(`        Block: ${tx.blockNumber}`);
        console.log(`        Timestamp: ${tx.timeStamp}`);
      });
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // 2. Internal transactions for first recipient
  console.log('2. Internal Transactions:');
  const recipientInternalUrl = `${ETHERSCAN_API_URL}?chainid=${TEST_CONFIG.chainId}&module=account&action=txlistinternal&address=${firstRecipient}&startblock=${TEST_CONFIG.startBlock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log(`   URL: ${recipientInternalUrl}`);
  
  try {
    const recipientInternalResponse = await axios.get(recipientInternalUrl);
    console.log(`   Status: ${recipientInternalResponse.data.status}`);
    console.log(`   Message: ${recipientInternalResponse.data.message}`);
    console.log(`   Internal transactions found: ${recipientInternalResponse.data.result?.length || 0}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // 3. ERC-20 transfers for first recipient
  console.log('3. ERC-20 Transfers:');
  const recipientErc20Url = `${ETHERSCAN_API_URL}?chainid=${TEST_CONFIG.chainId}&module=account&action=tokentx&address=${firstRecipient}&startblock=${TEST_CONFIG.startBlock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log(`   URL: ${recipientErc20Url}`);
  
  try {
    const recipientErc20Response = await axios.get(recipientErc20Url);
    console.log(`   Status: ${recipientErc20Response.data.status}`);
    console.log(`   Message: ${recipientErc20Response.data.message}`);
    console.log(`   ERC-20 transfers found: ${recipientErc20Response.data.result?.length || 0}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  console.log('✅ Etherscan Query Test Complete');
}

// Run the test
testEtherscanQueries().catch(console.error); 