import * as vscode from 'vscode';
import { ChangedFile, ReviewComment } from '../models/types';
import { getWebviewContent } from '../webview';
import { FileContentService, DiffContent } from '../services/fileContentService';
import { debugLog, errorLog } from '../services/loggingService';
import { IncomingWebviewMessage, AddCommentMessage, EditCommentMessage, DeleteCommentMessage } from '../models/webviewTypes';

export class FileReviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private currentFile: ChangedFile | undefined;
  private fileContent: string = '';
  private diffContent: DiffContent | undefined;
  private comments: ReviewComment[] = [];
  private fileContentService: FileContentService;
  private disposables: vscode.Disposable[] = [];
  
  constructor(
    private context: vscode.ExtensionContext,
    private onCommentAdded: (comment: ReviewComment) => void,
    private onCommentDeleted: (commentId: string) => void,
    private getCommentsForFile: (file: string) => ReviewComment[]
  ) {
    this.fileContentService = FileContentService.getInstance();
  }

  async show(file: ChangedFile, workspaceRoot: string) {
    debugLog('show() called with:', { file, workspaceRoot });
    this.currentFile = file;
    
    try {
      // Validate file path
      this.fileContentService.validateFilePath(workspaceRoot, file.path);
      
      // Load file content using the service
      const result = await this.fileContentService.loadFileContent(file, workspaceRoot);
      this.fileContent = result.content;
      this.diffContent = result.diff;
      
    } catch (error) {
      errorLog('Error loading file:', error);
      this.handleLoadError(file, error);
      return;
    }
    
    // Get comments for this file
    this.comments = this.getCommentsForFile(file.path);
    debugLog('Comments for file:', this.comments.length);
    
    if (this.panel) {
      debugLog('Revealing existing panel');
      this.panel.reveal();
      // Force refresh the webview content to ensure updates are shown
      debugLog('Force refreshing webview content');
      this.panel.webview.html = '';  // Clear first
    } else {
      this.createPanel(file);
    }
    
    this.updateWebview();
  }

  private handleLoadError(file: ChangedFile, error: unknown): void {
    this.fileContent = `// Error loading file: ${error}`;
    this.diffContent = {
      original: '',
      modified: this.fileContent
    };
    
    // Still show the panel with error message
    this.comments = [];
    if (this.panel) {
      this.panel.reveal();
      this.panel.webview.html = '';
    } else {
      this.createPanel(file);
    }
    this.updateWebview();
  }


  private createPanel(file: ChangedFile): void {
    debugLog('Creating new webview panel');
    this.panel = vscode.window.createWebviewPanel(
      'diffpilotReview',
      `Review: ${file.path}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const messageDisposable = this.panel.webview.onDidReceiveMessage(
      async (message: IncomingWebviewMessage) => {
        debugLog('Received webview message:', message.command);
        try {
          switch (message.command) {
            case 'addComment':
              await this.handleAddComment(message as AddCommentMessage);
              break;
            case 'editComment':
              await this.handleEditComment(message as EditCommentMessage);
              break;
            case 'deleteComment':
              await this.handleDeleteComment(message as DeleteCommentMessage);
              break;
          }
        } catch (error) {
          errorLog('Error handling webview message:', error);
          vscode.window.showErrorMessage(`Error: ${error}`);
        }
      },
      undefined,
      this.context.subscriptions
    );
    this.disposables.push(messageDisposable);

    const disposeDisposable = this.panel.onDidDispose(() => {
      debugLog('Panel disposed');
      this.cleanupPanel();
    }, null, this.context.subscriptions);
    this.disposables.push(disposeDisposable);
  }

  private async handleAddComment(message: AddCommentMessage): Promise<void> {
    if (!this.currentFile || !this.panel) return;
    
    const comment: ReviewComment = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      file: this.currentFile.path,
      line: message.line,
      comment: message.comment,
      type: message.type,
      priority: message.priority,
      timestamp: new Date().toISOString()
    };
    
    this.comments.push(comment);
    this.onCommentAdded(comment);
    
    // Send the new comment back to the webview to update DOM dynamically
    this.panel.webview.postMessage({
      command: 'commentAdded',
      comment: comment
    });
  }
  
  private async handleEditComment(message: EditCommentMessage): Promise<void> {
    if (!this.panel) return;
    
    const index = this.comments.findIndex(c => c.id === message.commentId);
    if (index !== -1) {
      const updatedComment = {
        ...this.comments[index],
        comment: message.comment,
        type: message.type,
        priority: message.priority,
        timestamp: new Date().toISOString()
      };
      this.onCommentAdded(updatedComment); // Trigger save
      
      // Update local comments array after edit
      if (this.currentFile) {
        this.comments = this.getCommentsForFile(this.currentFile.path);
      }
      
      // Send the updated comment back to the webview to update DOM dynamically
      this.panel.webview.postMessage({
        command: 'commentUpdated',
        comment: updatedComment
      });
    }
  }
  
  private async handleDeleteComment(message: DeleteCommentMessage): Promise<void> {
    debugLog('handleDeleteComment called with:', message);
    if (!this.panel) {
      debugLog('No panel available');
      return;
    }
    
    // Don't delete from local comments array - just notify parent
    debugLog('Calling onCommentDeleted to delete from main list');
    this.onCommentDeleted(message.commentId);
    
    // Update local comments array after deletion
    if (this.currentFile) {
      this.comments = this.getCommentsForFile(this.currentFile.path);
      debugLog('Updated local comments after deletion:', this.comments.length);
    }
    
    // Send the deleted comment ID back to the webview to update DOM dynamically
    debugLog('Sending commentDeleted message to webview');
    this.panel.webview.postMessage({
      command: 'commentDeleted',
      commentId: message.commentId
    });
  }

  private updateWebview() {
    debugLog('updateWebview() called');
    if (!this.panel || !this.currentFile) {
      debugLog('No panel or currentFile, skipping update');
      return;
    }
    
    try {
      debugLog('Updating webview for:', this.currentFile.path);
      debugLog('Has diff content:', !!this.diffContent);
      this.panel.title = `Review: ${this.currentFile.path}`;
      const htmlContent = getWebviewContent(
        this.currentFile.path,
        this.fileContent,
        this.comments,
        !!this.diffContent,  // Use diff view whenever we have diff content
        this.diffContent,
        this.panel.webview
      );
      debugLog('HTML content generated, length:', htmlContent.length);
      // Add timestamp comment to force refresh and prevent caching
      const timestampedHtml = `<!-- Generated at ${new Date().toISOString()} -->\n${htmlContent}`;
      this.panel.webview.html = timestampedHtml;
      debugLog('Webview updated successfully with timestamp');
    } catch (error) {
      errorLog('Error updating webview:', error);
      this.panel.webview.html = `
        <html>
          <body style="padding: 20px;">
            <h2>Error loading file</h2>
            <p>${error}</p>
          </body>
        </html>
      `;
    }
  }

  private cleanupPanel(): void {
    // Clean up disposables specific to the panel
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    
    // Clear references
    this.panel = undefined;
    this.currentFile = undefined;
    this.fileContent = '';
    this.diffContent = undefined;
    this.comments = [];
  }

  dispose(): void {
    debugLog('Disposing FileReviewPanel');
    if (this.panel) {
      this.panel.dispose();
    }
    this.cleanupPanel();
  }
}