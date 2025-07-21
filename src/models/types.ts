export enum CommentType {
  Issue = 'issue',
  Suggestion = 'suggestion',
  Question = 'question',
  Praise = 'praise'
}

export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}

export enum FileStatus {
  Modified = 'modified',
  Added = 'added',
  Untracked = 'untracked',
  Deleted = 'deleted'
}

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  comment: string;
  type: CommentType;
  priority: Priority;
  timestamp: string;
}

export interface ChangedFile {
  path: string;
  status: FileStatus;
  staged: boolean;
}

export interface ReviewSession {
  id: string;
  branch: string;
  baseBranch: string;
  timestamp: string;
  status: 'in-progress' | 'completed';
  comments: ReviewComment[];
}