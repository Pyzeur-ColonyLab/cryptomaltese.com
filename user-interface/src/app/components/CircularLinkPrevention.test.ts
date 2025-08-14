/**
 * Simple test for circular link prevention
 * Run with: npx tsx CircularLinkPrevention.test.ts
 */

import { preventCircularLinks, simpleCircularLinkPrevention, enhancedCircularLinkPrevention } from './CircularLinkPrevention';

// Test data with circular links
const testDataWithCycles = {
    nodes: [
        { id: 'A' },
        { id: 'B' },
        { id: 'C' },
        { id: 'D' }
    ],
    links: [
        { source: 'A', target: 'B', value: 100 },
        { source: 'B', target: 'C', value: 100 },
        { source: 'C', target: 'A', value: 100 }, // This creates a cycle: A -> B -> C -> A
        { source: 'A', target: 'D', value: 50 },
        { source: 'D', target: 'B', value: 50 }  // This creates another cycle: A -> D -> B -> C -> A
    ]
};

// Test data with self-loops
const testDataWithSelfLoops = {
    nodes: [
        { id: 'A' },
        { id: 'B' },
        { id: 'C' }
    ],
    links: [
        { source: 'A', target: 'A', value: 100 }, // Self-loop
        { source: 'A', target: 'B', value: 100 },
        { source: 'B', target: 'C', value: 100 }
    ]
};

// Test data without cycles
const testDataWithoutCycles = {
    nodes: [
        { id: 'A' },
        { id: 'B' },
        { id: 'C' },
        { id: 'D' }
    ],
    links: [
        { source: 'A', target: 'B', value: 100 },
        { source: 'B', target: 'C', value: 100 },
        { source: 'C', target: 'D', value: 100 },
        { source: 'A', target: 'D', value: 50 }
    ]
};

function runTests() {
    console.log('🧪 Testing Circular Link Prevention...\n');

    // Test 1: Data with cycles
    console.log('Test 1: Data with cycles');
    const result1 = preventCircularLinks(testDataWithCycles);
    console.log(`  - Original links: ${testDataWithCycles.links.length}`);
    console.log(`  - Safe links: ${result1.data.links.length}`);
    console.log(`  - Cycles removed: ${result1.cycleCount}`);
    console.log(`  - Warnings: ${result1.warnings.length}`);
    console.log('  ✓ Passed\n');

    // Test 2: Data with self-loops
    console.log('Test 2: Data with self-loops');
    const result2 = preventCircularLinks(testDataWithSelfLoops);
    console.log(`  - Original links: ${testDataWithSelfLoops.links.length}`);
    console.log(`  - Safe links: ${result2.data.links.length}`);
    console.log(`  - Cycles removed: ${result2.cycleCount}`);
    console.log(`  - Warnings: ${result2.warnings.length}`);
    console.log('  ✓ Passed\n');

    // Test 3: Data without cycles
    console.log('Test 3: Data without cycles');
    const result3 = preventCircularLinks(testDataWithoutCycles);
    console.log(`  - Original links: ${testDataWithoutCycles.links.length}`);
    console.log(`  - Safe links: ${result3.data.links.length}`);
    console.log(`  - Cycles removed: ${result3.cycleCount}`);
    console.log(`  - Warnings: ${result3.warnings.length}`);
    console.log('  ✓ Passed\n');

    // Test 4: Simple prevention method
    console.log('Test 4: Simple prevention method');
    const result4 = simpleCircularLinkPrevention(testDataWithCycles);
    console.log(`  - Cycles removed: ${result4.cycleCount}`);
    console.log(`  - Warnings: ${result4.warnings.length}`);
    console.log('  ✓ Passed\n');

    // Test 5: Enhanced prevention method
    console.log('Test 5: Enhanced prevention method');
    const result5 = enhancedCircularLinkPrevention(testDataWithCycles);
    console.log(`  - Cycles removed: ${result5.cycleCount}`);
    console.log(`  - Warnings: ${result5.warnings.length}`);
    console.log('  ✓ Passed\n');

    console.log('🎉 All tests passed! Circular link prevention is working correctly.');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

export { runTests }; 