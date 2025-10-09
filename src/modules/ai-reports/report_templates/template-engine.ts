import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Template Engine for AI Reports
 * Handles HTML template compilation and rendering with Handlebars
 */
export class ReportTemplateEngine {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseTemplate: HandlebarsTemplateDelegate;

  constructor() {
    this.registerHelpers();
    this.loadTemplates();
  }

  /**
   * Register custom Handlebars helpers for report formatting
   */
  private registerHelpers(): void {
    // Format percentage helper
    Handlebars.registerHelper('percentage', (value: number, total: number) => {
      if (!total || total === 0) return '0';
      return ((value / total) * 100).toFixed(1);
    });

    // Format currency helper
    Handlebars.registerHelper('currency', (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    });

    // Format number with commas
    Handlebars.registerHelper('number', (value: number) => {
      return new Intl.NumberFormat('en-US').format(value);
    });

    // Format date helper
    Handlebars.registerHelper('formatDate', (date: string | Date) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Format datetime helper
    Handlebars.registerHelper('formatDateTime', (date: string | Date) => {
      const d = new Date(date);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    // Conditional class helper
    Handlebars.registerHelper('conditionalClass', (condition: boolean, trueClass: string, falseClass: string = '') => {
      return condition ? trueClass : falseClass;
    });

    // Sentiment class helper
    Handlebars.registerHelper('sentimentClass', (sentiment: string) => {
      switch (sentiment?.toLowerCase()) {
        case 'positive':
          return 'positive';
        case 'negative':
          return 'negative';
        case 'neutral':
        default:
          return 'neutral';
      }
    });

    // Priority class helper
    Handlebars.registerHelper('priorityClass', (priority: string) => {
      switch (priority?.toLowerCase()) {
        case 'high':
          return 'priority-high';
        case 'medium':
          return 'priority-medium';
        case 'low':
        default:
          return 'priority-low';
      }
    });

    // Truncate text helper
    Handlebars.registerHelper('truncate', (text: string, length: number = 100) => {
      if (!text || text.length <= length) return text;
      return text.substring(0, length) + '...';
    });

    // Greater than helper
    Handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    // Less than helper
    Handlebars.registerHelper('lt', (a: number, b: number) => {
      return a < b;
    });

    // Equals helper
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Or helper
    Handlebars.registerHelper('or', (...args: any[]) => {
      // Remove the options object (last argument)
      const values = args.slice(0, -1);
      return values.some(Boolean);
    });

    // And helper
    Handlebars.registerHelper('and', (...args: any[]) => {
      // Remove the options object (last argument)
      const values = args.slice(0, -1);
      return values.every(Boolean);
    });
  }

  /**
   * Load all HTML templates from the templates directory
   */
  private loadTemplates(): void {
    try {
      const templatesDir = __dirname;
      console.log('Loading templates from:', templatesDir);
      
      // Load base template
      const baseTemplatePath = path.join(templatesDir, 'base.template.html');
      console.log('Loading base template from:', baseTemplatePath);
      
      if (!fs.existsSync(baseTemplatePath)) {
        console.warn('Base template not found at:', baseTemplatePath);
        return;
      }
      
      const baseTemplateContent = fs.readFileSync(baseTemplatePath, 'utf-8');
      this.baseTemplate = Handlebars.compile(baseTemplateContent);

    // Load report-specific templates
    const reportTemplates = [
      'executive-summary',
      'sentiment-intelligence',
      'competitive-analysis',
      'category-performance',
      'crisis-alert',
      'trend-analysis'
    ];

      for (const templateName of reportTemplates) {
        const templatePath = path.join(templatesDir, `${templateName}.template.html`);
        console.log(`Loading template: ${templateName} from ${templatePath}`);
        
        if (fs.existsSync(templatePath)) {
          const templateContent = fs.readFileSync(templatePath, 'utf-8');
          this.templates.set(templateName, Handlebars.compile(templateContent));
          console.log(`Loaded template: ${templateName}`);
        } else {
          console.warn(`Template not found: ${templatePath}`);
        }
      }
      
      console.log('Template engine initialized successfully');
    } catch (error) {
      console.error('Failed to load templates:', error.message);
      console.error('Template engine will work with fallback HTML only');
    }
  }

  /**
   * Render a complete report with base template and report-specific content
   */
  public renderReport(
    reportType: string,
    data: any,
    metadata: {
      title: string;
      subtitle: string;
      dateRange: string;
      generatedAt: string;
      confidenceThreshold: number;
    }
  ): string {
    let reportTemplate = this.templates.get(reportType);
    let reportContent: string;

    if (!reportTemplate) {
      console.warn(`Template not found for report type: ${reportType}, using fallback`);
      reportContent = this.generateFallbackContent(reportType, data);
    } else {
      // Render the report-specific content
      reportContent = reportTemplate(data);
    }

    // If base template is not available, return simple HTML
    if (!this.baseTemplate) {
      return this.generateSimpleHtml(metadata.title, reportContent, metadata);
    }

    // Render the complete HTML with base template
    const completeHtml = this.baseTemplate({
      reportTitle: metadata.title,
      reportSubtitle: metadata.subtitle,
      dateRange: metadata.dateRange,
      generatedAt: metadata.generatedAt,
      confidenceThreshold: metadata.confidenceThreshold,
      reportContent
    });

    return completeHtml;
  }

  /**
   * Render just the report content (without base template)
   * Useful for email templates or partial rendering
   */
  public renderReportContent(reportType: string, data: any): string {
    const reportTemplate = this.templates.get(reportType);

    if (!reportTemplate) {
      console.warn(`Template not found for report type: ${reportType}, using fallback`);
      return this.generateFallbackContent(reportType, data);
    }

    return reportTemplate(data);
  }

  /**
   * Generate fallback content when template is missing
   */
  private generateFallbackContent(reportType: string, data: any): string {
    const metrics = [
      { label: 'Total Mentions', value: data.totalMentions || 0 },
      { label: 'Positive Sentiment', value: `${data.sentimentPositivePercent || 0}%` },
      { label: 'Negative Sentiment', value: `${data.sentimentNegativePercent || 0}%` },
      { label: 'Neutral Sentiment', value: `${data.sentimentNeutralPercent || 0}%` }
    ];

    return `
      <div class="report-section">
        <h2 class="section-title">${this.capitalizeReportType(reportType)}</h2>
        <div class="section-content">
          <div class="metrics-grid">
            ${metrics.map(metric => `
              <div class="metric-card">
                <div class="metric-value">${metric.value}</div>
                <div class="metric-label">${metric.label}</div>
              </div>
            `).join('')}
          </div>

          ${data.aiGeneratedOverview ? `<p class="ai-insight"><strong>${data.aiGeneratedOverview}</strong></p>` : ''}

          ${data.recommendations && data.recommendations.length > 0 ? `
            <div class="recommendations">
              <h4>Key Recommendations</h4>
              <ul>
                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${data.topTopics && data.topTopics.length > 0 ? `
            <div class="top-topics">
              <h4>Top Topics</h4>
              <ul>
                ${data.topTopics.slice(0, 5).map(topic => `
                  <li>${topic.topic || topic.name}: ${topic.count} mentions</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate simple HTML when base template is missing
   */
  private generateSimpleHtml(title: string, content: string, metadata: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
        .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
        .report-section { margin: 30px 0; }
        .section-title { color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1f2937; }
        .metric-label { color: #6b7280; margin-top: 5px; font-size: 0.9em; }
        .ai-insight { background: #eff6ff; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6; }
        .recommendations, .top-topics { margin: 20px 0; }
        .recommendations h4, .top-topics h4 { color: #1f2937; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p><strong>Generated:</strong> ${metadata.generatedAt}</p>
        <p><strong>Date Range:</strong> ${metadata.dateRange}</p>
    </div>
    ${content}
</body>
</html>
    `;
  }

  /**
   * Capitalize and format report type for display
   */
  private capitalizeReportType(reportType: string): string {
    return reportType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get available report template types
   */
  public getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Add or update a custom template
   */
  public addCustomTemplate(name: string, templateContent: string): void {
    const compiled = Handlebars.compile(templateContent);
    this.templates.set(name, compiled);
  }

  /**
   * Validate template data structure
   */
  public validateTemplateData(reportType: string, data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation based on report type
    switch (reportType) {
      case 'executive-summary':
        if (!data.totalMentions) errors.push('totalMentions is required');
        if (!data.sentimentBreakdown) errors.push('sentimentBreakdown is required');
        if (!data.topCategories) errors.push('topCategories is required');
        break;

      case 'sentiment-intelligence':
        if (!data.totalMentions) errors.push('totalMentions is required');
        if (!data.avgSentimentConfidence) errors.push('avgSentimentConfidence is required');
        if (!data.sentimentBreakdown) errors.push('sentimentBreakdown is required');
        break;

      case 'competitive-analysis':
        if (!data.totalBrands) errors.push('totalBrands is required');
        if (!data.brandShareOfVoice) errors.push('brandShareOfVoice is required');
        if (!data.competitiveSentimentAnalysis) errors.push('competitiveSentimentAnalysis is required');
        break;

      case 'category-performance':
        if (!data.totalCategories) errors.push('totalCategories is required');
        if (!data.categoryDistribution) errors.push('categoryDistribution is required');
        if (!data.categorySentimentAnalysis) errors.push('categorySentimentAnalysis is required');
        break;

      case 'crisis-alert':
        if (!data.criticalIssuesCount) errors.push('criticalIssuesCount is required');
        if (!data.crisisLevel) errors.push('crisisLevel is required');
        if (!data.responseTimeRecommendations) errors.push('responseTimeRecommendations is required');
        break;

      default:
        errors.push(`Unknown report type: ${reportType}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const reportTemplateEngine = new ReportTemplateEngine();