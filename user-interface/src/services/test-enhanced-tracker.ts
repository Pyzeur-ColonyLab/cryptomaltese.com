import { 
  adaptiveBranchingStrategy, 
  assessAddressRisk, 
  detectPatterns, 
  detectCrossChainActivity,
  labelAddress,
  enhancedFlowAnalysis 
} from './enhanced-fund-tracker';

// Mock transaction data for testing
const mockTransactions = [
  {
    hash: '0x1234567890abcdef',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '1000000000000000000', // 1 ETH
    timeStamp: '1640995200', // 2022-01-01 00:00:00
    blockNumber: '13916166'
  },
  {
    hash: '0xabcdef1234567890',
    from: '0x2222222222222222222222222222222222222222',
    to: '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
    value: '500000000000000000', // 0.5 ETH
    timeStamp: '1640998800', // 2022-01-01 01:00:00
    blockNumber: '13916167'
  },
  {
    hash: '0x9876543210fedcba',
    from: '0x2222222222222222222222222222222222222222',
    to: '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance
    value: '500000000000000000', // 0.5 ETH
    timeStamp: '1641002400', // 2022-01-01 02:00:00
    blockNumber: '13916168'
  }
];

// Test adaptive branching strategy
function testAdaptiveBranchingStrategy() {
  console.log('Testing Adaptive Branching Strategy...');
  
  const totalOutflow = 1000000000000000000; // 1 ETH in wei
  const selected = adaptiveBranchingStrategy(mockTransactions, totalOutflow);
  
  console.log('Selected transactions:', selected.length);
  selected.forEach((selection, index) => {
    console.log(`  ${index + 1}. Confidence: ${selection.confidence_score.toFixed(3)}`);
    console.log(`     Flags: ${selection.reasoning_flags.join(', ')}`);
    console.log(`     Percentage: ${(selection.percentage_of_total * 100).toFixed(1)}%`);
  });
  
  return selected;
}

// Test address risk assessment
function testAddressRiskAssessment() {
  console.log('\nTesting Address Risk Assessment...');
  
  const risk = assessAddressRisk('0x2222222222222222222222222222222222222222', mockTransactions);
  
  console.log('Risk Assessment:');
  console.log(`  Address: ${risk.address}`);
  console.log(`  Risk Score: ${risk.risk_score}`);
  console.log(`  Risk Level: ${risk.risk_level}`);
  console.log('  Contributing Factors:');
  risk.contributing_factors.forEach(factor => {
    console.log(`    - ${factor.factor}: ${factor.score} points (${factor.details})`);
  });
  
  return risk;
}

// Test pattern detection
function testPatternDetection() {
  console.log('\nTesting Pattern Detection...');
  
  const patterns = detectPatterns(mockTransactions);
  
  console.log('Pattern Detection Results:');
  console.log(`  Peel Chain: ${patterns.peel_chain}`);
  console.log(`  Peel Chain Strength: ${patterns.peel_chain_strength.toFixed(3)}`);
  console.log(`  Round Number Frequency: ${(patterns.round_number_frequency * 100).toFixed(1)}%`);
  console.log(`  Rapid Turnover: ${patterns.rapid_turnover}`);
  console.log(`  Coordinated Movements: ${patterns.coordinated_movements}`);
  
  return patterns;
}

// Test cross-chain activity detection
function testCrossChainDetection() {
  console.log('\nTesting Cross-Chain Activity Detection...');
  
  const crossChainActivity = detectCrossChainActivity(mockTransactions);
  
  console.log('Cross-Chain Activity:');
  console.log(`  Bridge Transactions Found: ${crossChainActivity.length}`);
  crossChainActivity.forEach((activity, index) => {
    console.log(`  ${index + 1}. Bridge Type: ${activity.bridge_type}`);
    console.log(`     Destination Chains: ${activity.potential_destination_chains.join(', ')}`);
    console.log(`     Confidence: ${activity.confidence_score}`);
  });
  
  return crossChainActivity;
}

// Test address labeling
function testAddressLabeling() {
  console.log('\nTesting Address Labeling...');
  
  const addresses = [
    '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance
    '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a', // Arbitrum Bridge
    '0x1234567890123456789012345678901234567890'  // Unknown
  ];
  
  addresses.forEach(address => {
    const label = labelAddress(address);
    console.log(`  ${address}: ${label.category} (${label.confidence})`);
  });
}

// Test enhanced flow analysis (mocked)
async function testEnhancedFlowAnalysis() {
  console.log('\nTesting Enhanced Flow Analysis...');
  
  try {
    // Note: This would require actual API calls, so we'll just test the structure
    console.log('Enhanced flow analysis would be tested with real API calls');
    console.log('This test requires:');
    console.log('  - Valid Etherscan API key');
    console.log('  - Real incident data');
    console.log('  - Network connectivity');
    
    return null;
  } catch (error) {
    console.error('Error in enhanced flow analysis test:', error);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== Enhanced Fund Tracker Test Suite ===\n');
  
  try {
    testAdaptiveBranchingStrategy();
    testAddressRiskAssessment();
    testPatternDetection();
    testCrossChainDetection();
    testAddressLabeling();
    await testEnhancedFlowAnalysis();
    
    console.log('\n=== All Tests Completed Successfully ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for use in other test files
export {
  testAdaptiveBranchingStrategy,
  testAddressRiskAssessment,
  testPatternDetection,
  testCrossChainDetection,
  testAddressLabeling,
  testEnhancedFlowAnalysis,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
} 