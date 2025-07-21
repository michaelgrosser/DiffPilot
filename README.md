# DiffPilot

A VS Code extension that provides GitHub-style code review functionality with AI-friendly markdown export. Review code changes, add inline comments, and export structured reviews that AI agents can use to automatically fix issues.

## Features

- **GitHub-style Review Interface**: Dedicated activity bar panel showing all changed files
- **Inline Commenting**: Click line numbers to add comments with type and priority
- **Real-time Updates**: Automatically refreshes to show new changes every 2 seconds
- **Smart Diff View**: Shows additions in green, deletions in red, just like GitHub
- **Comment Management**: Edit or delete comments by clicking on them
- **AI-Friendly Export**: Generates structured markdown files optimized for AI agents
- **Persistent Reviews**: Comments are auto-saved and persist across VS Code sessions

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` in VS Code to launch a new window with the extension loaded

## Usage

### Starting a Review

1. Click the DiffPilot icon in the VS Code activity bar (pull request icon)
2. The panel shows all modified, added, and deleted files in your repository
3. Click any file to open it in the review panel

### Adding Comments

1. In the review panel, hover over any line number
2. Click the line number (a `+` appears on hover)
3. Fill in:
   - **Comment**: Your feedback or observation
   - **Type**: Issue 🐛, Suggestion 💡, Question ❓, or Praise 👍
   - **Priority**: Critical 🔴, High 🟠, Medium 🟡, or Low 🟢
4. Click "Comment" or press `Ctrl/Cmd+Enter`

### Editing Comments

1. Click on any existing comment text to edit it
2. Modify the comment, type, or priority
3. Click "Save" or press `Ctrl/Cmd+Enter`
4. Click "Delete" to remove the comment (with confirmation)

### Review Files

Reviews are automatically saved to `.vscode/reviews/` with the format:
- Markdown: `review-[branch].md`
- JSON: `review-[branch].json`

The markdown file includes:
- Review metadata (branch, date, comment counts)
- Issues grouped by priority
- AI agent instructions for automated fixes

Note: Review files are branch-specific and will persist across sessions. Switching branches will automatically load the appropriate review file.

### Status Bar

The status bar shows:
- Total number of comments in the current review
- Click to focus the DiffPilot panel

## AI Agent Integration

The exported markdown files are specifically formatted for AI agents to:
1. Understand the priority and type of each issue
2. Locate the exact file and line number
3. Implement fixes in priority order
4. Have clear context about what needs to be changed

Example AI workflow:
```bash
# Generate review
code --wait .vscode/reviews/review-main.md

# Pass to AI agent
ai-agent fix .vscode/reviews/review-main.md
```

## Configuration

### Settings

- `diffpilot.reviewsDirectory`: Directory for saving review files (default: `.vscode/reviews`)

## Keyboard Shortcuts

- `Ctrl/Cmd+Enter`: Submit comment (works in both new and edit modes)
- `Escape`: Cancel comment form (when focused)

## File Type Support

DiffPilot works with all file types and includes:
- Syntax highlighting in diffs
- Support for large files
- Binary file detection
- Proper handling of file deletions

## Known Issues

- The extension requires a git repository to function
- Very large files (>10MB) may be slow to render

## Development

### Requirements

- Node.js 14.x or higher
- VS Code 1.74.0 or higher

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile)
npm run watch
```

### Testing

Press `F5` to launch a new VS Code window with the extension loaded for testing.

## License

MIT License - see [LICENSE.txt](LICENSE.txt)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Credits

Created by Michael Grosser