# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DiffPilot is a VS Code extension that provides GitHub-style code review functionality with AI-friendly markdown export. The extension allows developers to review code changes in a dedicated panel, add inline comments, and export structured reviews for AI agents to automatically fix issues.

## Development Commands

### Build and Compile
```bash
# Compile TypeScript to JavaScript
npm run compile

# Watch mode for development (auto-recompile on changes)
npm run watch

# Pre-publish build
npm run vscode:prepublish
```

### Running the Extension
1. Open the project in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded
3. The extension will be available in the Extension Development Host window

## Architecture

The entire extension is implemented in a single file: `src/extension.ts`

### Core Components
- **DiffPilotReviewer class**: Main controller managing review sessions, UI, and commands
- **ChangedFilesProvider**: TreeDataProvider showing changed files in a dedicated panel
- **CommentController**: Manages VS Code's native commenting API for inline comments
- **ReviewSession interface**: Tracks active review state with git integration
- **ReviewComment interface**: Stores individual code comments with metadata

### Key Features
1. **GitHub-style UI**: Dedicated activity bar panel showing changed files
2. **Inline Comments**: Add comments directly in the diff view with type and priority
3. **Git Integration**: Automatically detects changed files between branches
4. **Visual Indicators**: Status bar shows review progress, decorations show inline comments
5. **AI-Friendly Export**: Generates structured markdown for automated fixes

### Extension Commands
1. `diffpilot.startReview` - Initialize a new review session (prompts for base branch)
2. `diffpilot.exportReview` - Generate AI-friendly markdown file
3. `diffpilot.openFile` - Open file in diff view (internal command)
4. `diffpilot.showReviewPanel` - Show the review panel
5. `diffpilot.createComment` - Create inline comment (internal command)

### Configuration Settings
- `diffpilot.reviewsDirectory`: Output directory for review files (default: `.vscode/reviews`)

## Key Development Notes

- The extension uses VS Code's built-in APIs only - no external runtime dependencies
- TypeScript strict mode is enabled - ensure all types are properly defined
- Output files are generated in CommonJS format for VS Code compatibility
- Minimum VS Code version: 1.74.0

## Review File Format

Generated markdown files include:
- Review metadata (ID, timestamp, status, git information)
- Issues grouped by priority (Critical → High → Medium/Low)
- AI agent instructions for automated fixes
- JSON backup for programmatic access