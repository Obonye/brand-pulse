import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceFilterService } from './compliance-filter.service';
import { LoggerService } from '../../../common/logger/logger.service';

describe('ComplianceFilterService', () => {
  let service: ComplianceFilterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceFilterService,
        {
          provide: LoggerService,
          useValue: {
            setContext: () => ({
              info: jest.fn(),
              debug: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ComplianceFilterService>(ComplianceFilterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Instagram Posts (preserve author)', () => {
    it('should preserve author data for Instagram posts', () => {
      const mentions = [{
        id: '1',
        tenant_id: 'tenant1',
        brand_id: 'brand1',
        source_type: 'instagram_posts',
        content: 'Check out this amazing product! #love',
        author: 'content_creator_123',
        author_url: 'https://instagram.com/content_creator_123',
        author_followers: 50000,
        source_url: 'https://instagram.com/p/ABC123',
        metadata: {
          owner_username: 'content_creator_123',
          owner_full_name: 'Content Creator',
          likes_count: 1000,
          comments_count: 50,
        }
      }];

      const result = service.anonymizeMentions(mentions);
      const anonymized = result.anonymized[0];

      // Should preserve post author data
      expect(anonymized.author).toBe('content_creator_123');
      expect(anonymized.author_url).toBe('https://instagram.com/content_creator_123');
      expect(anonymized.author_followers).toBe(50000);
      expect(anonymized.content).toBe('Check out this amazing product! #love');
      expect(anonymized.source_url).toBe('https://instagram.com/p/ABC123');
      
      // Should preserve analytics data
      expect(anonymized.metadata?.likes_count).toBe(1000);
      expect(anonymized.metadata?.comments_count).toBe(50);
      
      // Should preserve some owner data for posts
      expect(anonymized.metadata?.owner_username).toBe('content_creator_123');
      expect(anonymized.metadata?.owner_full_name).toBe('Content Creator');
    });
  });

  describe('Instagram Comments (anonymize author)', () => {
    it('should anonymize author data for Instagram comments', () => {
      const mentions = [{
        id: '2',
        tenant_id: 'tenant1',
        brand_id: 'brand1',
        source_type: 'instagram_comments',
        content: 'Love this product!',
        author: 'random_user_456',
        author_url: 'https://instagram.com/random_user_456',
        author_followers: 200,
        source_url: 'https://instagram.com/p/ABC123',
        metadata: {
          owner_username: 'random_user_456',
          comment_likes_count: 5,
          platform_data: {
            username: 'random_user_456',
            profileUrl: 'https://instagram.com/random_user_456'
          }
        }
      }];

      const result = service.anonymizeMentions(mentions);
      const anonymized = result.anonymized[0];

      // Should anonymize comment author data
      expect(anonymized.author).toMatch(/^(Anonymous|Private|Guest|User)_\d+$/);
      expect(anonymized.author_url).toBeUndefined();
      expect(anonymized.author_followers).toBeUndefined();
      
      // Should preserve content and source URL
      expect(anonymized.content).toBe('Love this product!');
      expect(anonymized.source_url).toBe('https://instagram.com/p/ABC123');
      
      // Should preserve analytics data
      expect(anonymized.metadata?.comment_likes_count).toBe(5);
      
      // Should remove personal data from metadata
      expect(anonymized.metadata?.owner_username).toBeUndefined();
      expect(anonymized.metadata?.platform_data?.username).toBeUndefined();
      expect(anonymized.metadata?.platform_data?.profileUrl).toBeUndefined();
    });
  });

  describe('TikTok Posts (preserve author)', () => {
    it('should preserve author data for TikTok posts', () => {
      const mentions = [{
        id: '3',
        tenant_id: 'tenant1',
        brand_id: 'brand1',
        source_type: 'tiktok',
        content: 'Dancing with the new product! 💃',
        author: 'tiktok_star_789',
        author_url: 'https://tiktok.com/@tiktok_star_789',
        author_followers: 100000,
        source_url: 'https://tiktok.com/video/123456',
        metadata: {
          unique_id: 'tiktok_star_789',
          digg_count: 500,
          video_play_count: 25000,
        }
      }];

      const result = service.anonymizeMentions(mentions);
      const anonymized = result.anonymized[0];

      // Should preserve post author data
      expect(anonymized.author).toBe('tiktok_star_789');
      expect(anonymized.author_url).toBe('https://tiktok.com/@tiktok_star_789');
      expect(anonymized.author_followers).toBe(100000);
      
      // Should preserve content and analytics
      expect(anonymized.content).toBe('Dancing with the new product! 💃');
      expect(anonymized.metadata?.digg_count).toBe(500);
      expect(anonymized.metadata?.video_play_count).toBe(25000);
    });
  });

  describe('TikTok Comments (anonymize author)', () => {
    it('should anonymize author data for TikTok comments', () => {
      const mentions = [{
        id: '4',
        tenant_id: 'tenant1',
        brand_id: 'brand1',
        source_type: 'tiktok_comments',
        content: 'So cool! Where can I buy this?',
        author: 'commenter_999',
        author_url: 'https://tiktok.com/@commenter_999',
        author_followers: 50,
        source_url: 'https://tiktok.com/video/123456',
        metadata: {
          unique_id: 'commenter_999',
          digg_count: 2,
          reply_comment_total: 0,
        }
      }];

      const result = service.anonymizeMentions(mentions);
      const anonymized = result.anonymized[0];

      // Should anonymize comment author data
      expect(anonymized.author).toMatch(/^(Anonymous|Private|Guest|User)_\d+$/);
      expect(anonymized.author_url).toBeUndefined();
      expect(anonymized.author_followers).toBeUndefined();
      
      // Should preserve content and analytics
      expect(anonymized.content).toBe('So cool! Where can I buy this?');
      expect(anonymized.metadata?.digg_count).toBe(2);
      expect(anonymized.metadata?.reply_comment_total).toBe(0);
      
      // Should remove personal identifiers
      expect(anonymized.metadata?.unique_id).toBeUndefined();
    });
  });

  describe('Google Reviews (anonymize author)', () => {
    it('should anonymize author data for Google reviews', () => {
      const mentions = [{
        id: '5',
        tenant_id: 'tenant1',
        brand_id: 'brand1',
        source_type: 'google_reviews',
        content: 'Great service and friendly staff!',
        author: 'John Smith',
        author_url: undefined,
        author_followers: undefined,
        source_url: 'https://maps.google.com/place/123',
        metadata: {
          reviewer_name: 'John Smith',
          business_name: 'Local Business',
          rating: 5,
          review_date: '2023-12-01',
        }
      }];

      const result = service.anonymizeMentions(mentions);
      const anonymized = result.anonymized[0];

      // Should anonymize reviewer data
      expect(anonymized.author).toMatch(/^(Anonymous|Private|Guest|User)_\d+$/);
      
      // Should preserve content and analytics
      expect(anonymized.content).toBe('Great service and friendly staff!');
      expect(anonymized.metadata?.rating).toBe(5);
      expect(anonymized.metadata?.review_date).toBe('2023-12-01');
      
      // Should remove personal identifiers but keep business name removed for privacy
      expect(anonymized.metadata?.reviewer_name).toBeUndefined();
      expect(anonymized.metadata?.business_name).toBeUndefined();
    });
  });

  describe('Source ID anonymization', () => {
    it('should anonymize source IDs consistently', () => {
      const mentions = [
        {
          id: '6',
          source_type: 'instagram_comments',
          source_id: 'comment_12345_orig',
          content: 'Test comment'
        },
        {
          id: '7',
          source_type: 'instagram_comments',
          source_id: 'comment_12345_orig', // Same source ID
          content: 'Test comment duplicate'
        }
      ];

      const result = service.anonymizeMentions(mentions);
      
      // Same source ID should produce same anonymized ID
      expect(result.anonymized[0].source_id).toBe(result.anonymized[1].source_id);
      expect(result.anonymized[0].source_id).toMatch(/^anon_[a-z0-9]+$/);
    });
  });

  describe('Anonymization statistics', () => {
    it('should provide accurate anonymization statistics', () => {
      const mentions = [{
        source_type: 'instagram_comments',
        content: 'Test',
        author: 'user123',
        author_url: 'http://example.com',
        source_url: 'http://source.com'
      }];

      const result = service.anonymizeMentions(mentions);
      const stats = service.getAnonymizationStats(result);

      expect(stats.fieldsAnonymized).toBeGreaterThan(0);
      expect(stats.fieldsPreserved).toBeGreaterThan(0);
      expect(stats.anonymizationRate).toBeGreaterThan(0);
      expect(stats.summary).toBe('Preserved post authors and content, anonymized comment authors');
    });
  });
});