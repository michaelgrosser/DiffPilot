import { FileStatus, CommentType } from './types';

// Debug flag - set to true to enable verbose logging
export const DEBUG = false;

// File status icon and color mappings
export const FILE_STATUS_ICONS: Record<FileStatus, { icon: string; color: string }> = {
  [FileStatus.Modified]: { icon: 'edit', color: 'gitDecoration.modifiedResourceForeground' },
  [FileStatus.Added]: { icon: 'add', color: 'gitDecoration.addedResourceForeground' },
  [FileStatus.Untracked]: { icon: 'question', color: 'gitDecoration.untrackedResourceForeground' },
  [FileStatus.Deleted]: { icon: 'trash', color: 'gitDecoration.deletedResourceForeground' }
};

// File status labels for UI display
export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  [FileStatus.Modified]: 'M',
  [FileStatus.Added]: 'A',
  [FileStatus.Untracked]: 'U',
  [FileStatus.Deleted]: 'D'
};

// Comment type emojis for markdown output
export const COMMENT_TYPE_EMOJIS: Record<CommentType, string> = {
  [CommentType.Issue]: '🐛',
  [CommentType.Suggestion]: '💡',
  [CommentType.Question]: '❓',
  [CommentType.Praise]: '👍'
};

// Git status codes from VS Code Git API
export enum GitStatus {
  UNTRACKED = 7,
  ADDED = 6,
  DELETED = 2,
  DELETED_BY_US = 12,
  DELETED_BY_THEM = 13,
  ADDED_BY_US = 14,
  ADDED_BY_THEM = 15
}

// Extension configuration
export const CONFIG_NAMESPACE = 'diffpilot';
export const DEFAULT_REVIEWS_DIR = '.vscode/reviews';

// Timing constants
export const AUTO_REFRESH_INTERVAL = 2000; // 2 seconds

// Extension commands
export const COMMANDS = {
  START_REVIEW: 'diffpilot.startReview',
  EXPORT_REVIEW: 'diffpilot.exportReview',
  OPEN_FILE: 'diffpilot.openFile',
  SHOW_REVIEW_PANEL: 'diffpilot.showReviewPanel',
  CREATE_COMMENT: 'diffpilot.createComment',
  REFRESH: 'diffpilot.refresh'
};