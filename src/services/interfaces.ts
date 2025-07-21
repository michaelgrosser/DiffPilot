import { ReviewComment, ChangedFile } from '../models/types';
import { DiffContent } from './fileContentService';

export interface IReviewService {
  getComments(): ReviewComment[];
  getCommentsForFile(file: string): ReviewComment[];
  addComment(comment: ReviewComment): void;
  deleteComment(commentId: string): boolean;
  loadExistingComments(workspaceRoot: string): Promise<void>;
  initializeReviewFile(workspaceRoot: string): Promise<void>;
  generateMarkdown(branch: string): string;
  getCurrentReviewFile(): string | null;
  getCommentCount(): number;
  clearComments(): void;
}

export interface IFileContentService {
  loadFileContent(file: ChangedFile, workspaceRoot: string): Promise<{ content: string; diff?: DiffContent }>;
  validateFilePath(workspaceRoot: string, filePath: string): string;
}

export interface IGitService {
  getCurrentBranch(workspaceRoot: string): Promise<string>;
  getFileContentFromGit(workspaceRoot: string, filePath: string): Promise<string>;
  getChangedFiles(workspaceRoot: string): Promise<ChangedFile[]>;
}

export interface IFileSystemService {
  fileExists(path: string): boolean;
  isFile(path: string): boolean;
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  ensureReviewsDirectory(): void;
  getReviewsDirectory(): string;
}

export interface ILoggingService {
  error(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}