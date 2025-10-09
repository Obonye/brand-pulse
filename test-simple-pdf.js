// Test simplified PDF generation
const puppeteer = require('puppeteer');

const sampleData = {
  totalMentions: 1234,
  sentimentPositive: 856,
  sentimentNegative: 123,
  sentimentNeutral: 255,
  sentimentPositivePercent: 69,
  sentimentNegativePercent: 10,
  sentimentNeutralPercent: 21,
  avgSentimentConfidence: 0.85,
  aiGeneratedOverview: 'This is a test AI-generated overview showing positive brand sentiment trends.',
  topTopics: [
    { topic: 'Product Quality', count: 234 },
    { topic: 'Customer Service', count: 189 },
    { topic: 'Pricing', count: 156 }
  ],
  topSourceTypes: [
    { source_type: 'Twitter', count: 456 },
    { source_type: 'Facebook', count: 345 },
    { source_type: 'Instagram', count: 234 }
  ]
};

const metadata = {
  title: 'Test Trend Analysis Report',
  subtitle: 'Generated for PDF testing',
  dateRange: '2024-01-01 to 2024-01-31',
  generatedAt: new Date().toISOString(),
  confidenceThreshold: 70,
  recommendations: [
    'Monitor negative sentiment trends closely',
    'Increase engagement on positive topics',
    'Address high-priority issues within 24 hours'
  ],
  actions: [
    'Deploy crisis communication strategy',
    'Enhance social media monitoring',
    'Implement proactive customer service'
  ]
};

function generateSimpleReportHtml(reportType, data, metadata) {
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);
  const formatPercent = (num) => `${Math.round(num)}%`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title} - BrandPulse Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6; color: #333; background: #fff; font-size: 14px;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 30px; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 30px; margin-bottom: 40px; }
        .title { font-size: 32px; font-weight: 700; color: #1e40af; margin-bottom: 8px; }
        .subtitle { font-size: 18px; color: #64748b; margin-bottom: 16px; }
        .meta { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;
                border-top: 1px solid #e5e7eb; padding-top: 16px; }
        .section { margin-bottom: 40px; }
        .section-title { font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px;
                        padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                  gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
                 padding: 20px; text-align: center; }
        .metric-value { font-size: 28px; font-weight: 700; color: #1e40af; margin-bottom: 4px; }
        .metric-label { font-size: 12px; color: #64748b; font-weight: 500; text-transform: uppercase; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .neutral { color: #6b7280; }
        .insight { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px;
                  padding: 16px; margin: 16px 0; color: #1e40af; font-style: italic; }
        .list { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .list h4 { color: #1f2937; margin-bottom: 12px; }
        .list ul { list-style: none; padding: 0; }
        .list li { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px;
                  padding: 12px; margin-bottom: 8px; }
        .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 40px;
                 font-size: 11px; color: #6b7280; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">${metadata.title}</h1>
            <p class="subtitle">${metadata.subtitle || ''}</p>
            <div class="meta">
                <span>Report Period: ${metadata.dateRange}</span>
                <span>Generated: ${new Date(metadata.generatedAt).toLocaleDateString()}</span>
                <span>BrandPulse AI Reports</span>
            </div>
        </header>

        <main>
            <div class="section">
                <h2 class="section-title">Trend Analysis Overview</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">${formatNumber(data.totalMentions || 0)}</div>
                        <div class="metric-label">Total Mentions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value positive">${formatPercent(data.sentimentPositivePercent || 0)}</div>
                        <div class="metric-label">Positive Sentiment</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value negative">${formatPercent(data.sentimentNegativePercent || 0)}</div>
                        <div class="metric-label">Negative Sentiment</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value neutral">${formatPercent(data.sentimentNeutralPercent || 0)}</div>
                        <div class="metric-label">Neutral Sentiment</div>
                    </div>
                </div>
                <div class="insight"><strong>${data.aiGeneratedOverview}</strong></div>
            </div>

            <div class="section">
                <h2 class="section-title">Top Topics</h2>
                <div class="list">
                    <ul>
                        ${data.topTopics.map(topic => `<li>${topic.topic}: <strong>${topic.count} mentions</strong></li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">AI Recommendations</h2>
                <div class="list">
                    <h4>Key Insights</h4>
                    <ul>
                        ${metadata.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
                <div class="list">
                    <h4>Recommended Actions</h4>
                    <ul>
                        ${metadata.actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </main>

        <footer class="footer">
            <p>This report was generated by BrandPulse AI Reports system. Data quality filtered with ${metadata.confidenceThreshold}% minimum confidence threshold.</p>
            <p>© 2024 BrandPulse. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
}

async function testSimplePdfGeneration() {
  console.log('🧪 Testing simplified PDF generation...\n');

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      timeout: 30000
    });

    const page = await browser.newPage();

    // Generate HTML using our simplified approach
    const html = generateSimpleReportHtml('trend-analysis', sampleData, metadata);

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Additional wait to ensure content is fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '1in',
        right: '0.75in',
        bottom: '1in',
        left: '0.75in'
      },
      printBackground: true,
      timeout: 30000
    });

    await page.close();
    await browser.close();

    console.log('✅ Simplified PDF generation test passed!');
    console.log(`✅ Generated PDF size: ${pdfBuffer.length} bytes`);

    // Save test PDF file
    const fs = require('fs');
    fs.writeFileSync('simplified-test-report.pdf', pdfBuffer);
    console.log('✅ Test PDF saved as simplified-test-report.pdf');

    return true;
  } catch (error) {
    console.error('❌ Simplified PDF generation test failed:', error.message);
    return false;
  }
}

// Run the test
testSimplePdfGeneration()
  .then(success => {
    console.log(success ? '\n🎉 PDF generation is now working!' : '\n❌ PDF generation still has issues');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });