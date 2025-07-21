# DiffPilot Refactoring Plan

This document outlines the prioritized tasks for improving the DiffPilot VS Code extension's security, architecture, and code quality.

## Priority Legend
- 🔴 **CRITICAL** - Security vulnerabilities that must be fixed immediately
- 🟠 **HIGH** - Architectural issues affecting maintainability and stability
- 🟡 **MEDIUM** - Code quality and best practices improvements
- 🟢 **LOW** - Performance and nice-to-have enhancements

---

## 🔴 CRITICAL PRIORITY - Security Vulnerabilities

### [x] 1. Eliminate Shell Command Execution ✅ COMPLETED (2025-07-20)
**Issue**: Direct string interpolation in shell commands allows code injection
**Files**: `src/extension.ts:259, 270`
**Current Code**: 
```typescript
await execAsync(`git show HEAD:"${file.path}"`, { cwd: workspaceRoot })
```
**Solution**: 
- **Preferred**: Use VS Code's built-in Git extension API (`vscode.git`) - no shell execution needed
- **Alternative**: If shell commands are absolutely necessary:
  - Create a `utils/shell.ts` module with safe command execution
  - Use array-based command execution (never string concatenation)
  - Implement strict input validation and escaping
**Effort**: 2-3 hours
**Completion**: Successfully replaced all shell commands with VS Code's Git extension API:
- Removed `child_process` and `promisify` imports
- Added `getGitAPI()` helper function
- Replaced `git status --porcelain` with Git API repository state
- Replaced `git show HEAD:file` with `repository.show()` method
- Replaced `git rev-parse --abbrev-ref HEAD` with `repository.state.HEAD.name`
- All code compiles without errors

### [x] 2. Fix Path Traversal Vulnerability ✅ COMPLETED (2025-07-20)
**Issue**: No validation of file paths from git status output
**Files**: `src/extension.ts:130, 228`
**Solution**:
- Create `utils/validation.ts` with path validation functions
- Ensure all paths are within workspace boundaries
- Sanitize paths before file system operations
- Validate branch names and other user inputs
**Effort**: 1-2 hours
**Completion**: Successfully implemented comprehensive path validation:
- Created `PathValidator` class with methods for path and branch name validation
- Added `validatePath()` to ensure paths stay within workspace boundaries
- Added `validateBranchName()` to prevent injection via branch names
- Added `safeJoin()` for secure path concatenation
- Updated all file operations to use validated paths
- Added error handling for invalid paths with user-friendly messages
- All code compiles without errors

### [x] 3. Implement Webview Security ✅ COMPLETED (2025-07-20)
**Issue**: No Content Security Policy (CSP) for webviews
**Files**: `src/webview.ts`
**Solution**:
- Add strict Content Security Policy headers
- Use nonces for inline scripts/styles
- Sanitize all data passed to webview
- Example CSP:
```typescript
const csp = `default-src 'none'; 
  style-src ${webview.cspSource} 'nonce-${nonce}'; 
  script-src 'nonce-${nonce}';`;
```
**Effort**: 2-3 hours
**Completion**: Successfully implemented comprehensive webview security:
- Added strict Content Security Policy (CSP) with nonces
- Implemented `getNonce()` function for secure random nonce generation
- Added CSP meta tag to webview HTML header
- Removed all inline event handlers (onclick) and replaced with data attributes
- Enhanced `escapeHtml()` usage to sanitize all user input including comment IDs, types, and priorities
- Updated `getWebviewContent()` to accept webview parameter for CSP source
- Applied nonce attribute to both style and script tags
- All user-provided data is now properly escaped before rendering
- All code compiles without errors

---

## 🟠 HIGH PRIORITY - Architectural Improvements

### [x] 4. Modularize Monolithic Code Structure ✅ COMPLETED (2025-07-20)
**Issue**: All logic in single 787-line file with mixed responsibilities
**Files**: `src/extension.ts`
**Solution**: Split into logical modules:
```
src/
├── services/
│   ├── gitService.ts         # Git operations (using VS Code Git API)
│   ├── reviewService.ts      # Review management
│   ├── fileSystemService.ts  # File operations
│   ├── eventService.ts       # Event bus for decoupled communication
│   ├── stateService.ts       # Centralized state management
│   └── loggingService.ts     # Structured logging
├── providers/
│   ├── changedFilesProvider.ts
│   └── webviewProvider.ts
├── models/
│   ├── types.ts              # TypeScript interfaces
│   ├── constants.ts          # Enums and constants
│   └── errors.ts             # Custom error classes
├── utils/
│   ├── validation.ts         # Input validation utilities
│   └── monitoring.ts         # Performance monitoring
└── extension.ts              # Minimal activation logic
```
**Effort**: 4-6 hours
**Completion**: Successfully modularized the codebase:
- Reduced extension.ts from 962 lines to 137 lines (86% reduction)
- Created 9 new modules across services, providers, and models directories
- Extracted Git operations into gitService.ts
- Extracted review management into reviewService.ts
- Extracted file system operations into fileSystemService.ts
- Created structured logging service
- Moved UI components to separate providers
- Centralized types and constants
- Maintained all existing functionality
- Fixed branch detection issue as part of the refactoring
- Added review file filtering to prevent commenting on review files

### [x] 5. Implement Proper Separation of Concerns ✅ COMPLETED (2025-07-20)
**Issue**: Classes handle UI, data, and business logic together
**Files**: `src/extension.ts` (FileReviewPanel, DiffPilotReviewer)
**Solution**:
- Extract business logic into service classes
- Implement repository pattern for data access
- Use dependency injection for better testability
- Define clear API contracts between modules
- Implement singleton pattern for ReviewService state management
**Effort**: 3-4 hours
**Completion**: Successfully implemented proper separation of concerns:
- Created repository pattern with `IReviewRepository` interface and `ReviewRepository` implementation
- Extracted file content business logic from `FileReviewPanel` into `FileContentService`
- Implemented dependency injection container (`DIContainer`) for service management
- Defined clear API contracts with interfaces (`IReviewService`, `IFileContentService`, etc.)
- Refactored `ReviewService` to use repository pattern with caching for backward compatibility
- Refactored `FileReviewPanel` to focus only on UI concerns, delegating business logic to services
- All code compiles without errors

### [x] 6. Fix Memory Leaks and Resource Management ✅ COMPLETED (2025-07-20)
**Issue**: Intervals and event listeners not properly disposed
**Files**: `src/extension.ts:56-73` (auto-refresh), various event handlers
**Solution**:
- Implement proper disposal pattern for all resources
- Track all subscriptions and intervals
- Clean up in dispose() methods
- Add global error boundaries to prevent extension crashes
**Effort**: 2-3 hours
**Completion**: Successfully implemented comprehensive resource management:
- Added `vscode.Disposable` interface to all classes that manage resources
- Fixed interval cleanup in `ChangedFilesProvider` with proper disposal of EventEmitter
- Implemented disposal tracking arrays in all classes to manage event subscriptions
- Fixed memory leak in `GitService.waitForGitApi()` by properly cleaning up timeout and listener
- Added proper disposal chain in `DiffPilotReviewer` with error handling
- Created `ErrorBoundary` utility class for global error handling
- Wrapped all commands, event handlers, and async operations with error boundaries
- Ensured extension activation is wrapped in try-catch to prevent complete failure
- All resources are now properly tracked and disposed on extension deactivation
- All code compiles without errors

---

## 🟡 MEDIUM PRIORITY - Code Quality & TypeScript

### [x] 7. Eliminate 'any' Types and Add Type Safety ✅ COMPLETED (2025-07-20)
**Issue**: Using `any` types and missing return type annotations
**Files**: `src/extension.ts`, `src/webview.ts`
**Solution**:
- Enable `noImplicitAny` in tsconfig.json
- Define proper interfaces for all data structures
- Add return type annotations to all functions
**Effort**: 2-3 hours
**Completion**: Successfully eliminated all 'any' types and added comprehensive type safety:
- Created `gitTypes.ts` with proper interfaces for Git extension API (GitAPI, Repository, Branch, etc.)
- Created `webviewTypes.ts` with typed message interfaces for webview communication
- Replaced all `any` types with proper types:
  - Git API typed as `GitAPI | null`
  - Webview messages typed with specific interfaces
  - Error parameters typed as `unknown`
  - Logging parameters typed as `unknown[]`
- Added type exports `CommentType` and `Priority` to types.ts
- Fixed return type annotations (e.g., `deactivate(): void`)
- Improved type safety in ErrorBoundary with generic type parameters
- Fixed Git API usage with proper null checks and optional chaining
- All code compiles without errors with strict TypeScript settings

### [x] 8. Replace String Literals with Enums ✅ COMPLETED (2025-07-20)
**Issue**: Hard-coded strings for types and priorities
**Files**: Throughout codebase
**Solution**:
```typescript
enum CommentType {
  Issue = 'issue',
  Suggestion = 'suggestion',
  Question = 'question',
  Praise = 'praise'
}

enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}
```
**Effort**: 1-2 hours
**Completion**: Successfully replaced all string literals with enums:
- Created `CommentType` enum for comment types (issue, suggestion, question, praise)
- Created `Priority` enum for priorities (low, medium, high, critical)
- Created `FileStatus` enum for file statuses (modified, added, untracked, deleted)
- Updated all type definitions to use enums instead of string literals
- Updated constants files to use enum keys for Record types
- Updated all services to use enum values:
  - GitService now returns FileStatus enum values
  - ReviewService filters using Priority enum values
  - FileContentService switches on FileStatus enum values
  - ChangedFilesProvider sorts using FileStatus enum values
- Created uiConstants.ts with UI display information mapped by enum values
- All code compiles without errors

### [x] 9. Improve Error Handling ✅ COMPLETED (2025-07-20)
**Issue**: Silent failures and poor error messages
**Files**: Throughout codebase
**Solution**:
- Create custom error classes
- Add try-catch blocks with meaningful error messages
- Show user-friendly notifications for common errors
**Effort**: 2-3 hours
**Completion**: Successfully improved error handling throughout the codebase:
- Created custom error classes hierarchy:
  - `DiffPilotError` (base class with error codes)
  - `GitOperationError` (for Git-related failures)
  - `FileSystemError` (for file operations)
  - `ValidationError` (for input validation)
  - `ReviewOperationError` (for review operations)
  - `ConfigurationError` (for config issues)
- Implemented `getUserFriendlyErrorMessage()` function that maps error codes to user-friendly messages
- Updated all services to throw appropriate custom errors:
  - GitService throws GitOperationError with operation context
  - FileSystemService throws FileSystemError with file paths
  - PathValidator throws ValidationError with field names
  - FileContentService uses appropriate error types
- Enhanced error handling patterns:
  - Removed silent failures (returning empty arrays/defaults without notification)
  - Added proper error propagation in critical paths
  - Kept sensible defaults only where appropriate (e.g., branch name)
- Improved user notifications:
  - ErrorBoundary now uses getUserFriendlyErrorMessage
  - Extension activation shows friendly messages
  - All error messages are now actionable and clear
- Added contextual information to errors (operation names, file paths, etc.)
- All code compiles without errors

---

## 🟢 LOW PRIORITY - Performance & Enhancements

### [x] 10. Replace Polling with File System Watchers ✅ COMPLETED (2025-07-20)
**Issue**: Auto-refresh runs every 2 seconds regardless of changes
**Files**: `src/providers/changedFilesProvider.ts`
**Solution**:
- Use VS Code's FileSystemWatcher API
- Implement smart refresh based on actual file changes
- Add debouncing to prevent excessive updates
**Effort**: 2-3 hours
**Completion**: Successfully replaced polling with file system watchers:
- Removed `autoRefreshInterval` and `setInterval` polling mechanism
- Implemented `setupFileSystemWatcher()` using VS Code's FileSystemWatcher API
- Created two watchers: one for general workspace files and one for Git-specific changes
- Added `onFileSystemChange()` handler that ignores changes to `.git`, `node_modules`, and `.vscode/reviews`
- Implemented `debouncedRefresh()` with 500ms delay to prevent excessive updates
- Updated disposal logic to clean up file watchers and debounce timers
- Removed unused `AUTO_REFRESH_INTERVAL` constant import
- All code compiles without errors

### [ ] 11. Optimize Webview Performance
**Issue**: Entire webview HTML regenerated on each update
**Files**: `src/webview.ts`
**Solution**:
- Implement incremental DOM updates
- Use virtual scrolling for large files
- Cache rendered content where possible
**Effort**: 3-4 hours

### [ ] 12. Add Configuration Options
**Issue**: Hard-coded values for refresh interval, file limits
**Solution**:
- Add configuration settings for:
  - Auto-refresh interval
  - Maximum file size for diff view
  - Default comment type and priority
- Document all settings in README
**Effort**: 1-2 hours

### [ ] 13. Improve Git Command Error Handling
**Issue**: Git command failures show raw error messages
**Files**: `src/extension.ts` (all execAsync calls)
**Solution**:
- Parse common git errors
- Provide helpful suggestions (e.g., "Not a git repository")
- Add retry logic for transient failures
**Effort**: 2-3 hours

### [ ] 14. Add Structured Logging Service
**Issue**: No centralized logging for debugging production issues
**Solution**:
- Create `services/loggingService.ts` with structured logging
- Add log levels (error, warn, info, debug)
- Include context (timestamps, user actions, file paths)
- Integrate with VS Code's output channel
- Add telemetry for performance monitoring
**Effort**: 2-3 hours

### [ ] 15. Implement Performance Monitoring
**Issue**: No visibility into extension performance
**Solution**:
- Create `utils/monitoring.ts` for performance tracking
- Add timing measurements for key operations
- Track memory usage and resource consumption
- Create performance dashboards in output channel
**Effort**: 2-3 hours

### [ ] 16. Add Accessibility Features
**Issue**: Webview components may not be accessible
**Solution**:
- Ensure all interactive elements are keyboard navigable
- Add proper ARIA labels and roles
- Implement focus management
- Support VS Code's high contrast themes
- Test with screen readers
**Effort**: 3-4 hours

---

## Development Best Practices

### [ ] 17. CI/CD Pipeline Setup
**Issue**: No automated checks for code quality and security
**Solution**:
- Set up GitHub Actions workflow for:
  - Automated security scanning (`npm audit`)
  - ESLint and TypeScript checks
  - Unit test execution
  - Code coverage reporting
- Add pre-commit hooks for local validation
- Implement semantic versioning
**Effort**: 2-3 hours

### [ ] 18. Migration Strategy
**Issue**: Major refactoring needs careful rollout
**Solution**:
- Implement feature flags for gradual feature rollout
- Create migration scripts for breaking changes
- Maintain backward compatibility during transition
- Document migration path for users
**Effort**: 2-3 hours

---

## Implementation Order

1. **Week 1**: Complete all CRITICAL security fixes (Tasks 1-3)
2. **Week 2**: Begin architectural improvements (Tasks 4-6)
3. **Week 3**: Continue architecture and start TypeScript improvements (Tasks 7-9)
4. **Week 4**: Complete remaining high-impact tasks (Tasks 10-13)
5. **Week 5**: Add development practices and monitoring (Tasks 14-18)

## Testing Requirements

- [ ] Add unit tests for all new modules
- [ ] Add integration tests for git operations
- [ ] Test security fixes with various malicious inputs
- [ ] Performance benchmarks before/after optimizations
- [ ] Accessibility testing with screen readers
- [ ] Test with VS Code's minimum supported version

## Notes

- All changes should maintain backward compatibility
- Consider creating a feature branch for major architectural changes
- Update documentation as code is refactored
- Consider adding ESLint rules to enforce new patterns
- Use VS Code's built-in Git API to eliminate shell commands
- Implement proper error boundaries and recovery mechanisms
- Follow VS Code extension security best practices

---

*Last Updated: 2025-07-20*
*Total Estimated Effort: 40-50 hours*