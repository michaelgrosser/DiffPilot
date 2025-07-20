// Debug flag - set to true to enable verbose logging
const DEBUG = false;

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  if (DEBUG) console.log('[DiffPilot] computeDiff called with original length:', original.length, 'modified length:', modified.length);
  
  // Handle edge cases first
  if (!original && !modified) {
    return [];
  }
  
  if (!original || original.length === 0) {
    // All lines are additions for new files
    const lines = modified.split('\n');
    if (DEBUG) console.log('[DiffPilot] New file - all lines are additions:', lines.length);
    return lines.map((line, index) => ({
      type: 'added' as const,
      content: line,
      newLineNumber: index + 1
    }));
  }
  
  if (!modified || modified.length === 0) {
    // All lines are deletions for deleted files
    const lines = original.split('\n');
    if (DEBUG) console.log('[DiffPilot] Deleted file - all lines are removals:', lines.length);
    return lines.map((line, index) => ({
      type: 'removed' as const,
      content: line,
      oldLineNumber: index + 1
    }));
  }
  
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const diff: DiffLine[] = [];
  
  if (DEBUG) console.log('[DiffPilot] Computing diff between', originalLines.length, 'original lines and', modifiedLines.length, 'modified lines');
  
  // Simple line-by-line diff (for MVP - could be enhanced with proper diff algorithm)
  let oldIndex = 0;
  let newIndex = 0;
  
  // Create a map of lines for quick lookup
  const modifiedSet = new Set(modifiedLines);
  const originalSet = new Set(originalLines);
  
  // Process all lines with safety check
  let iterations = 0;
  const maxIterations = originalLines.length + modifiedLines.length + 100; // Safety margin
  
  while (oldIndex < originalLines.length || newIndex < modifiedLines.length) {
    iterations++;
    if (iterations > maxIterations) {
      console.error('[DiffPilot] Diff computation exceeded max iterations, breaking');
      break;
    }
    
    const oldLine = oldIndex < originalLines.length ? originalLines[oldIndex] : null;
    const newLine = newIndex < modifiedLines.length ? modifiedLines[newIndex] : null;
    
    if (oldLine === newLine) {
      // Unchanged line
      diff.push({
        type: 'unchanged',
        content: oldLine || '',
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1
      });
      oldIndex++;
      newIndex++;
    } else if (oldLine && !modifiedSet.has(oldLine)) {
      // Line was removed
      diff.push({
        type: 'removed',
        content: oldLine,
        oldLineNumber: oldIndex + 1
      });
      oldIndex++;
    } else if (newLine && !originalSet.has(newLine)) {
      // Line was added
      diff.push({
        type: 'added',
        content: newLine,
        newLineNumber: newIndex + 1
      });
      newIndex++;
    } else {
      // Default to showing as changed (removed then added)
      if (oldLine) {
        diff.push({
          type: 'removed',
          content: oldLine,
          oldLineNumber: oldIndex + 1
        });
        oldIndex++;
      }
      if (newLine) {
        diff.push({
          type: 'added',
          content: newLine,
          newLineNumber: newIndex + 1
        });
        newIndex++;
      }
    }
  }
  
  if (DEBUG) console.log('[DiffPilot] Diff computation completed with', diff.length, 'diff lines');
  return diff;
}

export function getWebviewContent(
  file: string,
  content: string,
  comments: any[],
  isDiff: boolean = false,
  diffContent?: { original: string; modified: string },
  webview?: any
): string {
  if (DEBUG) console.log('[DiffPilot] getWebviewContent called for:', file, 'isDiff:', isDiff);
  let lines: (string | DiffLine)[] = [];
  let commentsByLine: { [key: number]: any[] } = {};
  
  try {
    if (isDiff && diffContent) {
      // Use diff view
      if (DEBUG) console.log('[DiffPilot] Computing diff view');
      lines = computeDiff(diffContent.original, diffContent.modified);
      if (DEBUG) console.log('[DiffPilot] Diff computed, lines:', lines.length);
    
    // Map comments to new line numbers
    comments.forEach(comment => {
      if (!commentsByLine[comment.line]) {
        commentsByLine[comment.line] = [];
      }
      commentsByLine[comment.line].push(comment);
    });
  } else {
    // Normal view
    lines = content.split('\n');
    
    // Group comments by line number
    comments.forEach(comment => {
      if (!commentsByLine[comment.line]) {
        commentsByLine[comment.line] = [];
      }
      commentsByLine[comment.line].push(comment);
    });
  }
  
  if (DEBUG) console.log('[DiffPilot] Generating HTML for', lines.length, 'lines');
  } catch (error) {
    console.error('[DiffPilot] Error in getWebviewContent:', error);
    return `<!DOCTYPE html>
    <html>
    <body>
      <h2>Error generating content</h2>
      <p>${error}</p>
    </body>
    </html>`;
  }

  // Generate a nonce for inline scripts and styles
  const nonce = getNonce();
  
  // Content Security Policy
  let cspSource = '';
  if (webview && webview.cspSource) {
    cspSource = webview.cspSource;
  }
  
  const csp = `
    default-src 'none';
    style-src ${cspSource} 'nonce-${nonce}';
    script-src 'nonce-${nonce}';
    font-src ${cspSource};
    img-src ${cspSource} data:;
  `.replace(/\s+/g, ' ').trim();

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>${escapeHtml(file)} - DiffPilot Review</title>
    <style nonce="${nonce}">
      :root {
        --background: var(--vscode-editor-background);
        --foreground: var(--vscode-editor-foreground);
        --line-number: var(--vscode-editorLineNumber-foreground);
        --line-number-active: var(--vscode-editorLineNumber-activeForeground);
        --selection-bg: var(--vscode-editor-selectionBackground);
        --hover-bg: var(--vscode-editor-hoverHighlightBackground);
        --border: var(--vscode-panel-border);
        --comment-bg: var(--vscode-peekViewEditor-background);
        --button-bg: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
        --button-hover: var(--vscode-button-hoverBackground);
        --input-bg: var(--vscode-input-background);
        --input-border: var(--vscode-input-border);
        --input-fg: var(--vscode-input-foreground);
        --line-hover: rgba(90, 150, 255, 0.15);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 0;
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        color: var(--foreground);
        background: var(--background);
        line-height: 1.5;
      }

      .header {
        padding: 10px 20px;
        border-bottom: 1px solid var(--border);
        font-weight: bold;
        position: sticky;
        top: 0;
        background: var(--background);
        z-index: 100;
      }

      .file-content {
        position: relative;
      }

      .line {
        display: flex;
        position: relative;
        border-bottom: 1px solid transparent;
        transition: background-color 0.2s ease;
      }
      
      .line.clickable {
        cursor: pointer;
      }

      .line.clickable:hover {
        background-color: rgba(59, 130, 246, 0.15) !important;
      }

      .line-number {
        width: 60px;
        padding: 0 10px;
        text-align: right;
        color: var(--line-number);
        user-select: none;
        position: relative;
        flex-shrink: 0;
      }

      .line-number:hover {
        color: var(--line-number-active);
      }
      
      .add-comment-button {
        position: absolute;
        right: -20px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        display: none;
        align-items: center;
        justify-content: center;
        color: var(--vscode-textLink-foreground, var(--button-bg));
        font-weight: bold;
        font-size: 16px;
        user-select: none;
        z-index: 10;
        pointer-events: none;
      }
      
      .line.clickable:hover .add-comment-button {
        display: flex;
      }

      .line-content {
        flex: 1;
        padding: 0 20px 0 30px;
        white-space: pre-wrap;
        word-break: break-all;
        font-family: var(--vscode-editor-font-family);
        user-select: none;
      }

      .comment-thread {
        background: var(--vscode-editorWidget-background, var(--comment-bg));
        border: 1px solid var(--vscode-editorWidget-border, var(--border));
        border-radius: 6px;
        margin: 10px 20px 10px 90px;
        padding: 15px;
      }

      .comment {
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--border);
      }

      .comment:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        font-size: 12px;
        opacity: 0.8;
      }

      .comment-type {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: bold;
      }

      .comment-priority {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .comment-body {
        margin-left: 0;
        cursor: pointer;
      }
      
      .comment-body:hover {
        opacity: 0.8;
        text-decoration: underline;
      }
      
      .edit-comment-form {
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
      }

      .add-comment-form {
        background: var(--vscode-editorWidget-background, var(--comment-bg));
        border: 1px solid var(--vscode-editorWidget-border, var(--border));
        border-radius: 6px;
        margin: 10px 20px 10px 90px;
        padding: 15px;
      }

      .form-group {
        margin-bottom: 12px;
      }
      
      .form-group:last-of-type {
        margin-bottom: 16px;
      }

      .form-group label {
        display: block;
        margin-bottom: 4px;
        font-size: 12px;
        font-weight: bold;
      }

      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 8px 12px;
        background: var(--vscode-input-background, var(--input-bg));
        color: var(--vscode-input-foreground, var(--input-fg));
        border: 1px solid var(--vscode-input-border, var(--input-border));
        border-radius: 4px;
        font-family: inherit;
        font-size: inherit;
      }

      .form-group textarea {
        min-height: 80px;
        resize: vertical;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      button {
        padding: 6px 14px;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
      }

      .primary {
        background: var(--button-bg);
        color: var(--button-fg);
      }

      .primary:hover {
        background: var(--button-hover);
      }

      .secondary {
        background: transparent;
        color: var(--foreground);
        border: 1px solid var(--border);
      }

      .secondary:hover {
        background: var(--hover-bg);
      }

      .diff-view {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .diff-side {
        overflow-x: auto;
      }

      .diff-header {
        padding: 10px;
        background: var(--hover-bg);
        font-weight: bold;
        text-align: center;
        border-bottom: 1px solid var(--border);
      }

      .line.added {
        background-color: rgba(35, 134, 54, 0.15);
      }
      
      .line.added.clickable:hover {
        background-color: rgba(35, 134, 54, 0.3);
      }

      .line.removed {
        background-color: rgba(218, 54, 51, 0.15);
      }
      
      .line.removed.clickable:hover {
        background-color: rgba(218, 54, 51, 0.3);
      }
      
      .line.added .line-content::before {
        content: '+';
        position: absolute;
        left: 10px;
        color: #238636;
        font-weight: bold;
      }
      
      .line.removed .line-content::before {
        content: '-';
        position: absolute;
        left: 10px;
        color: #da3633;
        font-weight: bold;
      }

      .line-with-comment {
        background-color: rgba(255, 200, 0, 0.1);
      }
      
      .line-with-comment.clickable:hover {
        background-color: rgba(255, 200, 0, 0.2);
      }

      .hidden {
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="header">
      ${file}
    </div>
    
    <div class="file-content">
      ${lines.map((line, index) => {
        if (isDiff && diffContent && typeof line !== 'string') {
          // Diff view
          const diffLine = line as DiffLine;
          const lineNumber = diffLine.newLineNumber || 0;
          const lineComments = lineNumber ? (commentsByLine[lineNumber] || []) : [];
          const hasComments = lineComments.length > 0;
          
          // Skip showing comment UI for removed lines
          if (diffLine.type === 'removed') {
            return `
              <div class="line removed">
                <div class="line-number">${diffLine.oldLineNumber || ''}</div>
                <div class="line-content">${escapeHtml(diffLine.content)}</div>
              </div>
            `;
          }
          
          return `
            <div class="line ${diffLine.type} ${hasComments ? 'line-with-comment' : ''} ${lineNumber ? 'clickable' : ''}" data-line="${lineNumber}">
              <div class="line-number">
                ${lineNumber || ''}
                ${lineNumber ? `<span class="add-comment-button">+</span>` : ''}
              </div>
              <div class="line-content">${escapeHtml(diffLine.content)}</div>
            </div>
            
            ${lineComments.map(comment => `
            <div class="comment-thread" id="comment-thread-${escapeHtml(comment.id)}" data-line="${lineNumber}">
              <div class="comment" id="comment-${escapeHtml(comment.id)}">
                <div class="comment-header">
                  <span class="comment-type">
                    ${getTypeEmoji(comment.type)} ${escapeHtml(comment.type)}
                  </span>
                  <span class="comment-priority">
                    ${getPriorityEmoji(comment.priority)} ${escapeHtml(comment.priority)}
                  </span>
                  <span class="comment-time">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <div class="comment-body" data-action="edit" data-comment-id="${escapeHtml(comment.id)}" data-line="${lineNumber}">${escapeHtml(comment.comment)}</div>
              </div>
              
              <div id="edit-form-${escapeHtml(comment.id)}" class="edit-comment-form hidden">
                <div class="form-group">
                  <label for="edit-comment-${escapeHtml(comment.id)}">Comment</label>
                  <textarea id="edit-comment-${escapeHtml(comment.id)}">${escapeHtml(comment.comment)}</textarea>
                </div>
                
                <div class="form-group">
                  <label for="edit-type-${comment.id}">Type</label>
                  <select id="edit-type-${comment.id}">
                    <option value="issue" ${comment.type === 'issue' ? 'selected' : ''}>🐛 Issue</option>
                    <option value="suggestion" ${comment.type === 'suggestion' ? 'selected' : ''}>💡 Suggestion</option>
                    <option value="question" ${comment.type === 'question' ? 'selected' : ''}>❓ Question</option>
                    <option value="praise" ${comment.type === 'praise' ? 'selected' : ''}>👍 Praise</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="edit-priority-${comment.id}">Priority</label>
                  <select id="edit-priority-${comment.id}">
                    <option value="low" ${comment.priority === 'low' ? 'selected' : ''}>🟢 Low</option>
                    <option value="medium" ${comment.priority === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                    <option value="high" ${comment.priority === 'high' ? 'selected' : ''}>🟠 High</option>
                    <option value="critical" ${comment.priority === 'critical' ? 'selected' : ''}>🔴 Critical</option>
                  </select>
                </div>
                
                <div class="form-actions">
                  <button class="secondary" data-action="delete" data-comment-id="${escapeHtml(comment.id)}">Delete</button>
                  <button class="secondary" data-action="cancel-edit" data-comment-id="${escapeHtml(comment.id)}">Cancel</button>
                  <button class="primary" data-action="save-edit" data-comment-id="${escapeHtml(comment.id)}" data-line="${lineNumber}">Save</button>
                </div>
              </div>
            </div>
          `).join('')}
          
          ${lineNumber ? `<div id="comment-form-${lineNumber}" class="add-comment-form hidden">
            <div class="form-group">
              <label for="comment-${lineNumber}">Comment</label>
              <textarea id="comment-${lineNumber}" placeholder="Leave a comment..."></textarea>
            </div>
            
            <div class="form-group">
              <label for="type-${lineNumber}">Type</label>
              <select id="type-${lineNumber}">
                <option value="issue">🐛 Issue</option>
                <option value="suggestion">💡 Suggestion</option>
                <option value="question">❓ Question</option>
                <option value="praise">👍 Praise</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="priority-${lineNumber}">Priority</label>
              <select id="priority-${lineNumber}">
                <option value="low">🟢 Low</option>
                <option value="medium" selected>🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button class="secondary" data-action="cancel-comment" data-line="${lineNumber}">Cancel</button>
              <button class="primary" data-action="submit-comment" data-line="${lineNumber}">Comment</button>
            </div>
          </div>` : ''}
          `;
        } else {
          // Normal view
          const lineContent = typeof line === 'string' ? line : '';
          const lineNumber = index + 1;
          const lineComments = commentsByLine[lineNumber] || [];
          const hasComments = lineComments.length > 0;
          
          return `
            <div class="line ${hasComments ? 'line-with-comment' : ''} clickable" data-line="${lineNumber}">
              <div class="line-number">
                ${lineNumber}
                <span class="add-comment-button">+</span>
              </div>
              <div class="line-content">${escapeHtml(lineContent)}</div>
            </div>
            
            ${lineComments.map(comment => `
              <div class="comment-thread" id="comment-thread-${escapeHtml(comment.id)}" data-line="${lineNumber}">
                <div class="comment" id="comment-${escapeHtml(comment.id)}">
                  <div class="comment-header">
                    <span class="comment-type">
                      ${getTypeEmoji(comment.type)} ${escapeHtml(comment.type)}
                    </span>
                    <span class="comment-priority">
                      ${getPriorityEmoji(comment.priority)} ${escapeHtml(comment.priority)}
                    </span>
                    <span class="comment-time">${new Date(comment.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="comment-body" data-action="edit" data-comment-id="${escapeHtml(comment.id)}" data-line="${lineNumber}">${escapeHtml(comment.comment)}</div>
                </div>
                
                <div id="edit-form-${escapeHtml(comment.id)}" class="edit-comment-form hidden">
                  <div class="form-group">
                    <label for="edit-comment-${escapeHtml(comment.id)}">Comment</label>
                    <textarea id="edit-comment-${escapeHtml(comment.id)}">${escapeHtml(comment.comment)}</textarea>
                  </div>
                  
                  <div class="form-group">
                    <label for="edit-type-${comment.id}">Type</label>
                    <select id="edit-type-${comment.id}">
                      <option value="issue" ${comment.type === 'issue' ? 'selected' : ''}>🐛 Issue</option>
                      <option value="suggestion" ${comment.type === 'suggestion' ? 'selected' : ''}>💡 Suggestion</option>
                      <option value="question" ${comment.type === 'question' ? 'selected' : ''}>❓ Question</option>
                      <option value="praise" ${comment.type === 'praise' ? 'selected' : ''}>👍 Praise</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label for="edit-priority-${comment.id}">Priority</label>
                    <select id="edit-priority-${comment.id}">
                      <option value="low" ${comment.priority === 'low' ? 'selected' : ''}>🟢 Low</option>
                      <option value="medium" ${comment.priority === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                      <option value="high" ${comment.priority === 'high' ? 'selected' : ''}>🟠 High</option>
                      <option value="critical" ${comment.priority === 'critical' ? 'selected' : ''}>🔴 Critical</option>
                    </select>
                  </div>
                  
                  <div class="form-actions">
                    <button class="secondary" data-action="delete" data-comment-id="${escapeHtml(comment.id)}">Delete</button>
                    <button class="secondary" data-action="cancel-edit" data-comment-id="${escapeHtml(comment.id)}">Cancel</button>
                    <button class="primary" data-action="save-edit" data-comment-id="${escapeHtml(comment.id)}" data-line="${lineNumber}">Save</button>
                  </div>
                </div>
              </div>
            `).join('')}
            
            <div id="comment-form-${lineNumber}" class="add-comment-form hidden">
              <div class="form-group">
                <label for="comment-${lineNumber}">Comment</label>
                <textarea id="comment-${lineNumber}" placeholder="Leave a comment..."></textarea>
              </div>
              
              <div class="form-group">
                <label for="type-${lineNumber}">Type</label>
                <select id="type-${lineNumber}">
                  <option value="issue">🐛 Issue</option>
                  <option value="suggestion">💡 Suggestion</option>
                  <option value="question">❓ Question</option>
                  <option value="praise">👍 Praise</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="priority-${lineNumber}">Priority</label>
                <select id="priority-${lineNumber}">
                  <option value="low">🟢 Low</option>
                  <option value="medium" selected>🟡 Medium</option>
                  <option value="high">🟠 High</option>
                  <option value="critical">🔴 Critical</option>
                </select>
              </div>
              
              <div class="form-actions">
                <button class="secondary" data-action="cancel-comment" data-line="${lineNumber}">Cancel</button>
                <button class="primary" data-action="submit-comment" data-line="${lineNumber}">Comment</button>
              </div>
            </div>
          `;
        }
      }).join('')}
    </div>

    <script nonce="${nonce}">
      (function() {
        'use strict';
        
        const DEBUG = ${DEBUG};
        
        if (DEBUG) console.log('[DiffPilot] Script starting...');
        
        const vscode = acquireVsCodeApi();
        if (DEBUG) console.log('[DiffPilot] VS Code API acquired');
        
        let activeCommentForm = null;
        let activeEditForm = null;

        // Functions must be in global scope for onclick handlers
        window.toggleCommentForm = function(lineNumber, event) {
        if (DEBUG) console.log('[DiffPilot] toggleCommentForm called for line:', lineNumber);
        if (event) event.stopPropagation();
        
        const formId = 'comment-form-' + lineNumber;
        const form = document.getElementById(formId);
        if (!form) return;
        
        if (activeCommentForm && activeCommentForm !== form) {
          activeCommentForm.classList.add('hidden');
        }
        
        form.classList.toggle('hidden');
        activeCommentForm = form.classList.contains('hidden') ? null : form;
        
        if (!form.classList.contains('hidden')) {
          const textarea = document.getElementById('comment-' + lineNumber);
          if (textarea) textarea.focus();
        }
      };

      window.cancelComment = function(lineNumber) {
        window.toggleCommentForm(lineNumber);
      };

      window.submitComment = function(lineNumber) {
        const comment = document.getElementById('comment-' + lineNumber).value.trim();
        const type = document.getElementById('type-' + lineNumber).value;
        const priority = document.getElementById('priority-' + lineNumber).value;
        
        if (!comment) {
          alert('Please enter a comment');
          return;
        }
        
        vscode.postMessage({
          command: 'addComment',
          line: lineNumber,
          comment: comment,
          type: type,
          priority: priority
        });
        
        document.getElementById('comment-' + lineNumber).value = '';
        window.cancelComment(lineNumber);
      };

      window.editComment = function(commentId, lineNumber) {
        const commentDiv = document.getElementById('comment-' + commentId);
        const editForm = document.getElementById('edit-form-' + commentId);
        
        if (activeEditForm && activeEditForm !== editForm) {
          const activeId = activeEditForm.id.replace('edit-form-', '');
          window.cancelEdit(activeId);
        }
        
        if (commentDiv && editForm) {
          commentDiv.classList.add('hidden');
          editForm.classList.remove('hidden');
          activeEditForm = editForm;
          const textarea = document.getElementById('edit-comment-' + commentId);
          if (textarea) textarea.focus();
        }
      };
      
      window.cancelEdit = function(commentId) {
        const commentDiv = document.getElementById('comment-' + commentId);
        const editForm = document.getElementById('edit-form-' + commentId);
        
        if (commentDiv && editForm) {
          commentDiv.classList.remove('hidden');
          editForm.classList.add('hidden');
          if (activeEditForm === editForm) {
            activeEditForm = null;
          }
        }
      };
      
      window.saveEdit = function(commentId, lineNumber) {
        const comment = document.getElementById('edit-comment-' + commentId).value.trim();
        const type = document.getElementById('edit-type-' + commentId).value;
        const priority = document.getElementById('edit-priority-' + commentId).value;
        
        if (!comment) {
          alert('Please enter a comment');
          return;
        }
        
        vscode.postMessage({
          command: 'editComment',
          commentId: commentId,
          line: lineNumber,
          comment: comment,
          type: type,
          priority: priority
        });
      };
      
      window.deleteComment = function(commentId) {
        if (DEBUG) console.log('[DiffPilot] deleteComment clicked for:', commentId);
        
        // Since confirm() is not allowed in sandboxed webviews, we'll delete directly
        // You could implement a custom modal here if needed
        
        const deleteButton = document.querySelector(\`[data-action="delete"][data-comment-id="\${commentId}"]\`);
        if (deleteButton) {
          deleteButton.textContent = 'Deleting...';
          deleteButton.disabled = true;
        }
        
        if (DEBUG) console.log('[DiffPilot] Sending delete message for comment:', commentId);
        vscode.postMessage({
          command: 'deleteComment',
          commentId: commentId
        });
      };

      window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      window.getTypeEmoji = function(type) {
        const emojis = {
          issue: '🐛',
          suggestion: '💡',
          question: '❓',
          praise: '👍'
        };
        return emojis[type] || '';
      };

      window.getPriorityEmoji = function(priority) {
        const emojis = {
          low: '🟢',
          medium: '🟡',
          high: '🟠',
          critical: '🔴'
        };
        return emojis[priority] || '';
      };

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'commentAdded':
            handleCommentAdded(message.comment);
            break;
          case 'commentUpdated':
            handleCommentUpdated(message.comment);
            break;
          case 'commentDeleted':
            handleCommentDeleted(message.commentId);
            break;
        }
      });

      function handleCommentAdded(comment) {
        const lineElement = document.querySelector(\`.line[data-line="\${comment.line}"]\`);
        if (!lineElement) return;
        
        let commentThread = document.querySelector(\`#comment-thread-\${window.escapeHtml(comment.id)}\`);
        if (!commentThread) {
          commentThread = document.createElement('div');
          commentThread.className = 'comment-thread';
          commentThread.id = \`comment-thread-\${window.escapeHtml(comment.id)}\`;
          commentThread.setAttribute('data-line', comment.line);
          
          const commentForm = document.querySelector(\`#comment-form-\${comment.line}\`);
          if (commentForm) {
            commentForm.insertAdjacentElement('beforebegin', commentThread);
          } else {
            lineElement.insertAdjacentElement('afterend', commentThread);
          }
        }
        
        const commentHtml = \`
          <div class="comment" id="comment-\${window.escapeHtml(comment.id)}">
            <div class="comment-header">
              <span class="comment-type">
                \${window.getTypeEmoji(comment.type)} \${window.escapeHtml(comment.type)}
              </span>
              <span class="comment-priority">
                \${window.getPriorityEmoji(comment.priority)} \${window.escapeHtml(comment.priority)}
              </span>
              <span class="comment-time">\${new Date(comment.timestamp).toLocaleString()}</span>
            </div>
            <div class="comment-body" data-action="edit" data-comment-id="\${window.escapeHtml(comment.id)}" data-line="\${comment.line}">\${window.escapeHtml(comment.comment)}</div>
          </div>
          
          <div id="edit-form-\${window.escapeHtml(comment.id)}" class="edit-comment-form hidden">
            <div class="form-group">
              <label for="edit-comment-\${window.escapeHtml(comment.id)}">Comment</label>
              <textarea id="edit-comment-\${window.escapeHtml(comment.id)}">\${window.escapeHtml(comment.comment)}</textarea>
            </div>
            
            <div class="form-group">
              <label for="edit-type-\${comment.id}">Type</label>
              <select id="edit-type-\${comment.id}">
                <option value="issue" \${comment.type === 'issue' ? 'selected' : ''}>🐛 Issue</option>
                <option value="suggestion" \${comment.type === 'suggestion' ? 'selected' : ''}>💡 Suggestion</option>
                <option value="question" \${comment.type === 'question' ? 'selected' : ''}>❓ Question</option>
                <option value="praise" \${comment.type === 'praise' ? 'selected' : ''}>👍 Praise</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="edit-priority-\${comment.id}">Priority</label>
              <select id="edit-priority-\${comment.id}">
                <option value="low" \${comment.priority === 'low' ? 'selected' : ''}>🟢 Low</option>
                <option value="medium" \${comment.priority === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                <option value="high" \${comment.priority === 'high' ? 'selected' : ''}>🟠 High</option>
                <option value="critical" \${comment.priority === 'critical' ? 'selected' : ''}>🔴 Critical</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button class="secondary" data-action="delete" data-comment-id="\${window.escapeHtml(comment.id)}">Delete</button>
              <button class="secondary" data-action="cancel-edit" data-comment-id="\${window.escapeHtml(comment.id)}">Cancel</button>
              <button class="primary" data-action="save-edit" data-comment-id="\${window.escapeHtml(comment.id)}" data-line="\${comment.line}">Save</button>
            </div>
          </div>
        \`;
        
        commentThread.innerHTML = commentHtml;
        lineElement.classList.add('line-with-comment');
      }

      function handleCommentUpdated(comment) {
        const commentDiv = document.querySelector(\`#comment-\${window.escapeHtml(comment.id)}\`);
        if (commentDiv) {
          commentDiv.querySelector('.comment-body').textContent = comment.comment;
          commentDiv.querySelector('.comment-type').innerHTML = \`\${window.getTypeEmoji(comment.type)} \${comment.type}\`;
          commentDiv.querySelector('.comment-priority').innerHTML = \`\${window.getPriorityEmoji(comment.priority)} \${comment.priority}\`;
          commentDiv.querySelector('.comment-time').textContent = new Date(comment.timestamp).toLocaleString();
        }
        
        const editTextarea = document.querySelector(\`#edit-comment-\${window.escapeHtml(comment.id)}\`);
        if (editTextarea) editTextarea.value = comment.comment;
        const editType = document.querySelector(\`#edit-type-\${comment.id}\`);
        if (editType) editType.value = comment.type;
        const editPriority = document.querySelector(\`#edit-priority-\${comment.id}\`);
        if (editPriority) editPriority.value = comment.priority;
        
        // Hide the edit form and show the comment
        window.cancelEdit(comment.id);
      }

      function handleCommentDeleted(commentId) {
        const commentThread = document.querySelector(\`#comment-thread-\${commentId}\`);
        if (commentThread) {
          const lineNumber = commentThread.getAttribute('data-line');
          commentThread.remove();
          
          const otherComments = document.querySelectorAll(\`.comment-thread[data-line="\${lineNumber}"]\`);
          if (otherComments.length === 0) {
            const lineElement = document.querySelector(\`.line[data-line="\${lineNumber}"]\`);
            if (lineElement) {
              lineElement.classList.remove('line-with-comment');
            }
          }
        }
      }

      // Handle all clicks with event delegation
      document.addEventListener('click', (e) => {
        if (DEBUG) console.log('[DiffPilot] Click detected on:', e.target.tagName, e.target.className);
        const target = e.target;
        
        // Handle line clicks for adding comments
        const lineElement = target.closest('.line.clickable');
        if (lineElement) {
          const lineNumber = lineElement.getAttribute('data-line');
          if (lineNumber) {
            e.stopPropagation();
            window.toggleCommentForm(parseInt(lineNumber), e);
            return;
          }
        }
        
        // Handle button and comment body clicks
        const actionElement = target.closest('[data-action]');
        if (actionElement) {
          e.stopPropagation();
          const action = actionElement.getAttribute('data-action');
          const commentId = actionElement.getAttribute('data-comment-id');
          const line = actionElement.getAttribute('data-line');
          
          if (DEBUG) console.log('[DiffPilot] Action clicked:', action, 'commentId:', commentId, 'line:', line);
          
          switch (action) {
            case 'edit':
              window.editComment(commentId, parseInt(line));
              break;
            case 'delete':
              if (DEBUG) console.log('[DiffPilot] Delete action triggered for comment:', commentId);
              if (window.deleteComment) {
                window.deleteComment(commentId);
              } else {
                console.error('[DiffPilot] deleteComment function not found on window!');
              }
              break;
            case 'cancel-edit':
              window.cancelEdit(commentId);
              break;
            case 'save-edit':
              window.saveEdit(commentId, parseInt(line));
              break;
            case 'cancel-comment':
              window.cancelComment(parseInt(line));
              break;
            case 'submit-comment':
              window.submitComment(parseInt(line));
              break;
          }
        }
      });

      // Handle Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (activeCommentForm) {
            const parts = activeCommentForm.id.split('-');
            const lineNumber = parseInt(parts[parts.length - 1]);
            if (!isNaN(lineNumber)) {
              window.toggleCommentForm(lineNumber);
            }
          }
          
          const openEditForms = document.querySelectorAll('.edit-comment-form:not(.hidden)');
          openEditForms.forEach(form => {
            const match = form.id.match(/edit-form-(.+)/);
            if (match) {
              window.cancelEdit(match[1]);
            }
          });
        }
      });
      
      // Handle click outside
      document.addEventListener('mousedown', (e) => {
        const clickedLine = e.target.closest('.line.clickable');
        if (clickedLine) return;
        
        const clickedInAddForm = e.target.closest('.add-comment-form');
        const clickedInEditForm = e.target.closest('.edit-comment-form');
        const clickedCommentBody = e.target.classList.contains('comment-body');
        
        if (activeCommentForm && !clickedInAddForm) {
          const parts = activeCommentForm.id.split('-');
          const lineNumber = parseInt(parts[parts.length - 1]);
          if (!isNaN(lineNumber)) {
            window.toggleCommentForm(lineNumber);
          }
        }
        
        if (activeEditForm && !clickedInEditForm && !clickedCommentBody) {
          const formId = activeEditForm.id;
          const match = formId.match(/edit-form-(.+)/);
          if (match) {
            window.cancelEdit(match[1]);
          }
        }
      });
      })();
    </script>
  </body>
  </html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTypeEmoji(type: string): string {
  const emojis: { [key: string]: string } = {
    issue: '🐛',
    suggestion: '💡',
    question: '❓',
    praise: '👍'
  };
  return emojis[type] || '';
}

function getPriorityEmoji(priority: string): string {
  const emojis: { [key: string]: string } = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };
  return emojis[priority] || '';
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}