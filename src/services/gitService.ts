import * as vscode from 'vscode';
import * as path from 'path';
import { ChangedFile, FileStatus } from '../models/types';
import { GitStatus } from '../models/constants';
import { errorLog, debugLog } from './loggingService';
import { PathValidator } from '../utils/validation';
import { GitAPI, Repository, Change, GitExtension } from '../models/gitTypes';
import { GitOperationError } from '../models/errors';

export class GitService {
  private static instance: GitService;
  private gitApi: GitAPI | null = null;

  private constructor() {}

  public static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  private async ensureGitApi(): Promise<GitAPI> {
    if (this.gitApi) {
      return this.gitApi;
    }

    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
      throw new GitOperationError('Git extension not available. Please ensure Git is installed and the Git extension is enabled.', 'initialize');
    }
    
    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }
    
    this.gitApi = gitExtension.exports.getAPI(1);
    
    // Wait for repositories to be discovered
    if (this.gitApi.repositories.length === 0) {
      debugLog('Waiting for Git repositories to be discovered...');
      await new Promise<void>((resolve) => {
        let disposable: vscode.Disposable | undefined;
        let timeoutId: NodeJS.Timeout | undefined;
        let checkInterval: NodeJS.Timeout | undefined;
        
        const cleanup = () => {
          if (disposable) {
            disposable.dispose();
            disposable = undefined;
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = undefined;
          }
        };
        
        // Check periodically if repositories are available
        checkInterval = setInterval(() => {
          if (this.gitApi && this.gitApi.repositories.length > 0) {
            debugLog('Repository found via polling');
            cleanup();
            resolve();
          }
        }, 100);
        
        disposable = this.gitApi!.onDidOpenRepository(() => {
          debugLog('Repository opened, Git API ready');
          cleanup();
          resolve();
        });
        
        // Timeout after 5 seconds
        timeoutId = setTimeout(() => {
          debugLog('Git repository discovery timeout');
          cleanup();
          resolve();
        }, 5000);
      });
    }
    
    debugLog('Git API initialized with', this.gitApi!.repositories.length, 'repositories');
    
    return this.gitApi;
  }

  public async getRepository(workspaceRoot: string): Promise<Repository> {
    const gitAPI = await this.ensureGitApi();
    const repository = gitAPI.repositories.find((repo) => 
      repo.rootUri.fsPath === workspaceRoot
    );
    
    if (!repository) {
      throw new GitOperationError('No Git repository found in the current workspace. Please open a Git repository.', 'getRepository');
    }
    
    return repository;
  }

  public async getChangedFiles(workspaceRoot: string): Promise<ChangedFile[]> {
    try {
      const repository = await this.getRepository(workspaceRoot);
      
      const changes = repository.state.workingTreeChanges;
      const indexChanges = repository.state.indexChanges;
      const untrackedChanges = repository.state.untrackedChanges || [];
      
      // Combine all changes
      const changeMap = new Map<string, ChangedFile>();
      
      // Process index changes (staged)
      indexChanges.forEach((change: any) => {
        const relativePath = path.relative(workspaceRoot, change.uri.fsPath);
        const status = this.mapGitStatus(change.status);
        changeMap.set(relativePath, { path: relativePath, status, staged: true });
      });
      
      // Process working tree changes (unstaged)
      changes.forEach((change: any) => {
        const relativePath = path.relative(workspaceRoot, change.uri.fsPath);
        if (!changeMap.has(relativePath)) {
          const status = this.mapGitStatus(change.status);
          changeMap.set(relativePath, { path: relativePath, status, staged: false });
        }
      });
      
      // Add untracked files
      untrackedChanges.forEach((uri) => {
        const relativePath = path.relative(workspaceRoot, uri.fsPath);
        if (!changeMap.has(relativePath)) {
          changeMap.set(relativePath, { path: relativePath, status: FileStatus.Untracked, staged: false });
        }
      });
      
      return Array.from(changeMap.values());
    } catch (error) {
      errorLog('Error getting git changes:', error);
      if (error instanceof GitOperationError) {
        throw error;
      }
      throw new GitOperationError(`Failed to get changed files: ${error}`, 'getChangedFiles');
    }
  }

  private mapGitStatus(status: number): FileStatus {
    switch (status) {
      case GitStatus.UNTRACKED:
        return FileStatus.Untracked;
      case GitStatus.ADDED:
      case GitStatus.ADDED_BY_US:
      case GitStatus.ADDED_BY_THEM:
        return FileStatus.Added;
      case GitStatus.DELETED:
      case GitStatus.DELETED_BY_US:
      case GitStatus.DELETED_BY_THEM:
        return FileStatus.Deleted;
      default:
        return FileStatus.Modified;
    }
  }

  public async getFileContentFromGit(workspaceRoot: string, filePath: string, ref: string = 'HEAD'): Promise<string> {
    try {
      const repository = await this.getRepository(workspaceRoot);
      return await repository.show(ref, filePath);
    } catch (error) {
      errorLog(`Error getting file content from git for ${filePath}:`, error);
      if (error instanceof GitOperationError) {
        throw error;
      }
      throw new GitOperationError(`Failed to get file content for ${filePath}: ${error}`, 'getFileContent');
    }
  }

  public async getCurrentBranch(workspaceRoot: string): Promise<string> {
    try {
      const repository = await this.getRepository(workspaceRoot);
      
      // Wait a bit for repository state to be ready if needed
      if (!repository.state.HEAD) {
        debugLog('Repository HEAD not ready, waiting...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      debugLog('Repository state:', {
        hasHEAD: !!repository.state.HEAD,
        headName: repository.state.HEAD?.name,
        headCommit: repository.state.HEAD?.commit,
        headType: repository.state.HEAD?.type,
        headUpstream: repository.state.HEAD?.upstream
      });
      
      if (repository.state.HEAD) {
        // Check for branch name
        if (repository.state.HEAD.name) {
          debugLog('Branch detected:', repository.state.HEAD.name);
          return repository.state.HEAD.name;
        }
        
        // Check if we're in detached HEAD state
        if (repository.state.HEAD.commit) {
          debugLog('Detached HEAD state, using commit hash');
          return `detached-${repository.state.HEAD.commit.substring(0, 7)}`;
        }
      }
      
      debugLog('No branch name found, returning main as fallback');
      return 'main';
    } catch (error) {
      errorLog('Error getting current branch:', error);
      // Don't throw here - return a sensible default
      return 'main';
    }
  }

  public async getBranchList(workspaceRoot: string): Promise<string[]> {
    try {
      const repository = await this.getRepository(workspaceRoot);
      // Check if getRefs is available (it might not be in older Git extension versions)
      if (!repository.getRefs) {
        debugLog('getRefs not available in Git API');
        return [];
      }
      
      const refs = await repository.getRefs();
      
      return refs
        .filter((ref) => ref.type === 0) // 0 = Head (local branch)
        .map((ref) => ref.name || '')
        .filter((name): name is string => !!name);
    } catch (error) {
      errorLog('Error getting branch list:', error);
      // Don't throw here - return empty list
      return [];
    }
  }
}