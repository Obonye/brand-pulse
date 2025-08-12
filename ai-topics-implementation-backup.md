# AI Topics Implementation Backup

This file contains the working implementation of AI topics functionality that was disabled to reduce OpenAI costs. Use this to restore the functionality later.

## Files Modified

### 1. `src/modules/ai-tagging/ai-tagging.service.ts`

**Lines 151-170 - Topic Storage Logic (CURRENTLY DISABLED):**
```typescript
// Store topics - DISABLED to reduce OpenAI costs
// if (taggingResult.topics.length > 0) {
//   const topicData: CreateMentionTopicData[] = taggingResult.topics.map(topic => ({
//     mention_id: taggingResult.mention_id,
//     topic: topic.name,
//     confidence: topic.confidence
//   }));

//   const { error: topicsError } = await this.supabaseService.adminClient
//     .from('mention_topics')
//     .upsert(topicData, {
//       onConflict: 'mention_id,topic'
//     });

//   if (topicsError) {
//     this.logger.warn(`Failed to store mention topics: ${topicsError.message}`, {
//       mentionId: taggingResult.mention_id
//     });
//   }
// }
```

**ORIGINAL WORKING CODE (to restore):**
```typescript
// Store topics
if (taggingResult.topics.length > 0) {
  const topicData: CreateMentionTopicData[] = taggingResult.topics.map(topic => ({
    mention_id: taggingResult.mention_id,
    topic: topic.name,
    confidence: topic.confidence
  }));

  const { error: topicsError } = await this.supabaseService.adminClient
    .from('mention_topics')
    .upsert(topicData, {
      onConflict: 'mention_id,topic'
    });

  if (topicsError) {
    this.logger.warn(`Failed to store mention topics: ${topicsError.message}`, {
      mentionId: taggingResult.mention_id
    });
  }
}
```

**Lines 317 - AI Prompt includes topics (CURRENTLY ENABLED - could be optimized):**
```typescript
  "topics": [{"name": "topic1", "confidence": 0.9}, {"name": "topic2", "confidence": 0.7}],
```

**Lines 326 - Prompt rule about topics (CURRENTLY ENABLED - could be optimized):**
```typescript
- Topics should be specific aspects mentioned in the text
```

## How to Restore Topics Functionality

1. **Restore topic storage**: Replace the commented code in lines 151-170 with the original working code above.

2. **Optional - Optimize AI prompt**: If you want to save more on OpenAI costs, also remove the topics field from the AI prompt and the corresponding rule.

## Related Files

- `src/modules/ai-tagging/industry-templates/industry-tag-templates.service.ts` - Contains topic templates
- `src/modules/ai-tagging/entities/mention-topic.entity.ts` - Topic entity definitions
- `src/modules/ai-tagging/dto/tag-filter.dto.ts` - Includes topic filtering

## Database Schema

The topics are stored in the `mention_topics` table with the following structure:
- `mention_id` (references scraped_mentions)
- `topic` (text)
- `confidence` (numeric)

## Current Status

- ✅ AI tagging for categories, intents, priority, urgency still works
- ❌ Topics are not being stored to database (disabled to save costs)
- ⚠️ AI prompt still requests topics (minor cost optimization opportunity)

Date: 2025-08-11