import * as vscode from 'vscode';
import * as path from 'path';
import { ReviewComment, ReviewSession, Priority } from '../models/types';
import { COMMENT_TYPE_EMOJIS } from '../models/constants';
import { FileSystemService } from './fileSystemService';
import { GitService } from './gitService';
import { PathValidator } from '../utils/validation';
import { errorLog, infoLog, debugLog } from './loggingService';
import { IReviewService } from './interfaces';
import { IReviewRepository } from '../repositories/interfaces';
import { ReviewRepository } from '../repositories/reviewRepository';

export class ReviewService implements IReviewService {
  private static instance: ReviewService;
  private currentReviewFile: string | null = null;
  private fileSystemService: FileSystemService;
  private gitService: GitService;
  private reviewRepository: IReviewRepository;

  private constructor() {
    this.fileSystemService = FileSystemService.getInstance();
    this.gitService = GitService.getInstance();
    this.fileSystemService.ensureReviewsDirectory();
    
    // Initialize repository
    const reviewsDirectory = this.fileSystemService.getReviewsDirectory();
    this.reviewRepository = new ReviewRepository(this.fileSystemService, reviewsDirectory);
  }

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  public getComments(): ReviewComment[] {
    // Return cached comments for synchronous access
    return this._cachedComments || [];
  }

  private _cachedComments: ReviewComment[] = [];

  private async updateCache(): Promise<void> {
    this._cachedComments = await this.reviewRepository.findAll();
  }

  public getCommentsForFile(file: string): ReviewComment[] {
    // Return from cached comments
    return this._cachedComments.filter(c => c.file === file);
  }

  public addComment(comment: ReviewComment): void {
    // Update cache immediately for synchronous access
    const existingIndex = this._cachedComments.findIndex(c => c.id === comment.id);
    if (existingIndex !== -1) {
      this._cachedComments[existingIndex] = comment;
      debugLog('Updated existing comment:', comment.id);
    } else {
      this._cachedComments.push(comment);
      debugLog('Added new comment:', comment.id);
    }
    
    // Save to repository asynchronously
    this.reviewRepository.save(comment).then(() => {
      this.autoSaveReview();
    }).catch(error => {
      errorLog('Failed to save comment:', error);
    });
  }

  public deleteComment(commentId: string): boolean {
    debugLog('deleteComment called with commentId:', commentId);
    
    // Update cache immediately
    const index = this._cachedComments.findIndex(c => c.id === commentId);
    if (index !== -1) {
      this._cachedComments.splice(index, 1);
      debugLog('Deleted comment from cache:', commentId);
      
      // Delete from repository asynchronously
      this.reviewRepository.delete(commentId).then(() => {
        this.autoSaveReview();
      }).catch(error => {
        errorLog('Failed to delete comment from repository:', error);
      });
      
      return true;
    }
    
    debugLog('Comment not found:', commentId);
    return false;
  }

  public async loadExistingComments(workspaceRoot: string): Promise<void> {
    try {
      const branch = await this.gitService.getCurrentBranch(workspaceRoot);
      await (this.reviewRepository as ReviewRepository).loadFromFile(branch);
      await this.updateCache();
      infoLog(`Loaded ${this._cachedComments.length} existing comments for branch: ${branch}`);
    } catch (error) {
      errorLog('Error loading existing comments:', error);
    }
  }

  public async initializeReviewFile(workspaceRoot: string): Promise<void> {
    try {
      debugLog('Initializing review file for workspace:', workspaceRoot);
      const branch = await this.gitService.getCurrentBranch(workspaceRoot);
      debugLog('Branch returned from gitService:', branch);
      
      const validatedBranch = PathValidator.validateBranchName(branch);
      this.currentReviewFile = `review-${validatedBranch}.md`;
      debugLog('Review file set to:', this.currentReviewFile);
      
      // Don't overwrite if we loaded existing comments
      if (this._cachedComments.length === 0) {
        await this.autoSaveReview();
      }
    } catch (error) {
      errorLog('Failed to initialize review file:', error);
      // Use a default safe filename
      this.currentReviewFile = 'review-main.md';
    }
  }

  private async autoSaveReview(): Promise<void> {
    if (!this.currentReviewFile) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        await this.initializeReviewFile(workspaceRoot);
      }
      if (!this.currentReviewFile) return;
    }
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let branch = 'main';
    
    if (workspaceRoot) {
      branch = await this.gitService.getCurrentBranch(workspaceRoot);
      try {
        branch = PathValidator.validateBranchName(branch);
      } catch (error) {
        errorLog('Invalid branch name for autoSave:', branch, error);
        branch = 'main';
      }
    }

    const markdown = this.generateMarkdown(branch);
    
    try {
      const reviewsDir = this.fileSystemService.getReviewsDirectory();
      // Validate file path before writing
      const filepath = PathValidator.safeJoin(reviewsDir, this.currentReviewFile);
      this.fileSystemService.writeFile(filepath, markdown);
      
      // Also save as JSON for programmatic access
      const jsonFilename = this.currentReviewFile.replace('.md', '.json');
      const jsonPath = PathValidator.safeJoin(reviewsDir, jsonFilename);
      // Save to repository
      await (this.reviewRepository as ReviewRepository).saveToFile(branch);
    } catch (error) {
      errorLog('Error saving review file:', error);
    }
  }

  public generateMarkdown(branch: string): string {
    // Get comments synchronously for backward compatibility
    const comments = this.getComments();
    const critical = comments.filter(c => c.priority === Priority.Critical);
    const high = comments.filter(c => c.priority === Priority.High);
    const medium = comments.filter(c => c.priority === Priority.Medium);
    const low = comments.filter(c => c.priority === Priority.Low);
    
    let markdown = `# Code Review

**Branch**: \`${branch}\`  
**Date**: ${new Date().toLocaleString()}  
**Total Comments**: ${comments.length}  

## Summary
- **Critical**: ${critical.length}
- **High Priority**: ${high.length}
- **Medium Priority**: ${medium.length}
- **Low Priority**: ${low.length}

`;

    if (critical.length > 0) {
      markdown += `## 🚨 CRITICAL ISSUES\n\n`;
      critical.forEach((comment, index) => {
        markdown += this.formatCommentForAI(comment, `CRITICAL-${index + 1}`);
      });
    }

    if (high.length > 0) {
      markdown += `## ⚠️ HIGH PRIORITY ISSUES\n\n`;
      high.forEach((comment, index) => {
        markdown += this.formatCommentForAI(comment, `HIGH-${index + 1}`);
      });
    }

    if (medium.length > 0) {
      markdown += `## 🟡 MEDIUM PRIORITY ISSUES\n\n`;
      medium.forEach((comment, index) => {
        markdown += this.formatCommentForAI(comment, `MEDIUM-${index + 1}`);
      });
    }

    if (low.length > 0) {
      markdown += `## 🟢 LOW PRIORITY ISSUES\n\n`;
      low.forEach((comment, index) => {
        markdown += this.formatCommentForAI(comment, `LOW-${index + 1}`);
      });
    }

    // AI Instructions
    markdown += `
## 🤖 AI AGENT INSTRUCTIONS

### Task Overview
Please review and fix all issues listed above, prioritizing CRITICAL and HIGH priority items first.

### For Each Issue:
1. **Locate the file and line number specified**
2. **Read the surrounding context to understand the problem**
3. **Implement the suggested fix or your own solution**
4. **Test that your changes don't break existing functionality**

### Priority Order:
1. Fix all CRITICAL issues first
2. Then HIGH priority issues
3. Then MEDIUM priority issues
4. Finally LOW priority issues

---
*Generated by DiffPilot VSCode Extension*
`;

    return markdown;
  }

  private formatCommentForAI(comment: ReviewComment, issueId: string): string {
    const typeEmoji = COMMENT_TYPE_EMOJIS[comment.type] || '';

    let md = `### ${issueId}: ${typeEmoji} ${this.capitalizeFirst(comment.type)}

**File**: \`${comment.file}\`  
**Line**: ${comment.line}${comment.endLine && comment.endLine !== comment.line ? `-${comment.endLine}` : ''}  

**Comment**: ${comment.comment}

---

`;

    return md;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  public getCurrentReviewFile(): string | null {
    return this.currentReviewFile;
  }

  public getCommentCount(): number {
    const comments = this.getComments();
    return comments.length;
  }

  public clearComments(): void {
    // Clear cache immediately
    this._cachedComments = [];
    
    // Clear repository asynchronously
    this.reviewRepository.clear().then(() => {
      this.autoSaveReview();
    }).catch(error => {
      errorLog('Failed to clear comments:', error);
    });
  }
}