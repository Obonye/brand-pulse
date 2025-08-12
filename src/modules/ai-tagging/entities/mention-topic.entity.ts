export interface MentionTopic {
  id: string;
  mention_id: string;
  topic: string;
  confidence: number;
  created_at: string;
}

export interface CreateMentionTopicData {
  mention_id: string;
  topic: string;
  confidence: number;
}