import { ReviewComment } from '../models/types';

export interface IReviewRepository {
  findAll(): Promise<ReviewComment[]>;
  findByFile(filePath: string): Promise<ReviewComment[]>;
  findById(id: string): Promise<ReviewComment | undefined>;
  save(comment: ReviewComment): Promise<void>;
  update(comment: ReviewComment): Promise<void>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

export interface IFileRepository {
  exists(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  ensureDirectory(path: string): Promise<void>;
}

export interface IGitRepository {
  getCurrentBranch(workspaceRoot: string): Promise<string>;
  getFileContent(workspaceRoot: string, filePath: string, ref?: string): Promise<string>;
  getChangedFiles(workspaceRoot: string): Promise<string[]>;
}