import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWebviewContent } from './webview';

// Debug flag - set to true to enable verbose logging
const DEBUG = false;

// Debug logging helper
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[DiffPilot]', ...args);
  }
}

// Error logging helper (always shown)
function errorLog(...args: any[]) {
  console.error('[DiffPilot]', ...args);
}

// Info logging helper (always shown for important events)
function infoLog(...args: any[]) {
  console.log('[DiffPilot]', ...args);
}

// Git API helper
async function getGitAPI() {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    throw new Error('Git extension not available');
  }
  
  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }
  
  const gitApi = gitExtension.exports.getAPI(1);
  return gitApi;
}

interface ReviewComment {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  comment: string;
  type: 'issue' | 'suggestion' | 'question' | 'praise';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

interface ChangedFile {
  path: string;
  status: 'modified' | 'added' | 'untracked' | 'deleted';
  staged: boolean;
}

class ChangedFilesProvider implements vscode.TreeDataProvider<ChangedFile> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChangedFile | undefined | null | void> = new vscode.EventEmitter<ChangedFile | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ChangedFile | undefined | null | void> = this._onDidChangeTreeData.event;

  private files: ChangedFile[] = [];
  private autoRefreshInterval: NodeJS.Timer | undefined;

  constructor() {
    // Auto-refresh every 2 seconds
    this.startAutoRefresh();
  }

  startAutoRefresh(): void {
    debugLog('Starting auto-refresh');
    this.refresh();
    this.autoRefreshInterval = setInterval(() => {
      debugLog('Auto-refresh triggered');
      this.refresh();
    }, 2000);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = undefined;
    }
  }

  async refresh(): Promise<void> {
    try {
      debugLog('Refreshing file list');
      this.files = await this.getGitChanges();
      debugLog('Found', this.files.length, 'changed files');
      this._onDidChangeTreeData.fire();
    } catch (error) {
      errorLog('Error during refresh:', error);
    }
  }

  private async getGitChanges(): Promise<ChangedFile[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return [];

    try {
      const gitAPI = await getGitAPI();
      const repository = gitAPI.repositories.find((repo: any) => 
        repo.rootUri.fsPath === workspaceRoot
      );
      
      if (!repository) {
        throw new Error('No Git repository found in workspace');
      }
      
      const changes = repository.state.workingTreeChanges;
      const indexChanges = repository.state.indexChanges;
      const untrackedChanges = repository.state.untrackedChanges || [];
      
      // Combine all changes
      const changeMap = new Map<string, ChangedFile>();
      
      // Process index changes (staged)
      indexChanges.forEach((change: any) => {
        const relativePath = path.relative(workspaceRoot, change.uri.fsPath);
        let status: ChangedFile['status'] = 'modified';
        
        switch (change.status) {
          case 7: // UNTRACKED
            status = 'untracked';
            break;
          case 6: // ADDED
          case 14: // ADDED_BY_US
          case 15: // ADDED_BY_THEM
            status = 'added';
            break;
          case 2: // DELETED
          case 12: // DELETED_BY_US
          case 13: // DELETED_BY_THEM
            status = 'deleted';
            break;
          default:
            status = 'modified';
        }
        
        changeMap.set(relativePath, { path: relativePath, status, staged: true });
      });
      
      // Process working tree changes (unstaged)
      changes.forEach((change: any) => {
        const relativePath = path.relative(workspaceRoot, change.uri.fsPath);
        if (!changeMap.has(relativePath)) {
          let status: ChangedFile['status'] = 'modified';
          
          switch (change.status) {
            case 7: // UNTRACKED
              status = 'untracked';
              break;
            case 6: // ADDED
            case 14: // ADDED_BY_US
            case 15: // ADDED_BY_THEM
              status = 'added';
              break;
            case 2: // DELETED
            case 12: // DELETED_BY_US
            case 13: // DELETED_BY_THEM
              status = 'deleted';
              break;
            default:
              status = 'modified';
          }
          
          changeMap.set(relativePath, { path: relativePath, status, staged: false });
        }
      });
      
      // Add untracked files
      untrackedChanges.forEach((uri: vscode.Uri) => {
        const relativePath = path.relative(workspaceRoot, uri.fsPath);
        if (!changeMap.has(relativePath)) {
          changeMap.set(relativePath, { path: relativePath, status: 'untracked', staged: false });
        }
      });
      
      const files = Array.from(changeMap.values())
        .filter(file => {
          // Filter out directories
          const fullPath = path.join(workspaceRoot, file.path);
          try {
            const stat = fs.statSync(fullPath);
            const isFile = stat.isFile();
            if (!isFile) {
              debugLog('Filtering out directory:', file.path);
            }
            return isFile;
          } catch (err) {
            // For deleted files or inaccessible paths, include them
            debugLog('Could not stat file (likely deleted):', file.path);
            return true;
          }
        });
      
      debugLog('Found', files.length, 'changed files');
      
      return files.sort((a, b) => {
        // Sort by status then by path
        if (a.status !== b.status) {
          const order = ['modified', 'added', 'untracked', 'deleted'];
          return order.indexOf(a.status) - order.indexOf(b.status);
        }
        return a.path.localeCompare(b.path);
      });
    } catch (error) {
      console.error('Error getting git changes:', error);
      return [];
    }
  }

  getTreeItem(element: ChangedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.path,
      vscode.TreeItemCollapsibleState.None
    );
    
    item.command = {
      command: 'diffpilot.openFile',
      title: 'Open File',
      arguments: [element]
    };

    // Add icons and colors based on status
    const iconMap: Record<string, { icon: string; color: string }> = {
      modified: { icon: 'edit', color: 'gitDecoration.modifiedResourceForeground' },
      added: { icon: 'add', color: 'gitDecoration.addedResourceForeground' },
      untracked: { icon: 'question', color: 'gitDecoration.untrackedResourceForeground' },
      deleted: { icon: 'trash', color: 'gitDecoration.deletedResourceForeground' }
    };

    const { icon, color } = iconMap[element.status];
    item.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
    
    // Add description showing status
    const statusLabels: Record<string, string> = {
      modified: 'M',
      added: 'A',
      untracked: 'U',
      deleted: 'D'
    };
    
    item.description = `${element.staged ? '●' : '○'} ${statusLabels[element.status]}`;
    item.contextValue = element.status;
    
    // Tooltip
    item.tooltip = `${element.path}\nStatus: ${element.status}${element.staged ? ' (staged)' : ''}`;

    return item;
  }

  getChildren(element?: ChangedFile): Thenable<ChangedFile[]> {
    if (!element) {
      return Promise.resolve(this.files);
    }
    return Promise.resolve([]);
  }

  dispose(): void {
    this.stopAutoRefresh();
  }
}

class FileReviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private currentFile: ChangedFile | undefined;
  private fileContent: string = '';
  private diffContent: { original: string; modified: string } | undefined;
  private comments: ReviewComment[] = [];
  
  constructor(
    private context: vscode.ExtensionContext,
    private onCommentAdded: (comment: ReviewComment) => void,
    private onCommentDeleted: (commentId: string) => void,
    private getCommentsForFile: (file: string) => ReviewComment[]
  ) {}

  async show(file: ChangedFile, workspaceRoot: string) {
    debugLog('show() called with:', { file, workspaceRoot });
    this.currentFile = file;
    const fullPath = path.join(workspaceRoot, file.path);
    debugLog('Full path:', fullPath);
    
    // Reset diff content
    this.diffContent = undefined;
    
    try {
      // Check if file exists and is actually a file
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        debugLog('File stats:', { exists: true, isFile: stat.isFile(), isDirectory: stat.isDirectory() });
        if (!stat.isFile()) {
          throw new Error(`Path is not a file: ${fullPath}`);
        }
      } else if (file.status !== 'deleted') {
        throw new Error(`File does not exist: ${fullPath}`);
      }
      
      // For new/untracked files, just read the file - no git operations needed
      if (file.status === 'added' || file.status === 'untracked') {
        debugLog('Handling new/untracked file');
        this.fileContent = fs.readFileSync(fullPath, 'utf8');
        debugLog('File content length:', this.fileContent.length);
        // Create a diff where everything is new (all lines are additions)
        this.diffContent = {
          original: '',
          modified: this.fileContent
        };
        debugLog('Diff content created for new file');
      } else if (file.status === 'modified') {
        // For modified files, get the diff
        const gitAPI = await getGitAPI();
        const repository = gitAPI.repositories.find((repo: any) => 
          repo.rootUri.fsPath === workspaceRoot
        );
        
        if (!repository) {
          throw new Error('No Git repository found');
        }
        
        const originalContent = await repository.show('HEAD', file.path);
        const modifiedContent = fs.readFileSync(fullPath, 'utf8');
        
        this.diffContent = {
          original: originalContent,
          modified: modifiedContent
        };
        
        this.fileContent = modifiedContent;
      } else if (file.status === 'deleted') {
        // For deleted files, show everything as removed
        const gitAPI = await getGitAPI();
        const repository = gitAPI.repositories.find((repo: any) => 
          repo.rootUri.fsPath === workspaceRoot
        );
        
        if (!repository) {
          throw new Error('No Git repository found');
        }
        
        const deletedContent = await repository.show('HEAD', file.path);
        this.fileContent = deletedContent;
        this.diffContent = {
          original: deletedContent,
          modified: ''
        };
      }
    } catch (error) {
      errorLog('Error in show():', error);
      this.fileContent = `// Unable to read file: ${error}`;
      // Still set diff content to avoid issues
      this.diffContent = {
        original: '',
        modified: this.fileContent
      };
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

      this.panel.webview.onDidReceiveMessage(
        async message => {
          debugLog('Received webview message:', message.command);
          try {
            switch (message.command) {
              case 'addComment':
                await this.handleAddComment(message);
                break;
              case 'editComment':
                await this.handleEditComment(message);
                break;
              case 'deleteComment':
                await this.handleDeleteComment(message);
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

      this.panel.onDidDispose(() => {
        debugLog('Panel disposed');
        this.panel = undefined;
        this.currentFile = undefined;
        this.fileContent = '';
        this.diffContent = undefined;
      }, null, this.context.subscriptions);
    }
    
    this.updateWebview();
  }

  private async handleAddComment(message: any) {
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
  
  private async handleEditComment(message: any) {
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
  
  private async handleDeleteComment(message: any) {
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
        this.diffContent
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

  dispose() {
    debugLog('Disposing FileReviewPanel');
    this.panel?.dispose();
    this.panel = undefined;
    this.currentFile = undefined;
  }
}

export class DiffPilotReviewer {
  private changedFilesProvider: ChangedFilesProvider;
  private statusBarItem: vscode.StatusBarItem;
  private reviewsDir: string;
  private currentReviewFile: string | null = null;
  private comments: ReviewComment[] = [];
  private fileReviewPanel: FileReviewPanel;

  constructor(private context: vscode.ExtensionContext) {
    this.reviewsDir = this.getReviewsDirectory();
    this.ensureReviewsDirectory();
    
    // Initialize providers
    this.changedFilesProvider = new ChangedFilesProvider();
    context.subscriptions.push(this.changedFilesProvider);
    
    // Create file review panel
    this.fileReviewPanel = new FileReviewPanel(
      context,
      (comment) => this.addComment(comment),
      (commentId) => this.deleteComment(commentId),
      (file) => this.getCommentsForFile(file)
    );
    
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'diffpilot.showReviewPanel';
    context.subscriptions.push(this.statusBarItem);
    
    // Load existing comments for today
    this.loadExistingComments();
    
    this.updateStatusBar();
    
    // Initialize review file on startup
    this.initializeReviewFile();
  }

  private getReviewsDirectory(): string {
    const config = vscode.workspace.getConfiguration('diffpilot');
    const reviewsDir = config.get('reviewsDirectory', '.vscode/reviews');
    
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, reviewsDir);
    }
    return reviewsDir;
  }

  private ensureReviewsDirectory(): void {
    if (!fs.existsSync(this.reviewsDir)) {
      fs.mkdirSync(this.reviewsDir, { recursive: true });
    }
  }

  async openFile(file: ChangedFile): Promise<void> {
    debugLog('openFile() called with:', file);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      errorLog('No workspace root found');
      return;
    }
    
    try {
      // Show the file in our custom webview
      await this.fileReviewPanel.show(file, workspaceRoot);
      debugLog('openFile() completed successfully');
    } catch (error) {
      errorLog('Error in openFile():', error);
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  private getCommentsForFile(file: string): ReviewComment[] {
    return this.comments.filter(c => c.file === file);
  }

  private addComment(comment: ReviewComment) {
    // Check if this is an edit (comment with same ID exists)
    const existingIndex = this.comments.findIndex(c => c.id === comment.id);
    if (existingIndex !== -1) {
      // Update existing comment
      this.comments[existingIndex] = comment;
      debugLog('Updated existing comment:', comment.id);
    } else {
      // Add new comment
      this.comments.push(comment);
      debugLog('Added new comment:', comment.id);
    }
    
    this.updateStatusBar();
    this.autoSaveReview();
    
    // Only show message for new comments
    if (existingIndex === -1) {
      vscode.window.showInformationMessage('Comment added successfully');
    }
  }

  private deleteComment(commentId: string) {
    debugLog('deleteComment called with commentId:', commentId);
    debugLog('Current comments before delete:', this.comments.length);
    const index = this.comments.findIndex(c => c.id === commentId);
    debugLog('Found comment at index:', index);
    if (index !== -1) {
      this.comments.splice(index, 1);
      debugLog('Deleted comment:', commentId);
      debugLog('Comments after delete:', this.comments.length);
      
      this.updateStatusBar();
      this.autoSaveReview();
      
      vscode.window.showInformationMessage('Comment deleted successfully');
    } else {
      debugLog('Comment not found in main list!');
    }
  }

  private loadExistingComments(): void {
    try {
      // Try to load review file for current branch
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return;
      
      getGitAPI().then(async gitAPI => {
        const repository = gitAPI.repositories.find((repo: any) => 
          repo.rootUri.fsPath === workspaceRoot
        );
        
        if (repository && repository.state.HEAD && repository.state.HEAD.name) {
          const branch = repository.state.HEAD.name;
          const filename = `review-${branch}.json`;
          const filepath = path.join(this.reviewsDir, filename);
          
          if (fs.existsSync(filepath)) {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            this.comments = data.comments || [];
            this.updateStatusBar();
            infoLog(`Loaded ${this.comments.length} existing comments for branch: ${branch}`);
          }
        }
      }).catch(() => {
        // Ignore errors
      });
    } catch (error) {
      // Ignore errors
    }
  }

  private updateStatusBar(): void {
    const commentCount = this.comments.length;
    this.statusBarItem.text = `$(comment-discussion) DiffPilot: ${commentCount} comments`;
    this.statusBarItem.tooltip = this.currentReviewFile ? 
      `Review file: ${this.currentReviewFile}\nClick to show DiffPilot panel` : 
      `Click to show DiffPilot panel`;
    this.statusBarItem.show();
  }

  private async initializeReviewFile(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    
    try {
      const gitAPI = await getGitAPI();
      const repository = gitAPI.repositories.find((repo: any) => 
        repo.rootUri.fsPath === workspaceRoot
      );
      
      if (repository && repository.state.HEAD && repository.state.HEAD.name) {
        const branch = repository.state.HEAD.name;
        this.currentReviewFile = `review-${branch}.md`;
        
        // Don't overwrite if we loaded existing comments
        if (this.comments.length === 0) {
          await this.autoSaveReview();
        }
      }
    } catch (error) {
      console.error('Failed to initialize review file:', error);
    }
  }

  private async autoSaveReview(): Promise<void> {
    if (!this.currentReviewFile) {
      await this.initializeReviewFile();
      if (!this.currentReviewFile) return;
    }
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let branch = 'unknown';
    
    if (workspaceRoot) {
      try {
        const gitAPI = await getGitAPI();
        const repository = gitAPI.repositories.find((repo: any) => 
          repo.rootUri.fsPath === workspaceRoot
        );
        
        if (repository && repository.state.HEAD && repository.state.HEAD.name) {
          branch = repository.state.HEAD.name;
        }
      } catch (error) {
        console.error('Error getting git branch:', error);
      }
    }

    const markdown = this.generateMarkdown(this.comments, branch);
    const filepath = path.join(this.reviewsDir, this.currentReviewFile);

    fs.writeFileSync(filepath, markdown, 'utf8');
    
    // Also save as JSON for programmatic access
    const jsonPath = filepath.replace('.md', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ branch, comments: this.comments, lastUpdated: new Date().toISOString() }, null, 2), 'utf8');
  }

  private generateMarkdown(comments: ReviewComment[], branch: string): string {
    const critical = comments.filter(c => c.priority === 'critical');
    const high = comments.filter(c => c.priority === 'high');
    const medium = comments.filter(c => c.priority === 'medium');
    const low = comments.filter(c => c.priority === 'low');
    
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
    const typeEmojis: Record<string, string> = {
      issue: '🐛',
      suggestion: '💡',
      question: '❓',
      praise: '👍'
    };

    let md = `### ${issueId}: ${typeEmojis[comment.type]} ${this.capitalizeFirst(comment.type)}

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

  dispose(): void {
    this.changedFilesProvider.dispose();
    this.statusBarItem.dispose();
    this.fileReviewPanel.dispose();
  }
}

export function activate(context: vscode.ExtensionContext) {
  infoLog('Extension activated');
  const reviewer = new DiffPilotReviewer(context);

  // Register tree data provider
  const treeView = vscode.window.createTreeView('diffpilot.changedFiles', {
    treeDataProvider: reviewer['changedFilesProvider'],
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);

  // Register commands
  const commands = [
    vscode.commands.registerCommand('diffpilot.openFile', (file: ChangedFile) => reviewer.openFile(file)),
    vscode.commands.registerCommand('diffpilot.showReviewPanel', () => {
      vscode.commands.executeCommand('diffpilot.changedFiles.focus');
    }),
    vscode.commands.registerCommand('diffpilot.refresh', () => {
      reviewer['changedFilesProvider'].refresh();
    })
  ];

  commands.forEach(command => context.subscriptions.push(command));
}

export function deactivate() {}