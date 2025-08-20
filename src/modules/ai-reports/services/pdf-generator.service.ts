import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { reportTemplateEngine } from '../report_templates/template-engine';

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

  constructor() {
    this.initializeBrowser();
  }

  /**
   * Initialize Puppeteer browser instance
   */
  private async initializeBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      this.logger.log('Puppeteer browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer browser', error);
      throw error;
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
    },
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Generate HTML from template
      const html = reportTemplateEngine.renderReport(reportType, reportData, metadata);
      
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
    if (!this.browser) {
      await this.initializeBrowser();
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
      if (page) {
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
      if (!this.browser) {
        await this.initializeBrowser();
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
    memoryUsage: string;
    uptime: string;
  } {
    return {
      browserConnected: !!this.browser?.isConnected(),
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      uptime: `${Math.round(process.uptime())}s`
    };
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