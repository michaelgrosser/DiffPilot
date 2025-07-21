import * as path from 'path';
import { ReviewComment } from '../models/types';
import { IReviewRepository } from './interfaces';
import { FileSystemService } from '../services/fileSystemService';
import { PathValidator } from '../utils/validation';

export class ReviewRepository implements IReviewRepository {
  private comments: ReviewComment[] = [];
  private fileSystemService: FileSystemService;
  private reviewsDirectory: string;

  constructor(fileSystemService: FileSystemService, reviewsDirectory: string) {
    this.fileSystemService = fileSystemService;
    this.reviewsDirectory = reviewsDirectory;
  }

  async findAll(): Promise<ReviewComment[]> {
    return [...this.comments];
  }

  async findByFile(filePath: string): Promise<ReviewComment[]> {
    return this.comments.filter(c => c.file === filePath);
  }

  async findById(id: string): Promise<ReviewComment | undefined> {
    return this.comments.find(c => c.id === id);
  }

  async save(comment: ReviewComment): Promise<void> {
    const existingIndex = this.comments.findIndex(c => c.id === comment.id);
    if (existingIndex !== -1) {
      this.comments[existingIndex] = comment;
    } else {
      this.comments.push(comment);
    }
  }

  async update(comment: ReviewComment): Promise<void> {
    const index = this.comments.findIndex(c => c.id === comment.id);
    if (index !== -1) {
      this.comments[index] = comment;
    }
  }

  async delete(id: string): Promise<boolean> {
    const index = this.comments.findIndex(c => c.id === id);
    if (index !== -1) {
      this.comments.splice(index, 1);
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    this.comments = [];
  }

  async loadFromFile(branch: string): Promise<void> {
    try {
      const validatedBranch = PathValidator.validateBranchName(branch);
      const filename = `review-${validatedBranch}.json`;
      const filepath = PathValidator.safeJoin(this.reviewsDirectory, filename);
      
      if (this.fileSystemService.fileExists(filepath)) {
        const content = this.fileSystemService.readFile(filepath);
        const data = JSON.parse(content);
        this.comments = data.comments || [];
      }
    } catch (error) {
      throw new Error(`Failed to load comments from file: ${error}`);
    }
  }

  async saveToFile(branch: string): Promise<void> {
    try {
      const validatedBranch = PathValidator.validateBranchName(branch);
      const jsonFilename = `review-${validatedBranch}.json`;
      const jsonPath = PathValidator.safeJoin(this.reviewsDirectory, jsonFilename);
      
      const jsonData = {
        branch: validatedBranch,
        comments: this.comments,
        lastUpdated: new Date().toISOString()
      };
      
      this.fileSystemService.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
    } catch (error) {
      throw new Error(`Failed to save comments to file: ${error}`);
    }
  }
}