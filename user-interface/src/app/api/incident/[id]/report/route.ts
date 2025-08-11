import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { analyzeIncidentWithClaude } from '@/services/claude';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  avalanche: 43114,
};

function extractSummaryFromAI(aiResult: any): string {
  if (aiResult && aiResult.content && Array.isArray(aiResult.content)) {
    const textObj = aiResult.content.find((c: any) => c.type === 'text');
    if (textObj && textObj.text) {
      // Try to extract JSON block
      const jsonMatch = textObj.text.match(/JSON Output:\n({[\s\S]*?})\n/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.natural_language_summary) return parsed.natural_language_summary;
          if (parsed.executive_summary) return parsed.executive_summary;
        } catch {}
      }
      // Fallback: extract 'summary:' line
      const summaryMatch = textObj.text.match(/summary\s*[:=]\s*"([^"]+)"/i);
      if (summaryMatch) return summaryMatch[1];
      // Fallback: extract 'Natural Language Summary' section
      const nlsMatch = textObj.text.match(/Natural Language Summary:\n([\s\S]*)/);
      if (nlsMatch) return nlsMatch[1].trim();
      return textObj.text.trim();
    }
  }
  return 'No summary found.';
}

function extractAIJson(aiResult: any): any {
  if (aiResult && aiResult.content && Array.isArray(aiResult.content)) {
    const textObj = aiResult.content.find((c: any) => c.type === 'text');
    if (textObj && textObj.text) {
      const jsonMatch = textObj.text.match(/JSON Output:\n({[\s\S]*?})\n/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {}
      }
    }
  }
  return null;
}

// Helper to get value in ETH or top ERC-20
function getMainLoss(txData: any, victim: string) {
  // ETH loss
  let ethLoss = 0;
  if (txData.info && txData.info.from && txData.info.from.toLowerCase() === victim.toLowerCase()) {
    ethLoss = Number(txData.info.valueEth || 0);
  }
  // ERC-20 loss
  let topToken = null;
  let topTokenLoss = 0;
  if (txData.erc20Transfers && Array.isArray(txData.erc20Transfers)) {
    for (const t of txData.erc20Transfers) {
      if (t.from && t.from.toLowerCase() === victim.toLowerCase()) {
        const val = Number(t.valueDecimal || 0);
        if (val > topTokenLoss) {
          topTokenLoss = val;
          topToken = t;
        }
      }
    }
  }
  if (topTokenLoss > ethLoss) {
    return { type: 'erc20', token: topToken, value: topTokenLoss };
  } else {
    return { type: 'eth', value: ethLoss };
  }
}

async function getEvmTransactionsAllTypes(address: string, chainId: number, startblock: number = 0) {
  const { getEvmTransactions } = await import('@/services/etherscan');
  // Normal transactions
  const normal = await getEvmTransactions(address, chainId, startblock);
  // For now, we'll use empty arrays for internal and erc20 since those functions don't exist
  const internal: any[] = [];
  const erc20: any[] = [];
  return { normal, internal, erc20 };
}

// Simple function to generate basic mapping data
function generateBasicMappingData(txData: any, victimAddress: string) {
  const nodes = [{ name: victimAddress, type: 'victim' }];
  const links: any[] = [];
  const detailedTransactions: any[] = [];
  
  // Extract basic transaction information
  if (txData.info && txData.info.to) {
    nodes.push({ name: txData.info.to, type: 'destination' });
    links.push({
      source: 0,
      target: 1,
      value: Number(txData.info.valueEth || 0),
      hash: txData.info.hash
    });
    detailedTransactions.push({
      from: victimAddress,
      to: txData.info.to,
      value: Number(txData.info.valueEth || 0),
      hash: txData.info.hash,
      type: 'eth',
      timestamp: txData.info.timeStamp ? new Date(Number(txData.info.timeStamp) * 1000).toISOString() : new Date().toISOString()
    });
  }
  
  // Extract ERC-20 transfers
  if (txData.erc20Transfers && Array.isArray(txData.erc20Transfers)) {
    txData.erc20Transfers.forEach((transfer: any, index: number) => {
      if (transfer.from && transfer.to) {
        const fromIndex = nodes.findIndex(n => n.name === transfer.from);
        const toIndex = nodes.findIndex(n => n.name === transfer.to);
        
        if (fromIndex === -1) {
          nodes.push({ name: transfer.from, type: 'intermediary' });
        }
        if (toIndex === -1) {
          nodes.push({ name: transfer.to, type: 'destination' });
        }
        
        const finalFromIndex = nodes.findIndex(n => n.name === transfer.from);
        const finalToIndex = nodes.findIndex(n => n.name === transfer.to);
        
        links.push({
          source: finalFromIndex,
          target: finalToIndex,
          value: Number(transfer.valueDecimal || 0),
          hash: transfer.hash,
          token: transfer.tokenSymbol
        });
        
        detailedTransactions.push({
          from: transfer.from,
          to: transfer.to,
          value: Number(transfer.valueDecimal || 0),
          hash: transfer.hash,
          token: transfer.tokenSymbol,
          type: 'erc20',
          timestamp: transfer.timeStamp ? new Date(Number(transfer.timeStamp) * 1000).toISOString() : new Date().toISOString()
        });
      }
    });
  }

  // If no transactions were found, create at least one basic transaction from the raw data
  if (detailedTransactions.length === 0) {
    console.log('No detailed transactions found, creating basic transaction from raw data');
    
    // Create a basic transaction from the main transaction data
    if (txData.info) {
      detailedTransactions.push({
        from: victimAddress,
        to: txData.info.to || 'Unknown',
        value: Number(txData.info.valueEth || txData.info.value || 0),
        hash: txData.info.hash || txData.hash || 'N/A',
        type: 'eth',
        timestamp: txData.info.timeStamp ? new Date(Number(txData.info.timeStamp) * 1000).toISOString() : new Date().toISOString()
      });
    }
    
    // Also add any internal transactions
    if (txData.internal && Array.isArray(txData.internal)) {
      txData.internal.forEach((internal: any, index: number) => {
        detailedTransactions.push({
          from: internal.from || 'Unknown',
          to: internal.to || 'Unknown',
          value: Number(internal.value || 0),
          hash: internal.hash || 'N/A',
          type: 'internal',
          timestamp: internal.timeStamp ? new Date(Number(internal.timeStamp) * 1000).toISOString() : new Date().toISOString()
        });
      });
    }
  }

  console.log(`Generated ${detailedTransactions.length} detailed transactions for PDF table`);
  
  return {
    nodes: nodes.map((node, idx) => ({ ...node, key: node.name || idx })),
    links: links.map((link, idx) => ({ ...link, key: `${link.source}-${link.target}-${link.value}-${idx}` })),
    detailedTransactions,
    mainLoss: getMainLoss(txData, victimAddress)
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return await generateReport(req, { params }, null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  return await generateReport(req, { params }, body);
}

async function generateReport(req: NextRequest, { params }: { params: Promise<{ id: string }> }, body: any) {
  const { id } = await params;
  
  try {
    console.log('Starting report generation for incident:', id);
    
    // Get incident data
    const incidentResult = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (incidentResult.rows.length === 0) {
      console.log('Incident not found:', id);
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    const incident = incidentResult.rows[0];
    console.log('Incident data retrieved:', incident.id);

    // Get transaction data
    console.log('Fetching transaction data...');
    const txDataResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/incident/${id}/data`);
    if (!txDataResponse.ok) {
      console.error('Failed to fetch transaction data:', txDataResponse.status, txDataResponse.statusText);
      return NextResponse.json({ error: 'Failed to fetch transaction data' }, { status: 500 });
    }
    const txData = await txDataResponse.json();
    console.log('Transaction data retrieved');

    // Get mapping data (this contains the transactions used in the Sankey diagram)
    console.log('Fetching mapping data...');
    const mappingResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/incident/${id}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: id })
    });
    if (!mappingResponse.ok) {
      console.error('Failed to fetch mapping data:', mappingResponse.status, mappingResponse.statusText);
      return NextResponse.json({ error: 'Failed to fetch mapping data' }, { status: 500 });
    }
    const mappingData = await mappingResponse.json();
    console.log('Mapping data retrieved, detailedTransactions:', mappingData.detailedTransactions?.length || 0);
    console.log('Mapping data structure:', {
      hasCombinedFlow: !!mappingData.combinedFlow,
      combinedFlowNodes: mappingData.combinedFlow?.nodes?.length || 0,
      combinedFlowLinks: mappingData.combinedFlow?.links?.length || 0,
      hasDetailedTransactions: !!mappingData.detailedTransactions,
      detailedTransactionsCount: mappingData.detailedTransactions?.length || 0
    });
    
    // Generate executive summary
    console.log('Generating executive summary...');
    let executiveSummary = 'Executive summary generation failed.';
    
    if (mappingData.detailedTransactions && mappingData.detailedTransactions.length > 0) {
      console.log('Sending', mappingData.detailedTransactions.length, 'transactions to Claude API');
      try {
        const claudeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/claude`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Please analyze this blockchain incident and provide a clear executive summary.

INCIDENT DETAILS:
- Victim Address: ${incident.wallet_address}
- Transaction Hash: ${incident.tx_hash}
- Chain: ${incident.chain}
- Discovery Date: ${incident.discovered_at}

TRANSACTION DATA:
${JSON.stringify(mappingData.detailedTransactions, null, 2)}

Please provide a professional executive summary suitable for a forensic report, focusing on:
1. What happened (brief description)
2. Key findings from the transaction analysis
3. Potential security implications

Keep the summary clear and concise.`
          })
        });
        
        console.log('Claude API response status:', claudeResponse.status);
        
        if (claudeResponse.ok) {
          const claudeResult = await claudeResponse.json();
          console.log('Claude API response structure:', Object.keys(claudeResult));
          executiveSummary = claudeResult.summary || claudeResult.content || 'Executive summary generated but empty.';
          console.log('Executive summary generated successfully, length:', executiveSummary.length);
        } else {
          console.error('Claude API response not ok:', claudeResponse.status, claudeResponse.statusText);
          const errorText = await claudeResponse.text();
          console.error('Claude API error response:', errorText);
          executiveSummary = 'Executive summary generation failed due to API error.';
        }
      } catch (claudeError) {
        console.error('Claude API error:', claudeError);
        executiveSummary = 'Executive summary generation failed due to network error.';
      }
    } else {
      console.log('No detailed transactions available for executive summary');
      executiveSummary = 'No transaction data available for executive summary generation.';
    }

    // Create PDF
    console.log('Creating PDF document...');
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]);
    
    // Embed fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
    
    // PDF generation variables
    let y = 800;
    const left = 40;
    const maxWidth = 515;
    const fontSize = 10;

    // Helper functions
    function wrapText(text: any, font: any, size: number, maxWidth: number): string[] {
      // Ensure text is a string and replace newlines with spaces
      const textString = String(text || '').replace(/\n/g, ' ').replace(/\r/g, ' ');
      const words = textString.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        
        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Word is too long for one line, split it
            lines.push(word);
          }
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return lines;
    }

    function drawText(text: any, options: any = {}) {
      try {
        const {
          font = regularFont,
          size = 12,
          color = rgb(0, 0, 0),
          lineHeight = 14,
          maxWidth = page.getWidth() - 80
        } = options;
        
        // Ensure text is a string and handle null/undefined
        const textString = String(text || '');
        if (!textString.trim()) {
          y -= lineHeight;
          return;
        }
        
        const lines = wrapText(textString, font, size, maxWidth);
        
        lines.forEach(line => {
          if (y < 50) {
            page = pdfDoc.addPage([595, 842]);
            y = 800;
          }
          page.drawText(line, {
            x: 40,
            y,
            size,
            font,
            color,
          });
          y -= lineHeight;
        });
      } catch (error) {
        console.error('Error in drawText:', error, 'Text:', text);
        // Fallback: just move down and continue
        y -= 14;
      }
    }

    function drawSectionTitle(title: string, startY: number) {
      y = startY;
      if (y < 60) { y = 800; page = pdfDoc.addPage([595, 842]); }
      page.drawText(title, { 
        x: left, 
        y, 
        size: 16, 
        font: boldFont, 
        color: rgb(0.2,0.2,0.7) 
      });
      y -= 20;
      return y;
    }

    // Function to draw transaction table from mapping data
    function drawTransactionTable(transactions: any[], startY: number) {
      y = startY;
      
      // Table headers
      const headers = ['#', 'From', 'To', 'Value', 'Type', 'Tx Hash', 'Time'];
      const columnWidths = [25, 110, 110, 70, 50, 90, 60];
      const columnStarts = [left];
      
      // Calculate column starting positions
      for (let i = 1; i < columnWidths.length; i++) {
        columnStarts.push(columnStarts[i-1] + columnWidths[i-1] + 3);
      }
      
      let currentPage = 1;
      let rowIndex = 0;
      const rowsPerPage = 25;
      
      // Draw header row
      headers.forEach((header, index) => {
        if (y < 50) {
          page = pdfDoc.addPage([595, 842]);
          y = 800;
          currentPage++;
          
          // Add page header for continuation
          page.drawText(`Page ${currentPage} - TRANSACTION TABLE (continued)`, {
            x: left,
            y: 820,
            size: 10,
            font: boldFont,
            color: rgb(0.1,0.1,0.5)
          });
          y -= 20;
        }
        page.drawText(String(header || ''), { 
          x: columnStarts[index], 
          y, 
          size: 9, 
          font: boldFont, 
          color: rgb(0.1,0.1,0.5) 
        });
      });
      y -= 15;
      
      // Draw separator line
      page.drawLine({
        start: { x: left, y },
        end: { x: left + 510, y },
        thickness: 1,
        color: rgb(0.7,0.7,0.7)
      });
      y -= 10;
      
      // Draw transaction rows
      transactions.forEach((transaction, index) => {
        // Check if we need a new page
        if (y < 50 || rowIndex >= rowsPerPage) {
          page = pdfDoc.addPage([595, 842]);
          y = 800;
          currentPage++;
          rowIndex = 0;
          
          // Add page header for continuation
          page.drawText(`Page ${currentPage} - TRANSACTION TABLE (continued)`, {
            x: left,
            y: 820,
            size: 10,
            font: boldFont,
            color: rgb(0.1,0.1,0.5)
          });
          y -= 20;
          
          // Redraw headers on new page
          headers.forEach((header, headerIndex) => {
            page.drawText(String(header || ''), { 
              x: columnStarts[headerIndex], 
              y, 
              size: 9, 
              font: boldFont, 
              color: rgb(0.1,0.1,0.5) 
            });
          });
          y -= 15;
          
          // Draw separator line on new page
          page.drawLine({
            start: { x: left, y },
            end: { x: left + 510, y },
            thickness: 1,
            color: rgb(0.7,0.7,0.7)
          });
          y -= 10;
        }
        
        // Format timestamp
        let timeDisplay = 'N/A';
        if (transaction.timestamp) {
          try {
            const date = new Date(transaction.timestamp);
            timeDisplay = date.toLocaleDateString() + ' ' + date.toLocaleTimeString().substring(0, 5);
          } catch {
            timeDisplay = transaction.timestamp.substring(0, 10);
          }
        }
        
        // Format value
        let valueDisplay = 'N/A';
        if (transaction.value && transaction.value !== 'N/A') {
          const numValue = parseFloat(transaction.value);
          if (!isNaN(numValue)) {
            if (numValue >= 1) {
              valueDisplay = numValue.toFixed(2);
            } else if (numValue >= 0.001) {
              valueDisplay = numValue.toFixed(6);
            } else {
              valueDisplay = numValue.toExponential(2);
            }
          }
        }
        
        const rowData = [
          `${index + 1}`,
          transaction.from ? String(transaction.from).substring(0, 8) + '...' : 'Unknown',
          transaction.to ? String(transaction.to).substring(0, 8) + '...' : 'Unknown',
          valueDisplay,
          transaction.type || 'ETH',
          transaction.hash ? String(transaction.hash).substring(0, 8) + '...' : 'N/A',
          timeDisplay
        ];
        
        rowData.forEach((cell, cellIndex) => {
          // Use our safe drawText function instead of page.drawText directly
          const cellText = String(cell || '');
          page.drawText(cellText, { 
            x: columnStarts[cellIndex], 
            y, 
            size: 8, 
            font: regularFont, 
            color: rgb(0.2,0.2,0.2) 
          });
        });
        
        y -= 12;
        rowIndex++;
      });
      
      // Add page footer with summary
      const totalPages = currentPage;
      page.drawText(`Total Transactions: ${transactions.length} | Pages: ${totalPages}`, {
        x: left,
        y: 30,
        size: 8,
        font: regularFont,
        color: rgb(0.4,0.4,0.4)
      });
      
      return y;
    }

    // Function to draw nodes and links list
    function drawNodesAndLinksList(page: any, font: any, startY: number) {
      let currentY = startY;
      const leftMargin = 50;
      const rightMargin = 550;
      const lineHeight = 16;
      const sectionSpacing = 20;
      
      // Draw section title
      page.drawText('NODES AND LINKS LIST', {
        x: leftMargin,
        y: currentY,
        size: 14,
        font: font,
        color: rgb(0, 0, 0)
      });
      currentY -= lineHeight * 1.5;
      
      // Draw nodes section
      page.drawText('NODES:', {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      currentY -= lineHeight;
      
      if (mappingData?.combinedFlow?.nodes && Array.isArray(mappingData.combinedFlow.nodes)) {
        mappingData.combinedFlow.nodes.forEach((node: any, index: number) => {
          const nodeText = `${index + 1}. ${node.name || 'Unknown'} (${node.value || 0} ETH)`;
          const lines = wrapText(nodeText, font, 10, rightMargin - leftMargin);
          
          lines.forEach(line => {
            if (currentY < 50) {
              page = pdfDoc.addPage([595, 842]);
              currentY = 800;
            }
            page.drawText(line, {
              x: leftMargin + 20,
              y: currentY,
              size: 10,
              font: font,
              color: rgb(0, 0, 0)
            });
            currentY -= lineHeight;
          });
        });
      } else {
        page.drawText('No nodes available', {
          x: leftMargin + 20,
          y: currentY,
          size: 10,
          font: font,
          color: rgb(0.5, 0.5, 0.5)
        });
        currentY -= lineHeight;
      }
      
      currentY -= sectionSpacing;
      
      // Draw links section
      page.drawText('LINKS:', {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      currentY -= lineHeight;
      
      if (mappingData?.combinedFlow?.links && Array.isArray(mappingData.combinedFlow.links)) {
        mappingData.combinedFlow.links.forEach((link: any, index: number) => {
          const sourceNode = mappingData.combinedFlow.nodes[link.source];
          const targetNode = mappingData.combinedFlow.nodes[link.target];
          const linkText = `${index + 1}. ${sourceNode?.name || 'Unknown'} -> ${targetNode?.name || 'Unknown'} (${link.value || 0} ETH)`;
          const lines = wrapText(linkText, font, 10, rightMargin - leftMargin);
          
          lines.forEach(line => {
            if (currentY < 50) {
              page = pdfDoc.addPage([595, 842]);
              currentY = 800;
            }
            page.drawText(line, {
              x: leftMargin + 20,
              y: currentY,
              size: 10,
              font: font,
              color: rgb(0, 0, 0)
            });
            currentY -= lineHeight;
          });
        });
      } else {
        page.drawText('No links available', {
          x: leftMargin + 20,
          y: currentY,
          size: 10,
          font: font,
          color: rgb(0.5, 0.5, 0.5)
        });
        currentY -= lineHeight;
      }
      
      return currentY;
    }

    // 1. TITLE
    drawText('COMPREHENSIVE WEB3 HACK EVIDENCE REPORT', { size: 22, color: rgb(0.2,0.2,0.7), lineHeight: 32, font: boldFont });
    y -= 8;

    // 2. INCIDENT INFORMATION
    y = drawSectionTitle('INCIDENT INFORMATION', y);
    drawText(`Incident ID: ${incident.id}`);
    drawText(`Victim Wallet: ${incident.wallet_address}`);
    drawText(`Transaction Hash: ${incident.tx_hash}`);
    drawText(`Chain: ${incident.chain}`);
    drawText(`Discovery Date: ${incident.discovered_at}`);
    if (incident.block_number) {
      drawText(`Block Number: ${incident.block_number}`);
    }
    y -= 8;

    // 3. EMBEDDED DIAGRAM (Sankey diagram)
    y = drawSectionTitle('EMBEDDED DIAGRAM', y);
    
    // Try to embed the actual Sankey diagram PNG
    try {
      console.log('Attempting to embed Sankey diagram PNG...');
      
      // Use PNG data URL from request body if available
      const pngDataUrl = body?.pngDataUrl || mappingData.pngDataUrl;
      
      if (pngDataUrl) {
        // Extract base64 from data URL
        const base64 = pngDataUrl.split(',')[1];
        const pngBytes = Buffer.from(base64, 'base64');
        
        // Embed the PNG in the PDF
        const sankeyImage = await pdfDoc.embedPng(pngBytes);
        const sankeyDims = sankeyImage.scale(0.8);
        
        // Center the image
        const imageX = (page.getWidth() - sankeyDims.width) / 2;
        const imageY = y - sankeyDims.height;
        
        page.drawImage(sankeyImage, {
          x: imageX,
          y: imageY,
          width: sankeyDims.width,
          height: sankeyDims.height,
        });
        
        y = imageY - 20;
        console.log('Sankey diagram PNG embedded successfully');
      } else {
        console.log('No PNG data URL available, falling back to text representation');
        throw new Error('Sankey PNG not available');
      }
    } catch (error) {
      console.log('Falling back to text representation of Sankey diagram');
      
      // Fallback to text representation
      if (mappingData.combinedFlow && mappingData.combinedFlow.nodes && mappingData.combinedFlow.nodes.length > 0) {
        // Draw Sankey diagram representation
        drawText('Fund Flow Mapping (Sankey Diagram)', { font: boldFont });
        y -= 8;
        
        // Draw nodes
        drawText('Nodes:', { font: boldFont, lineHeight: 12 });
        mappingData.combinedFlow.nodes.forEach((node: any, index: number) => {
          const nodeText = `${index + 1}. ${node.name || 'Unknown'}`;
          drawText(nodeText, { lineHeight: 10 });
        });
        y -= 8;
        
        // Draw links
        if (mappingData.combinedFlow.links && mappingData.combinedFlow.links.length > 0) {
          drawText('Fund Flows:', { font: boldFont, lineHeight: 12 });
          mappingData.combinedFlow.links.forEach((link: any, index: number) => {
            const sourceNode = mappingData.combinedFlow.nodes[link.source];
            const targetNode = mappingData.combinedFlow.nodes[link.target];
            const flowText = `${sourceNode?.name || 'Unknown'} -> ${targetNode?.name || 'Unknown'}: ${link.value?.toFixed(6) || '0'} ETH`;
            drawText(flowText, { lineHeight: 10 });
          });
        }
      } else {
        drawText('No Sankey diagram data available.', { lineHeight: 12 });
        drawText('The fund flow mapping could not be generated.', { lineHeight: 12 });
      }
    }
    y -= 8;

    // 4. NODES AND LINKS LIST
    if (mappingData?.combinedFlow?.nodes && Array.isArray(mappingData.combinedFlow.nodes) && mappingData.combinedFlow.nodes.length > 0) {
      console.log('Generating nodes and links list with', mappingData.combinedFlow.nodes.length, 'nodes and', mappingData.combinedFlow.links?.length || 0, 'links');
      y = drawSectionTitle('NODES AND LINKS LIST', y);
      
      // Nodes and links statistics
      const totalNodes = mappingData.combinedFlow.nodes.length;
      const totalLinks = mappingData.combinedFlow.links?.length || 0;
      
      drawText(`Total Nodes: ${totalNodes}`, { font: boldFont });
      drawText(`Total Links: ${totalLinks}`, { lineHeight: 12 });
      y -= 8;
      
      // Draw nodes and links list
      y = drawNodesAndLinksList(page, regularFont, y);
      console.log('Nodes and links list generated successfully');
    } else {
      console.log('No nodes and links available for list generation');
      y = drawSectionTitle('NODES AND LINKS LIST', y);
      drawText('No nodes and links data available from the Sankey diagram.', { lineHeight: 12 });
      drawText('This may indicate that the mapping process did not generate flow data.', { lineHeight: 12 });
      y -= 8;
    }

    // 5. EXECUTIVE SUMMARY
    y = drawSectionTitle('EXECUTIVE SUMMARY', y);
    
    // Ensure executive summary is a valid string
    const summaryText = typeof executiveSummary === 'string' ? executiveSummary : 'Executive summary not available.';
    console.log('Drawing executive summary, length:', summaryText.length);
    
    drawText(summaryText, { 
      font: regularFont, 
      size: 11, 
      lineHeight: 13,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 8;

    // Add legal disclaimer
    y -= 16;
    drawText('DISCLAIMER: This report is generated automatically and is for informational purposes only. All analysis should be verified by qualified blockchain forensics experts before use in legal proceedings.', { size: 9, color: rgb(0.4,0.4,0.4), lineHeight: 12 });
    
    console.log('PDF generation completed, saving document...');
    const pdfBytes = await pdfDoc.save();
    console.log('PDF saved successfully, size:', pdfBytes.length);
    
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comprehensive-incident-${id}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/incident/[id]/report:', err);
    console.error('Error stack:', err.stack);
    return NextResponse.json({ error: 'Failed to generate PDF report' }, { status: 500 });
  }
} 

// Fallback analysis functions for when Claude API is unavailable
function generateFallbackAnalysis(incident: any, txData: any, mappingData: any) {
  const totalLoss = calculateTotalLoss(txData);
  const mainLoss = getMainLoss(txData, incident.wallet_address);
  
  return {
    executive_summary: `Blockchain incident analysis for ${incident.chain} transaction ${incident.tx_hash}. Victim address: ${incident.wallet_address}. Total estimated loss: ${totalLoss.toFixed(4)} ETH.`,
    total_loss_eth: totalLoss,
    total_loss_usd: totalLoss * 2500, // Approximate USD value
    attack_vector: "Analysis indicates potential security breach or unauthorized transaction",
    detailed_timeline: [
      {
        event: "Initial transaction detected",
        timestamp: incident.created_at,
        value: mainLoss?.value || 0,
        description: "Primary loss transaction identified"
      }
    ],
    fund_flow_analysis: {
      key_intermediaries: mappingData?.nodes?.slice(0, 5) || [],
      final_destinations: mappingData?.nodes?.slice(-3) || [],
      flow_complexity: mappingData?.nodes?.length || 0
    },
    suspicious_indicators: [
      "Large value transfer",
      "Multiple intermediary addresses",
      "Complex fund flow pattern"
    ],
    technical_forensics: {
      smart_contract_analysis: "Transaction analysis completed",
      blockchain_data: "EVM transaction data processed",
      fund_tracking: "Multi-layer fund flow mapping generated"
    },
    law_enforcement_intelligence: {
      suspect_addresses: mappingData?.nodes?.slice(1, -1) || [],
      investigation_steps: [
        "Trace fund flow through identified addresses",
        "Monitor destination addresses for further activity",
        "Cross-reference with known malicious addresses"
      ],
      evidence_preservation: "All transaction data preserved for investigation"
    },
    risk_assessment: {
      recovery_likelihood: "low",
      risk_level: "high",
      immediate_actions: [
        "Freeze affected accounts if possible",
        "Report to relevant authorities",
        "Monitor for additional suspicious activity"
      ]
    },
    compliance_requirements: {
      sar_triggers: ["Large value transfer", "Suspicious fund flow"],
      reporting_obligations: ["File SAR if threshold exceeded"],
      regulatory_considerations: ["AML/KYC compliance review required"]
    },
    natural_language_summary: `This incident involves a ${incident.chain} transaction with hash ${incident.tx_hash} affecting address ${incident.wallet_address}. The total loss is approximately ${totalLoss.toFixed(4)} ETH ($${(totalLoss * 2500).toFixed(2)}). The fund flow analysis shows ${mappingData?.nodes?.length || 0} addresses involved in the transaction chain. Immediate investigation and reporting are recommended.`
  };
}

function generateBasicFallbackAnalysis(incident: any, txData: any) {
  const totalLoss = calculateTotalLoss(txData);
  
  return {
    executive_summary: `Basic incident analysis: ${incident.chain} transaction affecting ${incident.wallet_address}`,
    total_loss_eth: totalLoss,
    total_loss_usd: totalLoss * 2500,
    attack_vector: "Transaction analysis required",
    detailed_timeline: [
      {
        event: "Incident reported",
        timestamp: incident.created_at,
        value: totalLoss,
        description: "Initial incident detection"
      }
    ],
    fund_flow_analysis: {
      key_intermediaries: [],
      final_destinations: [],
      flow_complexity: 0
    },
    suspicious_indicators: ["Transaction analysis pending"],
    technical_forensics: {
      smart_contract_analysis: "Analysis pending",
      blockchain_data: "Data available for processing",
      fund_tracking: "Fund flow analysis required"
    },
    law_enforcement_intelligence: {
      suspect_addresses: [],
      investigation_steps: ["Complete transaction analysis", "Trace fund flow"],
      evidence_preservation: "Transaction data preserved"
    },
    risk_assessment: {
      recovery_likelihood: "unknown",
      risk_level: "medium",
      immediate_actions: ["Complete analysis", "Assess damage"]
    },
    compliance_requirements: {
      sar_triggers: ["Analysis required"],
      reporting_obligations: ["Determine if reporting required"],
      regulatory_considerations: ["Compliance review pending"]
    },
    natural_language_summary: `Basic analysis of ${incident.chain} incident. Total value: ${totalLoss.toFixed(4)} ETH. Full analysis requires API access.`
  };
}

function calculateTotalLoss(txData: any): number {
  if (!txData || !Array.isArray(txData)) return 0;
  
  return txData.reduce((total: number, tx: any) => {
    const value = parseFloat(tx.value || '0');
    return total + value;
  }, 0);
} 