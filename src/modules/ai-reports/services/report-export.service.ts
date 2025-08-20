import { Injectable, Logger } from '@nestjs/common';
import { PdfGeneratorService, PdfOptions } from './pdf-generator.service';
import { reportTemplateEngine } from '../report_templates/template-engine';
import * as XLSX from 'xlsx';

export interface ExportOptions {
  format: 'pdf' | 'html' | 'xlsx' | 'csv';
  pdfOptions?: PdfOptions;
  includeCharts?: boolean;
  includeRawData?: boolean;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);

  constructor(private readonly pdfGeneratorService: PdfGeneratorService) {}

  /**
   * Export report in specified format
   */
  async exportReport(
    reportType: string,
    reportData: any,
    metadata: {
      title: string;
      subtitle: string;
      dateRange: string;
      generatedAt: string;
      confidenceThreshold: number;
    },
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'pdf':
          return await this.exportToPdf(reportType, reportData, metadata, options.pdfOptions);
        
        case 'html':
          return await this.exportToHtml(reportType, reportData, metadata);
        
        case 'xlsx':
          return await this.exportToExcel(reportType, reportData, metadata, options.includeRawData);
        
        case 'csv':
          return await this.exportToCsv(reportType, reportData, metadata);
        
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      this.logger.error(`Failed to export report in ${options.format} format`, error);
      throw error;
    }
  }

  /**
   * Export report to PDF
   */
  private async exportToPdf(
    reportType: string,
    reportData: any,
    metadata: any,
    pdfOptions?: PdfOptions
  ): Promise<ExportResult> {
    const pdfBuffer = await this.pdfGeneratorService.generateReportPdf(
      reportType,
      reportData,
      metadata,
      pdfOptions
    );

    const filename = this.generateFilename(reportType, metadata.title, 'pdf');

    return {
      buffer: pdfBuffer,
      filename,
      mimeType: 'application/pdf',
      size: pdfBuffer.length
    };
  }

  /**
   * Export report to HTML
   */
  private async exportToHtml(
    reportType: string,
    reportData: any,
    metadata: any
  ): Promise<ExportResult> {
    const html = reportTemplateEngine.renderReport(reportType, reportData, metadata);
    const htmlBuffer = Buffer.from(html, 'utf-8');
    const filename = this.generateFilename(reportType, metadata.title, 'html');

    return {
      buffer: htmlBuffer,
      filename,
      mimeType: 'text/html',
      size: htmlBuffer.length
    };
  }

  /**
   * Export report to Excel format
   */
  private async exportToExcel(
    reportType: string,
    reportData: any,
    metadata: any,
    includeRawData: boolean = false
  ): Promise<ExportResult> {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = this.extractSummaryData(reportType, reportData, metadata);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Add report-specific sheets based on type
    switch (reportType) {
      case 'executive-summary':
        this.addExecutiveSummarySheets(workbook, reportData);
        break;
      case 'sentiment-intelligence':
        this.addSentimentSheets(workbook, reportData);
        break;
      case 'competitive-analysis':
        this.addCompetitiveSheets(workbook, reportData);
        break;
      case 'category-performance':
        this.addCategorySheets(workbook, reportData);
        break;
      case 'crisis-alert':
        this.addCrisisSheets(workbook, reportData);
        break;
    }

    // Include raw data if requested
    if (includeRawData && reportData.mentions) {
      const rawSheet = XLSX.utils.json_to_sheet(reportData.mentions);
      XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Data');
    }

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = this.generateFilename(reportType, metadata.title, 'xlsx');

    return {
      buffer: Buffer.from(excelBuffer),
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: excelBuffer.length
    };
  }

  /**
   * Export report to CSV format
   */
  private async exportToCsv(
    reportType: string,
    reportData: any,
    metadata: any
  ): Promise<ExportResult> {
    // Extract main data for CSV export
    let csvData: any[] = [];

    switch (reportType) {
      case 'executive-summary':
        csvData = this.extractExecutiveDataForCsv(reportData);
        break;
      case 'sentiment-intelligence':
        csvData = this.extractSentimentDataForCsv(reportData);
        break;
      case 'competitive-analysis':
        csvData = this.extractCompetitiveDataForCsv(reportData);
        break;
      case 'category-performance':
        csvData = this.extractCategoryDataForCsv(reportData);
        break;
      case 'crisis-alert':
        csvData = this.extractCrisisDataForCsv(reportData);
        break;
    }

    // Convert to CSV
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const csvString = XLSX.utils.sheet_to_csv(worksheet);
    const csvBuffer = Buffer.from(csvString, 'utf-8');
    const filename = this.generateFilename(reportType, metadata.title, 'csv');

    return {
      buffer: csvBuffer,
      filename,
      mimeType: 'text/csv',
      size: csvBuffer.length
    };
  }

  /**
   * Generate filename for export
   */
  private generateFilename(reportType: string, title: string, extension: string): string {
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
    const timestamp = new Date().toISOString().split('T')[0];
    return `${sanitizedTitle}-${reportType}-${timestamp}.${extension}`;
  }

  /**
   * Extract summary data for all report types
   */
  private extractSummaryData(reportType: string, reportData: any, metadata: any): any[] {
    const summary = [
      { Field: 'Report Type', Value: reportType },
      { Field: 'Title', Value: metadata.title },
      { Field: 'Date Range', Value: metadata.dateRange },
      { Field: 'Generated At', Value: metadata.generatedAt },
      { Field: 'Confidence Threshold', Value: `${metadata.confidenceThreshold}%` },
      { Field: 'Total Mentions', Value: reportData.totalMentions || 0 }
    ];

    // Add report-specific summary data
    if (reportData.sentimentBreakdown) {
      summary.push(
        { Field: 'Positive Mentions', Value: reportData.sentimentBreakdown.positive || 0 },
        { Field: 'Negative Mentions', Value: reportData.sentimentBreakdown.negative || 0 },
        { Field: 'Neutral Mentions', Value: reportData.sentimentBreakdown.neutral || 0 }
      );
    }

    if (reportData.priorityBreakdown) {
      summary.push(
        { Field: 'High Priority', Value: reportData.priorityBreakdown.high || 0 },
        { Field: 'Medium Priority', Value: reportData.priorityBreakdown.medium || 0 },
        { Field: 'Low Priority', Value: reportData.priorityBreakdown.low || 0 }
      );
    }

    return summary;
  }

  /**
   * Add executive summary specific sheets
   */
  private addExecutiveSummarySheets(workbook: XLSX.WorkBook, reportData: any): void {
    if (reportData.topCategories) {
      const categoriesSheet = XLSX.utils.json_to_sheet(reportData.topCategories);
      XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Top Categories');
    }

    if (reportData.topTopics) {
      const topicsSheet = XLSX.utils.json_to_sheet(reportData.topTopics);
      XLSX.utils.book_append_sheet(workbook, topicsSheet, 'Top Topics');
    }

    if (reportData.topSourceTypes) {
      const sourcesSheet = XLSX.utils.json_to_sheet(reportData.topSourceTypes);
      XLSX.utils.book_append_sheet(workbook, sourcesSheet, 'Source Performance');
    }
  }

  /**
   * Add sentiment analysis specific sheets
   */
  private addSentimentSheets(workbook: XLSX.WorkBook, reportData: any): void {
    if (reportData.positiveSentimentTopics) {
      const positiveSheet = XLSX.utils.json_to_sheet(reportData.positiveSentimentTopics);
      XLSX.utils.book_append_sheet(workbook, positiveSheet, 'Positive Drivers');
    }

    if (reportData.negativeSentimentTopics) {
      const negativeSheet = XLSX.utils.json_to_sheet(reportData.negativeSentimentTopics);
      XLSX.utils.book_append_sheet(workbook, negativeSheet, 'Negative Drivers');
    }
  }

  /**
   * Add competitive analysis specific sheets
   */
  private addCompetitiveSheets(workbook: XLSX.WorkBook, reportData: any): void {
    if (reportData.brandShareOfVoice) {
      const shareSheet = XLSX.utils.json_to_sheet(reportData.brandShareOfVoice);
      XLSX.utils.book_append_sheet(workbook, shareSheet, 'Share of Voice');
    }

    if (reportData.competitiveSentimentAnalysis) {
      const sentimentSheet = XLSX.utils.json_to_sheet(reportData.competitiveSentimentAnalysis);
      XLSX.utils.book_append_sheet(workbook, sentimentSheet, 'Competitive Sentiment');
    }
  }

  /**
   * Add category performance specific sheets
   */
  private addCategorySheets(workbook: XLSX.WorkBook, reportData: any): void {
    if (reportData.categoryDistribution) {
      const distributionSheet = XLSX.utils.json_to_sheet(reportData.categoryDistribution);
      XLSX.utils.book_append_sheet(workbook, distributionSheet, 'Category Distribution');
    }

    if (reportData.categorySentimentAnalysis) {
      const sentimentSheet = XLSX.utils.json_to_sheet(reportData.categorySentimentAnalysis);
      XLSX.utils.book_append_sheet(workbook, sentimentSheet, 'Category Sentiment');
    }
  }

  /**
   * Add crisis alert specific sheets
   */
  private addCrisisSheets(workbook: XLSX.WorkBook, reportData: any): void {
    if (reportData.immediateThreatsMentions) {
      const threatsSheet = XLSX.utils.json_to_sheet(
        reportData.immediateThreatsMentions.map((threat: any) => ({
          'Threat Level': threat.threatLevel,
          'Content': threat.content,
          'Source': threat.source_type,
          'Author': threat.author,
          'Urgency': threat.max_urgency_score,
          'Recommended Action': threat.recommendedAction
        }))
      );
      XLSX.utils.book_append_sheet(workbook, threatsSheet, 'Immediate Threats');
    }
  }

  /**
   * Extract data for CSV export - Executive Summary
   */
  private extractExecutiveDataForCsv(reportData: any): any[] {
    const data: any[] = [];
    
    // Add categories
    if (reportData.topCategories) {
      reportData.topCategories.forEach((cat: any) => {
        data.push({
          Type: 'Category',
          Name: cat.category,
          Count: cat.count,
          Percentage: ((cat.count / reportData.totalMentions) * 100).toFixed(1)
        });
      });
    }

    // Add topics
    if (reportData.topTopics) {
      reportData.topTopics.forEach((topic: any) => {
        data.push({
          Type: 'Topic',
          Name: topic.topic,
          Count: topic.count,
          Percentage: ((topic.count / reportData.totalMentions) * 100).toFixed(1)
        });
      });
    }

    return data;
  }

  /**
   * Extract data for CSV export - Sentiment Intelligence
   */
  private extractSentimentDataForCsv(reportData: any): any[] {
    const data: any[] = [];

    // Sentiment breakdown
    if (reportData.sentimentBreakdown) {
      data.push(
        { Metric: 'Positive Mentions', Value: reportData.sentimentBreakdown.positive },
        { Metric: 'Negative Mentions', Value: reportData.sentimentBreakdown.negative },
        { Metric: 'Neutral Mentions', Value: reportData.sentimentBreakdown.neutral },
        { Metric: 'Average Confidence', Value: reportData.sentimentBreakdown.avgConfidence }
      );
    }

    return data;
  }

  /**
   * Extract data for CSV export - Competitive Analysis
   */
  private extractCompetitiveDataForCsv(reportData: any): any[] {
    return reportData.brandShareOfVoice || [];
  }

  /**
   * Extract data for CSV export - Category Performance
   */
  private extractCategoryDataForCsv(reportData: any): any[] {
    return reportData.categoryDistribution || [];
  }

  /**
   * Extract data for CSV export - Crisis Alert
   */
  private extractCrisisDataForCsv(reportData: any): any[] {
    return reportData.immediateThreatsMentions?.map((threat: any) => ({
      'Threat Level': threat.threatLevel,
      'Content': threat.content,
      'Source': threat.source_type,
      'Author': threat.author,
      'Urgency Score': threat.max_urgency_score,
      'Published At': threat.published_at
    })) || [];
  }
}