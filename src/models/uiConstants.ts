import { CommentType, Priority } from './types';

// UI display labels and emojis for comment types
export const COMMENT_TYPE_UI_INFO: Record<CommentType, { emoji: string; label: string }> = {
  [CommentType.Issue]: { emoji: '🐛', label: 'Issue' },
  [CommentType.Suggestion]: { emoji: '💡', label: 'Suggestion' },
  [CommentType.Question]: { emoji: '❓', label: 'Question' },
  [CommentType.Praise]: { emoji: '👍', label: 'Praise' }
};

// UI display labels and emojis for priorities
export const PRIORITY_UI_INFO: Record<Priority, { emoji: string; label: string }> = {
  [Priority.Low]: { emoji: '🟢', label: 'Low' },
  [Priority.Medium]: { emoji: '🟡', label: 'Medium' },
  [Priority.High]: { emoji: '🟠', label: 'High' },
  [Priority.Critical]: { emoji: '🔴', label: 'Critical' }
};