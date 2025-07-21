import * as vscode from 'vscode';
import { ChangedFile } from './models/types';
import { COMMANDS } from './models/constants';
import { infoLog, errorLog, debugLog } from './services/loggingService';
import { ReviewService } from './services/reviewService';
import { ChangedFilesProvider } from './providers/changedFilesProvider';
import { FileReviewPanel } from './providers/webviewProvider';
import { DIContainer } from './services/container';
import { ErrorBoundary } from './utils/errorBoundary';
import { getUserFriendlyErrorMessage } from './models/errors';

export class DiffPilotReviewer implements vscode.Disposable {
  private changedFilesProvider: ChangedFilesProvider;
  private statusBarItem: vscode.StatusBarItem;
  private fileReviewPanel: FileReviewPanel;
  private reviewService: ReviewService;
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    // Initialize services
    this.reviewService = ReviewService.getInstance();
    
    // Initialize providers
    this.changedFilesProvider = new ChangedFilesProvider();
    this.disposables.push(this.changedFilesProvider);
    
    // Create file review panel
    this.fileReviewPanel = new FileReviewPanel(
      context,
      ErrorBoundary.wrapEventHandler(
        (comment) => {
          this.reviewService.addComment(comment);
          this.updateStatusBar();
          // Only show message for new comments
          const existingComment = this.reviewService.getComments().find(c => c.id === comment.id);
          if (!existingComment || existingComment.timestamp !== comment.timestamp) {
            vscode.window.showInformationMessage('Comment added successfully');
          }
        },
        'comment added handler'
      ),
      ErrorBoundary.wrapEventHandler(
        (commentId) => {
          const deleted = this.reviewService.deleteComment(commentId);
          if (deleted) {
            this.updateStatusBar();
            vscode.window.showInformationMessage('Comment deleted successfully');
          }
        },
        'comment deleted handler'
      ),
      (file) => this.reviewService.getCommentsForFile(file)
    );
    
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = COMMANDS.SHOW_REVIEW_PANEL;
    this.disposables.push(this.statusBarItem);
    
    // Initialize asynchronously to ensure Git extension is ready
    this.initializeAsync().catch(error => {
      errorLog('Failed to initialize DiffPilotReviewer:', error);
      const userMessage = getUserFriendlyErrorMessage(error);
      vscode.window.showErrorMessage(`DiffPilot: ${userMessage}`);
    });
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Give Git extension time to fully initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await this.loadExistingComments();
      await this.initializeReviewFile();
      this.updateStatusBar();
    } catch (error) {
      infoLog('Error during initialization:', error);
      // Still update status bar even if initialization fails
      this.updateStatusBar();
    }
  }

  private async loadExistingComments(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      await this.reviewService.loadExistingComments(workspaceRoot);
      this.updateStatusBar();
    }
  }

  private async initializeReviewFile(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      await this.reviewService.initializeReviewFile(workspaceRoot);
      this.updateStatusBar();
    }
  }

  private updateStatusBar(): void {
    const commentCount = this.reviewService.getCommentCount();
    const currentReviewFile = this.reviewService.getCurrentReviewFile();
    
    this.statusBarItem.text = `$(comment-discussion) DiffPilot: ${commentCount} comments`;
    this.statusBarItem.tooltip = currentReviewFile ? 
      `Review file: ${currentReviewFile}\nClick to show DiffPilot panel` : 
      `Click to show DiffPilot panel`;
    this.statusBarItem.show();
  }

  async openFile(file: ChangedFile): Promise<void> {
    await ErrorBoundary.wrapAsync(
      async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }
        
        // Show the file in our custom webview
        await this.fileReviewPanel.show(file, workspaceRoot);
      },
      'Failed to open file'
    );
  }

  refresh(): void {
    ErrorBoundary.wrap(
      () => this.changedFilesProvider.refresh(),
      'Failed to refresh file list'
    );
  }

  dispose(): void {
    debugLog('Disposing DiffPilotReviewer');
    
    // Dispose all disposables
    this.disposables.forEach(d => {
      try {
        d.dispose();
      } catch (error) {
        errorLog('Error disposing resource:', error);
      }
    });
    this.disposables = [];
    
    // Dispose file review panel separately as it's not in disposables
    try {
      this.fileReviewPanel.dispose();
    } catch (error) {
      errorLog('Error disposing FileReviewPanel:', error);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  try {
    infoLog('Extension activated');
    
    // Initialize DI container
    const container = DIContainer.getInstance();
    container.initialize();
    
    const reviewer = new DiffPilotReviewer(context);
    context.subscriptions.push(reviewer);

  // Register tree data provider
  const treeView = vscode.window.createTreeView('diffpilot.changedFiles', {
    treeDataProvider: reviewer['changedFilesProvider'],
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);
  
  // Force refresh when tree becomes visible
  context.subscriptions.push(
    treeView.onDidChangeVisibility(e => {
      if (e.visible) {
        debugLog('Tree view became visible, triggering refresh');
        reviewer.refresh();
      }
    })
  );

  // Register commands with error boundaries
  const commands = [
    vscode.commands.registerCommand(
      COMMANDS.OPEN_FILE, 
      ErrorBoundary.wrapCommand(
        (file: ChangedFile) => reviewer.openFile(file),
        COMMANDS.OPEN_FILE
      )
    ),
    vscode.commands.registerCommand(
      COMMANDS.SHOW_REVIEW_PANEL, 
      ErrorBoundary.wrapCommand(
        () => vscode.commands.executeCommand('diffpilot.changedFiles.focus'),
        COMMANDS.SHOW_REVIEW_PANEL
      )
    ),
    vscode.commands.registerCommand(
      COMMANDS.REFRESH, 
      ErrorBoundary.wrapCommand(
        () => reviewer.refresh(),
        COMMANDS.REFRESH
      )
    )
  ];

  commands.forEach(command => context.subscriptions.push(command));
  } catch (error) {
    errorLog('Failed to activate extension:', error);
    const userMessage = getUserFriendlyErrorMessage(error);
    vscode.window.showErrorMessage(`DiffPilot failed to activate: ${userMessage}`);
    throw error; // Re-throw to let VS Code know activation failed
  }
}

export function deactivate(): void {
  debugLog('Extension deactivated');
  // VS Code will automatically dispose all subscriptions
}