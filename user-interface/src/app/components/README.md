# Circular Link Prevention Components

This directory contains components and utilities to prevent circular links in Sankey diagrams, which cause the "Error: circular link" crash.

## Components

### 1. `CircularLinkPrevention.tsx`
Core utility functions that detect and remove circular links from Sankey data.

**Functions:**
- `preventCircularLinks(data)` - Full cycle detection using DFS
- `simpleCircularLinkPrevention(data)` - Fast cycle prevention by tracking visited addresses
- `enhancedCircularLinkPrevention(data)` - Sophisticated cycle prevention with path tracking
- `validateSankeyData(data)` - Validate Sankey data structure

### 2. `SafeSankey.tsx`
A drop-in replacement for `ResponsiveSankey` that automatically prevents circular links.

**Props:**
- `data` - Your Sankey data
- `method` - Prevention method: 'simple', 'enhanced', or 'full'
- `showWarnings` - Show warnings about removed links
- `onDataProcessed` - Callback when data is processed
- All other props are passed through to ResponsiveSankey

### 3. `SafeSankey.module.css`
Styling for the SafeSankey component warnings and errors.

## Usage

### Replace ResponsiveSankey with SafeSankey

```tsx
// Before (crashes with circular links)
import { ResponsiveSankey } from '@nivo/sankey';

<ResponsiveSankey data={sankeyData} />

// After (automatically prevents crashes)
import SafeSankey from './components/SafeSankey';

<SafeSankey 
  data={sankeyData}
  method="enhanced"
  showWarnings={true}
  onDataProcessed={(result) => {
    if (result.cycleCount > 0) {
      console.log(`${result.cycleCount} circular links removed`);
    }
  }}
/>
```

### Use Circular Link Prevention Directly

```tsx
import { preventCircularLinks } from './components/CircularLinkPrevention';

// Process your data before passing to Sankey
const safeData = preventCircularLinks(sankeyData);

// Now use with regular ResponsiveSankey
<ResponsiveSankey data={safeData.data} />
```

## Prevention Methods

### 1. Simple Method
- Fastest approach
- Tracks visited addresses
- Prevents any target from being visited twice
- Good for most use cases

### 2. Enhanced Method (Default)
- More sophisticated cycle detection
- Tracks path relationships
- Prevents complex cycles
- Better for complex fund flow scenarios

### 3. Full Method
- Complete cycle detection using DFS
- Most thorough but slower
- Use for critical applications

## What Gets Removed

The prevention algorithms remove:
- **Self-loops**: Address A → Address A
- **Direct cycles**: Address A → Address B → Address A
- **Complex cycles**: Address A → Address B → Address C → Address A
- **Bidirectional flows**: Address A ↔ Address B

## Example Output

When circular links are detected and removed:

```
⚠️ Removed 3 circular links to prevent rendering errors.
View removed links
• 0x123... → 0x456... (Would create cycle)
• 0x456... → 0x789... (Would create cycle)  
• 0x789... → 0x123... (Would create cycle)
```

## Testing

Run the test file to verify the prevention logic:

```bash
npx tsx CircularLinkPrevention.test.ts
```

## Integration

The components are already integrated into:
- `Analyse.tsx` - Main analysis interface
- `Mapping.tsx` - Fund flow mapping interface

## Benefits

1. **Prevents Crashes**: No more "Error: circular link" crashes
2. **Preserves Data**: Removes only problematic links
3. **User Feedback**: Shows warnings about removed links
4. **Drop-in Replacement**: Easy to swap existing components
5. **Multiple Methods**: Choose prevention strategy based on needs

## Troubleshooting

If you still see circular link errors:

1. Check that you're using `SafeSankey` instead of `ResponsiveSankey`
2. Verify your data structure matches the expected format
3. Check the browser console for warnings about removed links
4. Use the `onDataProcessed` callback to monitor what's being removed

## Data Format

Your Sankey data should have this structure:

```tsx
{
  nodes: [
    { id: 'address1' },
    { id: 'address2' },
    // ...
  ],
  links: [
    { source: 'address1', target: 'address2', value: 100 },
    // ...
  ]
}
``` 