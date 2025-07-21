# Change Log

All notable changes to the "DiffPilot" extension will be documented in this file.

## [Unreleased]

## [0.2.0] - 2024-01-19

### Added
- Edit existing comments by clicking on them
- Delete comments with confirmation dialog
- Auto-save functionality for review sessions
- Comprehensive logging for debugging
- Proper handling of new/untracked files in diff view
- Data persistence across VS Code sessions
- Keyboard shortcuts (Ctrl/Cmd+Enter) for comment submission

### Fixed
- Extension lockup when viewing new/untracked files
- Directory handling in git status parsing
- Infinite loop protection in diff computation
- Error handling for file read operations

### Changed
- Improved diff algorithm for better performance
- Enhanced error messages for better debugging
- Optimized webview update mechanism

## [0.1.0] - 2024-01-15

### Added
- Initial release of DiffPilot
- GitHub-style review interface in VS Code activity bar
- Inline commenting with line-specific annotations
- Comment types: Issue, Suggestion, Question, Praise
- Priority levels: Critical, High, Medium, Low
- Real-time file change detection (2-second refresh)
- Smart diff view with additions/deletions highlighting
- AI-friendly markdown export for automated fixes
- JSON export for programmatic access
- Status bar integration showing comment count
- Configurable review output directory

### Features
- Support for modified, added, deleted, and untracked files
- Visual indicators for file status and staging state
- Persistent comment storage in `.vscode/reviews/`
- Automatic review file naming with branch and date
- VS Code native commenting API integration