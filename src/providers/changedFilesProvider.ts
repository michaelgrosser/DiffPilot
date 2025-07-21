import * as vscode from 'vscode';
import { ChangedFile, FileStatus } from '../models/types';
import { FILE_STATUS_ICONS, FILE_STATUS_LABELS, COMMANDS } from '../models/constants';
import { GitService } from '../services/gitService';
import { FileSystemService } from '../services/fileSystemService';
import { debugLog, errorLog } from '../services/loggingService';
import { ErrorBoundary } from '../utils/errorBoundary';
import { GitOperationError } from '../models/errors';
import { GitExtension } from '../models/gitTypes';

export class ChangedFilesProvider implements vscode.TreeDataProvider<ChangedFile>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<ChangedFile | undefined | null | void> = new vscode.EventEmitter<ChangedFile | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ChangedFile | undefined | null | void> = this._onDidChangeTreeData.event;

  private files: ChangedFile[] = [];
  private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
  private gitService: GitService;
  private fileSystemService: FileSystemService;
  private disposables: vscode.Disposable[] = [];
  private refreshDebounceTimer: NodeJS.Timeout | undefined;
  private readonly DEBOUNCE_DELAY = 500; // 500ms debounce delay
  private temporaryPollInterval: NodeJS.Timer | undefined;

  constructor() {
    this.gitService = GitService.getInstance();
    this.fileSystemService = FileSystemService.getInstance();
    
    // Add EventEmitter to disposables
    this.disposables.push(this._onDidChangeTreeData);
    
    // Initialize asynchronously to ensure Git is ready
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      debugLog('Starting ChangedFilesProvider initialization');
      
      // Set up file system watcher
      this.setupFileSystemWatcher();
      
      // Wait longer for Git extension and tree view to be ready
      debugLog('Waiting for Git extension to be ready...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Initial refresh
      debugLog('Performing initial refresh');
      await this.refresh();
      
      // Temporary: Set up polling as a fallback until we figure out why watchers aren't working
      debugLog('Setting up temporary polling');
      this.temporaryPollInterval = setInterval(() => {
        debugLog('Temporary poll triggered');
        this.refresh().catch(error => {
          errorLog('Temporary poll refresh failed:', error);
        });
      }, 5000); // Poll every 5 seconds
      
      debugLog('ChangedFilesProvider initialization complete');
    } catch (error) {
      errorLog('Failed to initialize ChangedFilesProvider:', error);
    }
  }

  private setupFileSystemWatcher(): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceRoot) {
      debugLog('No workspace root found, skipping file watcher setup');
      return;
    }

    debugLog('Setting up file system watcher for workspace:', workspaceRoot.uri.fsPath);
    
    // Watch all files in the workspace, excluding common ignore patterns
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, '**/*'),
      false, // Don't ignore create events
      false, // Don't ignore change events
      false  // Don't ignore delete events
    );

    // Set up event handlers with debouncing
    const createDisposable = watcher.onDidCreate(uri => {
      debugLog('Watcher: File created event fired for', uri.fsPath);
      this.onFileSystemChange('created', uri);
    });
    const changeDisposable = watcher.onDidChange(uri => {
      debugLog('Watcher: File changed event fired for', uri.fsPath);
      this.onFileSystemChange('changed', uri);
    });
    const deleteDisposable = watcher.onDidDelete(uri => {
      debugLog('Watcher: File deleted event fired for', uri.fsPath);
      this.onFileSystemChange('deleted', uri);
    });
    
    this.disposables.push(createDisposable, changeDisposable, deleteDisposable);

    // Store watcher and add to disposables
    this.fileSystemWatcher = watcher;
    this.disposables.push(watcher);

    // Watch for Git-specific changes in key files
    const gitPatterns = [
      '.git/index',
      '.git/HEAD',
      '.git/refs/heads/**',
      '.git/COMMIT_EDITMSG'
    ];
    
    gitPatterns.forEach(pattern => {
      debugLog('Creating Git watcher for pattern:', pattern);
      const gitWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, pattern),
        false,
        false,
        false
      );
      
      const createDisp = gitWatcher.onDidCreate(uri => {
        debugLog('Git watcher: Create event for', uri.fsPath);
        this.onGitChange();
      });
      const changeDisp = gitWatcher.onDidChange(uri => {
        debugLog('Git watcher: Change event for', uri.fsPath);
        this.onGitChange();
      });
      const deleteDisp = gitWatcher.onDidDelete(uri => {
        debugLog('Git watcher: Delete event for', uri.fsPath);
        this.onGitChange();
      });
      
      this.disposables.push(gitWatcher, createDisp, changeDisp, deleteDisp);
    });

    // Set up Git extension listener after a delay to ensure it's ready
    setTimeout(() => {
      this.setupGitExtensionListener();
    }, 2000);
  }

  private setupGitExtensionListener(): void {
    debugLog('Setting up Git extension listener');
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
      debugLog('Git extension not found');
      return;
    }
    
    if (!gitExtension.isActive) {
      debugLog('Git extension not active, activating...');
      gitExtension.activate().then(() => {
        this.connectToGitRepository();
      });
    } else {
      this.connectToGitRepository();
    }
  }

  private connectToGitRepository(): void {
    try {
      const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
      if (!gitExtension || !gitExtension.isActive) {
        debugLog('Git extension not available');
        return;
      }
      
      const gitApi = gitExtension.exports.getAPI(1);
      debugLog('Git API obtained, repositories:', gitApi.repositories.length);
      
      if (gitApi.repositories.length > 0) {
        const repo = gitApi.repositories[0];
        debugLog('Connecting to repository at', repo.rootUri.fsPath);
        
        const stateChangeDisposable = repo.state.onDidChange(() => {
          debugLog('Git repository state changed!');
          this.debouncedRefresh();
        });
        
        this.disposables.push(stateChangeDisposable);
        debugLog('Git repository listener connected successfully');
      } else {
        debugLog('No Git repositories found');
      }
    } catch (error) {
      errorLog('Failed to set up Git extension listener:', error);
    }
  }

  private onFileSystemChange(event: string, uri: vscode.Uri): void {
    debugLog(`File system ${event}: ${uri.fsPath}`);
    
    // Ignore changes to certain directories/files
    const ignorePaths = ['node_modules', '.vscode/reviews'];
    if (ignorePaths.some(path => uri.fsPath.includes(path))) {
      return;
    }
    
    this.debouncedRefresh();
  }

  private onGitChange(): void {
    debugLog('Git repository changed');
    this.debouncedRefresh();
  }

  private debouncedRefresh(): void {
    // Clear any existing timer
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    
    // Set a new timer
    this.refreshDebounceTimer = setTimeout(() => {
      debugLog('Debounced refresh triggered');
      this.refresh().catch(error => {
        errorLog('Refresh failed:', error);
      });
    }, this.DEBOUNCE_DELAY);
  }

  async refresh(): Promise<void> {
    await ErrorBoundary.wrapAsync(
      async () => {
        debugLog('Refreshing file list');
        const oldCount = this.files.length;
        this.files = await this.getGitChanges();
        debugLog(`Found ${this.files.length} changed files (was ${oldCount})`);
        debugLog('Files:', this.files.map(f => f.path).join(', '));
        
        // Fire the event to update the tree view
        debugLog('Firing onDidChangeTreeData event');
        this._onDidChangeTreeData.fire();
      },
      'Failed to refresh file list',
      undefined
    );
  }

  private async getGitChanges(): Promise<ChangedFile[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return [];

    try {
      const allFiles = await this.gitService.getChangedFiles(workspaceRoot);
      const validFiles = this.fileSystemService.filterValidFiles(workspaceRoot, allFiles);
      
      debugLog('Found', validFiles.length, 'valid changed files');
      
      return this.sortFiles(validFiles as ChangedFile[]);
    } catch (error) {
      errorLog('Error getting git changes:', error);
      // Don't throw here - just return empty array to keep UI working
      return [];
    }
  }

  private sortFiles(files: ChangedFile[]): ChangedFile[] {
    return files.sort((a, b) => {
      // Sort by status then by path
      if (a.status !== b.status) {
        const order = [FileStatus.Modified, FileStatus.Added, FileStatus.Untracked, FileStatus.Deleted];
        return order.indexOf(a.status) - order.indexOf(b.status);
      }
      return a.path.localeCompare(b.path);
    });
  }

  getTreeItem(element: ChangedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.path,
      vscode.TreeItemCollapsibleState.None
    );
    
    item.command = {
      command: COMMANDS.OPEN_FILE,
      title: 'Open File',
      arguments: [element]
    };

    // Add icons and colors based on status
    const { icon, color } = FILE_STATUS_ICONS[element.status];
    item.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
    
    // Add description showing status
    const statusLabel = FILE_STATUS_LABELS[element.status];
    item.description = `${element.staged ? '●' : '○'} ${statusLabel}`;
    item.contextValue = element.status;
    
    // Tooltip
    item.tooltip = `${element.path}\nStatus: ${element.status}${element.staged ? ' (staged)' : ''}`;

    return item;
  }

  getChildren(element?: ChangedFile): Thenable<ChangedFile[]> {
    debugLog('getChildren called, returning', this.files.length, 'files');
    if (!element) {
      // If files is empty, try to refresh
      if (this.files.length === 0) {
        debugLog('No files cached, triggering refresh');
        // Don't await, just trigger the refresh
        this.refresh().catch(error => {
          errorLog('Background refresh failed:', error);
        });
      }
      return Promise.resolve(this.files);
    }
    return Promise.resolve([]);
  }

  dispose(): void {
    debugLog('Disposing ChangedFilesProvider');
    
    // Clear any pending refresh timer
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = undefined;
    }
    
    // Dispose all disposables (includes file watchers)
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    
    // Clear temporary poll interval
    if (this.temporaryPollInterval) {
      clearInterval(this.temporaryPollInterval);
      this.temporaryPollInterval = undefined;
    }
    
    // Clear references
    this.files = [];
    this.fileSystemWatcher = undefined;
  }
}