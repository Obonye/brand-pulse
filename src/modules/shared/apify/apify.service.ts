// src/modules/shared/apify/apify.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Import ApifyClient with require to avoid TypeScript issues
const { ApifyClient } = require('apify-client');

// Type definition for ApifyClient
interface ApifyClientInterface {
  actor(actorId: string): {
    start(input: any, options?: any): Promise<any>;
  };
  run(runId: string): {
    get(): Promise<any>;
    abort(): Promise<any>;
    dataset(): Promise<{
      listItems(options?: { limit?: number }): Promise<{ items: any[] }>;
    }>;
  };
}

export interface ApifyActorRun {
  id: string;
  actId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
  startedAt: string;
  finishedAt?: string;
  stats: {
    inputBodyLen: number;
    restartCount: number;
    resurrectCount: number;
    memAvgBytes: number;
    memMaxBytes: number;
    memCurrentBytes: number;
    cpuAvgUsage: number;
    cpuMaxUsage: number;
    cpuCurrentUsage: number;
    netRxBytes: number;
    netTxBytes: number;
    durationMillis: number;
    runTimeSecs: number;
    metamorph: number;
    computeUnits: number;
  };
  meta: {
    origin: string;
    userAgent: string;
  };
  usageTotalUsd: number;
  usageUsd: {
    ACTOR_COMPUTE_UNITS: number;
    DATASET_READS: number;
    DATASET_WRITES: number;
    KEY_VALUE_STORE_READS: number;
    KEY_VALUE_STORE_WRITES: number;
    REQUEST_QUEUE_READS: number;
    REQUEST_QUEUE_WRITES: number;
  };
}

export interface ApifyDatasetItem {
  url?: string;
  title?: string;
  text?: string;
  author?: string;
  publishedAt?: string;
  rating?: number;
  reviewText?: string;
  [key: string]: any;
}

@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);
  private readonly client: ApifyClientInterface;
  
  // Popular Apify actors for different platforms
  private readonly ACTORS = {
    google_reviews: 'compass/google-maps-reviews-scraper',
    google_maps: 'drobnikj/google-maps-scraper',
    facebook: 'apify/facebook-posts-scraper',
    instagram: 'apify/instagram-scraper',
    twitter: 'quacker/twitter-scraper',
    tripadvisor: 'maxcopell/tripadvisor-reviews',
    booking_com: 'drobnikj/booking-scraper',
    news_sites: 'apify/web-scraper',
    youtube: 'bernardo/youtube-scraper',
  };

  constructor(private configService: ConfigService) {
    const apifyToken = this.configService.get<string>('APIFY_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_TOKEN is required in environment variables');
    }
    
    this.client = new ApifyClient({
      token: apifyToken,
    });
  }

  /**
   * Start a scraper run based on source type and configuration
   */
  async startScraperRun(
    sourceType: string,
    config: Record<string, any>,
    webhookUrl?: string
  ): Promise<ApifyActorRun> {
    try {
      const actorId = this.ACTORS[sourceType];
      if (!actorId) {
        throw new BadRequestException(`Unsupported source type: ${sourceType}`);
      }

      this.logger.log(`Starting Apify actor ${actorId} for source type: ${sourceType}`);

      const input = this.buildActorInput(sourceType, config);
      
      const runOptions: any = {
        memory: this.getMemoryRequirement(sourceType),
        timeout: this.getTimeoutRequirement(sourceType),
      };

      // Add webhook if provided
      if (webhookUrl) {
        runOptions.webhooks = [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
            requestUrl: webhookUrl,
          },
        ];
      }

      const run = await this.client.actor(actorId).start(input, runOptions);
      
      this.logger.log(`Started Apify run: ${run.id}`);
      return run;
    } catch (error) {
      this.logger.error(`Failed to start Apify run: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to start scraper: ${error.message}`);
    }
  }

  /**
   * Get status of a running scraper job
   */
  async getRunStatus(runId: string): Promise<ApifyActorRun> {
    try {
      const run = await this.client.run(runId).get();
      return run;
    } catch (error) {
      this.logger.error(`Failed to get run status: ${error.message}`);
      throw new BadRequestException(`Failed to get run status: ${error.message}`);
    }
  }

  /**
   * Get scraped data from completed run
   */
  async getRunData(runId: string, limit = 1000): Promise<ApifyDatasetItem[]> {
    try {
      const run = await this.client.run(runId).get();
      
      if (run.status !== 'SUCCEEDED') {
        throw new BadRequestException(`Run not completed successfully. Status: ${run.status}`);
      }

      const dataset = await this.client.run(runId).dataset();
      const { items } = await dataset.listItems({ limit });
      
      this.logger.log(`Retrieved ${items.length} items from run ${runId}`);
      return items;
    } catch (error) {
      this.logger.error(`Failed to get run data: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve data: ${error.message}`);
    }
  }

  /**
   * Abort a running scraper job
   */
  async abortRun(runId: string): Promise<ApifyActorRun> {
    try {
      const run = await this.client.run(runId).abort();
      this.logger.log(`Aborted Apify run: ${runId}`);
      return run;
    } catch (error) {
      this.logger.error(`Failed to abort run: ${error.message}`);
      throw new BadRequestException(`Failed to abort run: ${error.message}`);
    }
  }

  /**
   * Build actor input based on source type and config
   */
  private buildActorInput(sourceType: string, config: Record<string, any>): Record<string, any> {
    // Limit all scrapers to max 50 results for testing/cost control
    const MAX_RESULTS_LIMIT = 50;
    
    switch (sourceType) {
      case 'google_reviews':
        const input: any = {
          maxReviews: Math.min(config.max_results || 50, MAX_RESULTS_LIMIT),
          reviewsSort: config.sort || 'newest',
          language: config.language || 'en',
        };
        
        // Add place URLs if provided (convert to proper format)
        if (config.startUrls && config.startUrls.length > 0) {
          input.startUrls = config.startUrls.map(url => ({
            url: typeof url === 'string' ? url : url.url,
            method: 'GET'
          }));
        }
        
        // Add place IDs if provided  
        if (config.placeIds && config.placeIds.length > 0) {
          input.placeIds = config.placeIds;
        }
        
        // Add search strings if provided (for plus codes or search terms)
        if (config.searchStringsArray && config.searchStringsArray.length > 0) {
          input.searchStringsArray = config.searchStringsArray;
          if (config.locationQuery) {
            input.locationQuery = config.locationQuery;
          }
        }
        
        // If none provided, throw error
        if (!input.startUrls && !input.placeIds && !input.searchStringsArray) {
          throw new BadRequestException('Google Reviews scraper requires either startUrls, placeIds, or searchStringsArray in config');
        }
        
        return input;

      case 'google_maps':
        return {
          searchStringsArray: config.search_terms || [],
          locationQuery: config.location || '',
          maxCrawledPlaces: Math.min(config.max_results || 50, MAX_RESULTS_LIMIT),
          language: config.language || 'en',
          includeReviews: true,
          maxReviews: Math.min(config.max_reviews_per_place || 10, 10), // Limit reviews per place too
        };

      case 'facebook':
        return {
          startUrls: config.page_urls || [],
          maxPosts: Math.min(config.max_results || 50, MAX_RESULTS_LIMIT),
          commentsMode: config.include_comments || 'DISABLED',
        };

      case 'tripadvisor':
        return {
          locationFullName: config.location || '',
          maxItems: Math.min(config.max_results || 50, MAX_RESULTS_LIMIT),
          checkInDate: config.check_in_date,
          checkOutDate: config.check_out_date,
        };

      case 'booking_com':
        return {
          search: config.search_query || '',
          destType: config.destination_type || 'city',
          maxPages: Math.ceil(Math.min(config.max_results || 50, MAX_RESULTS_LIMIT) / 25),
        };

      case 'news_sites':
        return {
          startUrls: config.urls || [],
          linkSelector: config.link_selector || 'a[href]',
          pageFunction: this.getNewsScrapingFunction(config.keywords || []),
          maxRequestsPerCrawl: Math.min(config.max_results || 50, MAX_RESULTS_LIMIT),
        };

      case 'youtube':
        return {
          searchKeywords: config.search_terms || [],
          maxResults: Math.min(config.max_results || 50, MAX_RESULTS_LIMIT),
          searchType: 'video',
        };

      default:
        return config;
    }
  }

  /**
   * Get memory requirements for different scrapers
   */
  private getMemoryRequirement(sourceType: string): number {
    const memoryMap = {
      google_reviews: 1024,
      google_maps: 2048,
      facebook: 2048,
      instagram: 1024,
      twitter: 1024,
      tripadvisor: 1024,
      booking_com: 1024,
      news_sites: 1024,
      youtube: 1024,
    };
    
    return memoryMap[sourceType] || 1024;
  }

  /**
   * Get timeout requirements for different scrapers
   */
  private getTimeoutRequirement(sourceType: string): number {
    const timeoutMap = {
      google_reviews: 3600, // 1 hour
      google_maps: 7200,    // 2 hours
      facebook: 3600,
      instagram: 3600,
      twitter: 1800,        // 30 minutes
      tripadvisor: 3600,
      booking_com: 3600,
      news_sites: 1800,
      youtube: 1800,
    };
    
    return timeoutMap[sourceType] || 3600;
  }

  /**
   * Generate page function for news scraping
   */
  private getNewsScrapingFunction(keywords: string[]): string {
    return `
      async function pageFunction(context) {
        const { page, request } = context;
        
        const title = await page.title();
        const url = request.url;
        
        // Extract article content
        const content = await page.evaluate(() => {
          const article = document.querySelector('article') || 
                         document.querySelector('[role="main"]') ||
                         document.querySelector('.content') ||
                         document.querySelector('#content') ||
                         document.body;
          return article ? article.innerText : '';
        });
        
        // Extract publish date
        const publishedAt = await page.evaluate(() => {
          const dateSelectors = [
            'time[datetime]',
            '[datetime]',
            '.published',
            '.date',
            '.post-date'
          ];
          
          for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.getAttribute('datetime') || element.textContent;
            }
          }
          return null;
        });
        
        // Check if content contains keywords
        const keywords = ${JSON.stringify(keywords)};
        const hasKeywords = keywords.length === 0 || 
          keywords.some(keyword => 
            title.toLowerCase().includes(keyword.toLowerCase()) ||
            content.toLowerCase().includes(keyword.toLowerCase())
          );
        
        if (!hasKeywords) {
          return null; // Skip this page
        }
        
        return {
          url,
          title,
          content: content.substring(0, 5000), // Limit content length
          publishedAt,
          scrapedAt: new Date().toISOString(),
        };
      }
    `;
  }
}