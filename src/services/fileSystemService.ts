import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PathValidator } from '../utils/validation';
import { errorLog, debugLog } from './loggingService';
import { CONFIG_NAMESPACE, DEFAULT_REVIEWS_DIR } from '../models/constants';
import { FileSystemError } from '../models/errors';

export class FileSystemService {
  private static instance: FileSystemService;

  private constructor() {}

  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  public readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      errorLog(`Error reading file ${filePath}:`, error);
      throw new FileSystemError(`Failed to read file: ${error}`, filePath);
    }
  }

  public writeFile(filePath: string, content: string): void {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      errorLog(`Error writing file ${filePath}:`, error);
      throw new FileSystemError(`Failed to write file: ${error}`, filePath);
    }
  }

  public fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      errorLog(`Error checking file existence ${filePath}:`, error);
      return false;
    }
  }

  public isFile(filePath: string): boolean {
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile();
    } catch (error) {
      debugLog(`Could not stat file ${filePath}:`, error);
      return false;
    }
  }

  public createDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      errorLog(`Error creating directory ${dirPath}:`, error);
      throw new FileSystemError(`Failed to create directory: ${error}`, dirPath);
    }
  }

  public getReviewsDirectory(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const reviewsDir = config.get('reviewsDirectory', DEFAULT_REVIEWS_DIR);
    
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      try {
        // Validate the reviews directory path
        return PathValidator.safeJoin(workspaceRoot, reviewsDir);
      } catch (error) {
        errorLog('Invalid reviews directory path:', reviewsDir, error);
        // Fall back to a safe default
        return path.join(workspaceRoot, '.vscode', 'reviews');
      }
    }
    return reviewsDir;
  }

  public ensureReviewsDirectory(): void {
    const reviewsDir = this.getReviewsDirectory();
    this.createDirectory(reviewsDir);
  }

  public safeReadFile(workspaceRoot: string, relativePath: string): string {
    const fullPath = PathValidator.safeJoin(workspaceRoot, relativePath);
    return this.readFile(fullPath);
  }

  public safeWriteFile(workspaceRoot: string, relativePath: string, content: string): void {
    const fullPath = PathValidator.safeJoin(workspaceRoot, relativePath);
    this.writeFile(fullPath, content);
  }

  public filterValidFiles(workspaceRoot: string, files: Array<{ path: string; status: string }>): Array<{ path: string; status: string }> {
    return files.filter(file => {
      try {
        // Filter out files in the reviews directory
        const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
        const reviewsDir = config.get('reviewsDirectory', DEFAULT_REVIEWS_DIR);
        if (file.path.startsWith(reviewsDir) || file.path.startsWith('.vscode/reviews')) {
          debugLog('Filtering out review file:', file.path);
          return false;
        }
        
        // Validate the path is within workspace
        const fullPath = PathValidator.safeJoin(workspaceRoot, file.path);
        
        // For deleted files, we can't check if they exist
        if (file.status === 'deleted') {
          return true;
        }
        
        // Filter out directories
        if (this.fileExists(fullPath) && !this.isFile(fullPath)) {
          debugLog('Filtering out directory:', file.path);
          return false;
        }
        
        return true;
      } catch (validationError) {
        // Invalid path - filter it out
        errorLog('Invalid file path detected:', file.path, validationError);
        return false;
      }
    });
  }
}