import { ChangedFile, FileStatus } from '../models/types';
import { PathValidator } from '../utils/validation';
import { GitService } from './gitService';
import { FileSystemService } from './fileSystemService';
import { debugLog, errorLog } from './loggingService';
import { FileSystemError, ValidationError } from '../models/errors';

export interface DiffContent {
  original: string;
  modified: string;
}

export class FileContentService {
  private static instance: FileContentService;
  private gitService: GitService;
  private fileSystemService: FileSystemService;

  private constructor() {
    this.gitService = GitService.getInstance();
    this.fileSystemService = FileSystemService.getInstance();
  }

  public static getInstance(): FileContentService {
    if (!FileContentService.instance) {
      FileContentService.instance = new FileContentService();
    }
    return FileContentService.instance;
  }

  async loadFileContent(file: ChangedFile, workspaceRoot: string): Promise<{ content: string; diff?: DiffContent }> {
    const fullPath = PathValidator.safeJoin(workspaceRoot, file.path);
    debugLog('Loading file content for:', fullPath);

    // Validate file exists and is actually a file
    if (this.fileSystemService.fileExists(fullPath)) {
      if (!this.fileSystemService.isFile(fullPath)) {
        throw new FileSystemError(`Path is not a file: ${fullPath}`, fullPath);
      }
    } else if (file.status !== FileStatus.Deleted) {
      throw new FileSystemError(`File does not exist: ${fullPath}`, fullPath);
    }

    switch (file.status) {
      case FileStatus.Added:
      case FileStatus.Untracked:
        return this.loadNewFile(fullPath);
      
      case FileStatus.Modified:
        return this.loadModifiedFile(fullPath, workspaceRoot, file.path);
      
      case FileStatus.Deleted:
        return this.loadDeletedFile(workspaceRoot, file.path);
      
      default:
        throw new ValidationError(`Unsupported file status: ${file.status}`, 'file.status');
    }
  }

  private async loadNewFile(fullPath: string): Promise<{ content: string; diff: DiffContent }> {
    debugLog('Loading new/untracked file');
    const content = this.fileSystemService.readFile(fullPath);
    
    return {
      content,
      diff: {
        original: '',
        modified: content
      }
    };
  }

  private async loadModifiedFile(fullPath: string, workspaceRoot: string, filePath: string): Promise<{ content: string; diff: DiffContent }> {
    debugLog('Loading modified file');
    const originalContent = await this.gitService.getFileContentFromGit(workspaceRoot, filePath);
    const modifiedContent = this.fileSystemService.readFile(fullPath);
    
    return {
      content: modifiedContent,
      diff: {
        original: originalContent,
        modified: modifiedContent
      }
    };
  }

  private async loadDeletedFile(workspaceRoot: string, filePath: string): Promise<{ content: string; diff: DiffContent }> {
    debugLog('Loading deleted file');
    const deletedContent = await this.gitService.getFileContentFromGit(workspaceRoot, filePath);
    
    return {
      content: deletedContent,
      diff: {
        original: deletedContent,
        modified: ''
      }
    };
  }

  validateFilePath(workspaceRoot: string, filePath: string): string {
    try {
      return PathValidator.safeJoin(workspaceRoot, filePath);
    } catch (error) {
      errorLog('Invalid file path:', filePath, error);
      throw new ValidationError(`Invalid file path: ${error}`, 'filePath');
    }
  }
}