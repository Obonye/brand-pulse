import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  scale?: number;
  quality?: number;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private browser: puppeteer.Browser | null = null;
  private browserInitialized = false;
  private browserInitializationFailed = false;

  constructor() {
    // Don't initialize browser in constructor to prevent startup crashes
    // Initialize on first use instead
  }

  /**
   * Initialize Puppeteer browser instance
   */
  private async initializeBrowser(): Promise<void> {
    if (this.browserInitialized || this.browserInitializationFailed) {
      return;
    }

    try {
      this.browser = await puppeteer.launch({
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
      this.browserInitialized = true;
      this.logger.log('Puppeteer browser initialized successfully');
    } catch (error) {
      this.browserInitializationFailed = true;
      this.logger.warn('Failed to initialize Puppeteer browser - PDF generation will be unavailable', error.message);
      // Don't throw error to prevent application crash
    }
  }

  /**
   * Generate PDF from report data
   */
  async generateReportPdf(
    reportType: string,
    reportData: any,
    metadata: {
      title: string;
      subtitle: string;
      dateRange: string;
      generatedAt: string;
      confidenceThreshold: number;
      recommendations?: string[];
      actions?: string[];
    },
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Check if PDF generation is available
      if (this.browserInitializationFailed) {
        throw new Error('PDF generation is not available - Puppeteer browser failed to initialize');
      }

      // Generate simple HTML directly
      const html = this.generateReportHtml(reportType, reportData, metadata);

      // Generate PDF from HTML
      return await this.generatePdfFromHtml(html, options);
    } catch (error) {
      this.logger.error(`Failed to generate PDF for report type: ${reportType}`, error);
      throw error;
    }
  }

  /**
   * Generate PDF from HTML string
   */
  async generatePdfFromHtml(html: string, options: PdfOptions = {}): Promise<Buffer> {
    // Initialize browser if not already done
    if (!this.browserInitialized && !this.browserInitializationFailed) {
      await this.initializeBrowser();
    }

    if (this.browserInitializationFailed || !this.browser) {
      throw new Error('PDF generation is not available - Puppeteer browser is not initialized');
    }

    let page: puppeteer.Page | null = null;

    try {
      page = await this.browser!.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 2
      });

      // Set content with proper encoding
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });

      // Wait for any dynamic content to load
      await page.evaluateHandle('document.fonts.ready');

      // Additional wait to ensure content is fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Configure PDF options
      const pdfOptions: puppeteer.PDFOptions = {
        format: options.format || 'A4',
        landscape: options.orientation === 'landscape',
        margin: options.margin || {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        },
        printBackground: true,
        scale: options.scale || 0.8,
        displayHeaderFooter: options.displayHeaderFooter || true,
        headerTemplate: options.headerTemplate || this.getDefaultHeaderTemplate(),
        footerTemplate: options.footerTemplate || this.getDefaultFooterTemplate(),
        timeout: 60000
      };

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);
      
      this.logger.log('PDF generated successfully');
      return pdfBuffer as Buffer;

    } catch (error) {
      this.logger.error('Failed to generate PDF from HTML', error);
      throw error;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * Generate multiple PDFs concurrently
   */
  async generateMultiplePdfs(
    requests: Array<{
      reportType: string;
      reportData: any;
      metadata: any;
      options?: PdfOptions;
    }>
  ): Promise<Buffer[]> {
    try {
      const pdfPromises = requests.map(request =>
        this.generateReportPdf(
          request.reportType,
          request.reportData,
          request.metadata,
          request.options
        )
      );

      return await Promise.all(pdfPromises);
    } catch (error) {
      this.logger.error('Failed to generate multiple PDFs', error);
      throw error;
    }
  }

  /**
   * Get default header template
   */
  private getDefaultHeaderTemplate(): string {
    return `
      <div style="font-size: 10px; padding: 5px 10px; width: 100%; border-bottom: 1px solid #e5e7eb;">
        <span style="float: left;">BrandPulse AI Report</span>
        <span style="float: right;">Generated: <span class="date"></span></span>
      </div>
    `;
  }

  /**
   * Get default footer template
   */
  private getDefaultFooterTemplate(): string {
    return `
      <div style="font-size: 10px; padding: 5px 10px; width: 100%; border-top: 1px solid #e5e7eb; text-align: center;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        <span style="float: right;">© 2024 BrandPulse. All rights reserved.</span>
      </div>
    `;
  }

  /**
   * Validate PDF generation requirements
   */
  async validatePdfRequirements(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Initialize browser if not already done
      if (!this.browserInitialized && !this.browserInitializationFailed) {
        await this.initializeBrowser();
      }

      if (this.browserInitializationFailed) {
        errors.push('Puppeteer browser failed to initialize - Chrome/Chromium not available');
        return { isValid: false, errors };
      }

      // Test basic PDF generation
      const testHtml = '<html><body><h1>Test</h1></body></html>';
      await this.generatePdfFromHtml(testHtml);

    } catch (error) {
      errors.push(`PDF generation test failed: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get PDF generation statistics
   */
  getStats(): {
    browserConnected: boolean;
    browserInitialized: boolean;
    browserInitializationFailed: boolean;
    memoryUsage: string;
    uptime: string;
  } {
    return {
      browserConnected: !!this.browser?.isConnected(),
      browserInitialized: this.browserInitialized,
      browserInitializationFailed: this.browserInitializationFailed,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      uptime: `${Math.round(process.uptime())}s`
    };
  }

  /**
   * Generate HTML for PDF reports without external template dependencies
   */
  private generateReportHtml(
    reportType: string,
    data: any,
    metadata: any
  ): string {
    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
    const formatPercent = (num: number) => `${Math.round(num)}%`;

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
                <h2 class="section-title">${this.formatReportTitle(reportType)} Overview</h2>
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
                ${data.aiGeneratedOverview ? `<div class="insight"><strong>${this.renderMarkdown(data.aiGeneratedOverview)}</strong></div>` : ''}
            </div>

            <div class="section">
                <h2 class="section-title">Sentiment Breakdown</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value positive">${formatNumber(data.sentimentPositive || 0)}</div>
                        <div class="metric-label">Positive Mentions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value negative">${formatNumber(data.sentimentNegative || 0)}</div>
                        <div class="metric-label">Negative Mentions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value neutral">${formatNumber(data.sentimentNeutral || 0)}</div>
                        <div class="metric-label">Neutral Mentions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatPercent((data.avgSentimentConfidence || 0) * 100)}</div>
                        <div class="metric-label">Avg Confidence</div>
                    </div>
                </div>
            </div>

            ${this.generateTopicsSection(data)}
            ${this.generateRecommendationsSection(metadata)}
            ${this.generateReportSpecificContent(reportType, data)}
        </main>

        <footer class="footer">
            <p>This report was generated by BrandPulse AI Reports system. Data quality filtered with ${metadata.confidenceThreshold}% minimum confidence threshold.</p>
            <p>© 2024 BrandPulse. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
  }

  private formatReportTitle(reportType: string): string {
    return reportType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateTopicsSection(data: any): string {
    if (!data.topTopics || data.topTopics.length === 0) return '';

    const topicsHtml = data.topTopics.slice(0, 5).map(topic => `
      <li>${topic.topic || topic.name}: <strong>${topic.count} mentions</strong></li>
    `).join('');

    return `
      <div class="section">
        <h2 class="section-title">Top Topics</h2>
        <div class="list">
          <ul>${topicsHtml}</ul>
        </div>
      </div>
    `;
  }

  private generateRecommendationsSection(metadata: any): string {
    const recommendations = metadata.recommendations || [];
    const actions = metadata.actions || [];

    if (recommendations.length === 0 && actions.length === 0) return '';

    let html = '<div class="section"><h2 class="section-title">AI Recommendations</h2>';

    if (recommendations.length > 0) {
      const recHtml = recommendations.map(rec => `<li>${this.renderMarkdown(rec)}</li>`).join('');
      html += `<div class="list"><h4>Key Insights</h4><ul>${recHtml}</ul></div>`;
    }

    if (actions.length > 0) {
      const actionsHtml = actions.map(action => `<li>${this.renderMarkdown(action)}</li>`).join('');
      html += `<div class="list"><h4>Recommended Actions</h4><ul>${actionsHtml}</ul></div>`;
    }

    html += '</div>';
    return html;
  }

  private generateReportSpecificContent(reportType: string, data: any): string {
    switch (reportType) {
      case 'trend-analysis':
        return this.generateTrendAnalysisContent(data);
      case 'crisis-alert':
        return this.generateCrisisAlertContent(data);
      case 'competitive-analysis':
        return this.generateCompetitiveAnalysisContent(data);
      default:
        return this.generateGenericContent(data);
    }
  }

  private generateTrendAnalysisContent(data: any): string {
    return `
      <div class="section">
        <h2 class="section-title">Trend Analysis</h2>
        <div class="insight">
          ${this.renderMarkdown(`Trend analysis shows ${data.sentimentPositivePercent || 0}% positive sentiment with ${data.totalMentions || 0} total mentions analyzed across the specified period.`)}
        </div>
        ${data.topSourceTypes ? this.generateSourceTypesContent(data.topSourceTypes) : ''}
      </div>
    `;
  }

  private generateCrisisAlertContent(data: any): string {
    const crisisLevel = data.sentimentNegativePercent > 30 ? 'HIGH' :
                       data.sentimentNegativePercent > 15 ? 'MEDIUM' : 'LOW';

    return `
      <div class="section">
        <h2 class="section-title">Crisis Alert Status</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-value ${crisisLevel === 'HIGH' ? 'negative' : crisisLevel === 'MEDIUM' ? 'neutral' : 'positive'}">${crisisLevel}</div>
            <div class="metric-label">Crisis Level</div>
          </div>
          <div class="metric">
            <div class="metric-value negative">${data.sentimentNegative || 0}</div>
            <div class="metric-label">Critical Issues</div>
          </div>
        </div>
        <div class="insight">
          ${this.renderMarkdown(`Crisis monitoring indicates ${crisisLevel.toLowerCase()} priority level with ${data.sentimentNegativePercent || 0}% negative sentiment requiring attention.`)}
        </div>
      </div>
    `;
  }

  private generateCompetitiveAnalysisContent(data: any): string {
    return `
      <div class="section">
        <h2 class="section-title">Competitive Position</h2>
        <div class="insight">
          ${this.renderMarkdown(`Competitive analysis shows brand performance relative to market competitors based on ${data.totalMentions || 0} mentions analyzed.`)}
        </div>
      </div>
    `;
  }

  private generateGenericContent(data: any): string {
    return data.topSourceTypes ? this.generateSourceTypesContent(data.topSourceTypes) : '';
  }

  private generateSourceTypesContent(sourceTypes: any[]): string {
    if (!sourceTypes || sourceTypes.length === 0) return '';

    const sourcesHtml = sourceTypes.slice(0, 5).map(source => `
      <li>${source.source_type}: <strong>${source.count} mentions</strong></li>
    `).join('');

    return `
      <div class="section">
        <h2 class="section-title">Source Distribution</h2>
        <div class="list">
          <ul>${sourcesHtml}</ul>
        </div>
      </div>
    `;
  }

  /**
   * Simple markdown to HTML converter for recommendations and actions
   */
  private renderMarkdown(text: string): string {
    if (!text) return '';

    // Escape HTML first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Convert markdown formatting
    html = html
      // Bold: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')

      // Italic: *text* or _text_
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')

      // Code: `text`
      .replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')

      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>')

      // Line breaks: convert \n to <br>
      .replace(/\n/g, '<br>')

      // Lists: - item or * item
      .replace(/^[-*]\s+(.+)$/gm, '<li style="margin-left: 20px;">$1</li>')

      // Wrap lists in ul tags
      .replace(/(<li[^>]*>.*<\/li>)/s, '<ul style="margin: 8px 0;">$1</ul>')

      // Headers: # Header, ## Header, etc.
      .replace(/^### (.+)$/gm, '<h4 style="color: #374151; margin: 12px 0 8px 0;">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="color: #1f2937; margin: 16px 0 12px 0;">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 style="color: #111827; margin: 20px 0 16px 0;">$1</h2>');

    return html;
  }

  /**
   * Close browser and cleanup resources
   */
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Puppeteer browser closed');
    }
  }
}