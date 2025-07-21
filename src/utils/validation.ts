import * as path from 'path';
import * as fs from 'fs';
import { ValidationError } from '../models/errors';

/**
 * Validates and sanitizes file paths to prevent path traversal attacks
 */
export class PathValidator {
  /**
   * Validates that a path is within the specified workspace root
   * @param filePath - The path to validate (can be relative or absolute)
   * @param workspaceRoot - The workspace root directory
   * @returns The validated absolute path
   * @throws Error if the path is invalid or outside the workspace
   */
  static validatePath(filePath: string, workspaceRoot: string): string {
    // Normalize the workspace root
    const normalizedRoot = path.resolve(workspaceRoot);
    
    // Resolve the file path relative to workspace root
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    
    // Ensure the resolved path is within the workspace
    if (!resolvedPath.startsWith(normalizedRoot)) {
      throw new ValidationError(`Path traversal attempt detected: ${filePath}`, 'filePath');
    }
    
    // Additional checks for suspicious patterns
    if (filePath.includes('\0')) {
      throw new ValidationError('Null bytes in path are not allowed', 'filePath');
    }
    
    // Check for suspicious path segments
    const segments = filePath.split(/[/\\]/);
    const suspiciousSegments = segments.filter(seg => 
      seg === '.' || seg === '..' || seg.includes(':') || seg.includes('~')
    );
    
    if (suspiciousSegments.length > 0) {
      // Allow .. only if the final resolved path is still within workspace
      if (!resolvedPath.startsWith(normalizedRoot)) {
        throw new ValidationError(`Invalid path segments detected: ${suspiciousSegments.join(', ')}`, 'filePath');
      }
    }
    
    return resolvedPath;
  }
  
  /**
   * Validates a branch name to prevent injection attacks
   * @param branchName - The branch name to validate
   * @returns The validated branch name
   * @throws Error if the branch name contains invalid characters
   */
  static validateBranchName(branchName: string): string {
    // Git branch names have specific rules
    const invalidChars = /[\x00-\x1f\x7f ~^:?*\[\\]/;
    
    if (invalidChars.test(branchName)) {
      throw new ValidationError(`Invalid branch name: contains forbidden characters`, 'branchName');
    }
    
    if (branchName.startsWith('.') || branchName.startsWith('-')) {
      throw new ValidationError(`Invalid branch name: cannot start with . or -`, 'branchName');
    }
    
    if (branchName.endsWith('.') || branchName.endsWith('.lock')) {
      throw new ValidationError(`Invalid branch name: invalid ending`, 'branchName');
    }
    
    if (branchName.includes('..') || branchName.includes('//')) {
      throw new ValidationError(`Invalid branch name: contains invalid sequences`, 'branchName');
    }
    
    // Limit branch name length
    if (branchName.length > 255) {
      throw new ValidationError(`Invalid branch name: too long (max 255 characters)`, 'branchName');
    }
    
    return branchName;
  }
  
  /**
   * Safely joins paths and validates the result
   * @param workspaceRoot - The workspace root directory
   * @param ...pathSegments - Path segments to join
   * @returns The validated joined path
   * @throws Error if the resulting path is invalid
   */
  static safeJoin(workspaceRoot: string, ...pathSegments: string[]): string {
    // Filter out empty segments
    const validSegments = pathSegments.filter(seg => seg && seg.length > 0);
    
    // Join the path
    const joinedPath = path.join(workspaceRoot, ...validSegments);
    
    // Validate the result
    return this.validatePath(joinedPath, workspaceRoot);
  }
  
  /**
   * Checks if a path exists and is within the workspace
   * @param filePath - The path to check
   * @param workspaceRoot - The workspace root directory
   * @returns True if the path exists and is valid
   */
  static async pathExists(filePath: string, workspaceRoot: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(filePath, workspaceRoot);
      return fs.existsSync(validPath);
    } catch {
      return false;
    }
  }
}