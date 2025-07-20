# DiffPilot Refactoring Plan

This document outlines the prioritized tasks for improving the DiffPilot VS Code extension's security, architecture, and code quality.

## Priority Legend
- 🔴 **CRITICAL** - Security vulnerabilities that must be fixed immediately
- 🟠 **HIGH** - Architectural issues affecting maintainability and stability
- 🟡 **MEDIUM** - Code quality and best practices improvements
- 🟢 **LOW** - Performance and nice-to-have enhancements

---

## 🔴 CRITICAL PRIORITY - Security Vulnerabilities

### [ ] 1. Eliminate Shell Command Execution
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

### [ ] 2. Fix Path Traversal Vulnerability
**Issue**: No validation of file paths from git status output
**Files**: `src/extension.ts:130, 228`
**Solution**:
- Create `utils/validation.ts` with path validation functions
- Ensure all paths are within workspace boundaries
- Sanitize paths before file system operations
- Validate branch names and other user inputs
**Effort**: 1-2 hours

### [ ] 3. Implement Webview Security
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

---

## 🟠 HIGH PRIORITY - Architectural Improvements

### [ ] 4. Modularize Monolithic Code Structure
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

### [ ] 5. Implement Proper Separation of Concerns
**Issue**: Classes handle UI, data, and business logic together
**Files**: `src/extension.ts` (FileReviewPanel, DiffPilotReviewer)
**Solution**:
- Extract business logic into service classes
- Implement repository pattern for data access
- Use dependency injection for better testability
- Define clear API contracts between modules
- Implement singleton pattern for ReviewService state management
**Effort**: 3-4 hours

### [ ] 6. Fix Memory Leaks and Resource Management
**Issue**: Intervals and event listeners not properly disposed
**Files**: `src/extension.ts:56-73` (auto-refresh), various event handlers
**Solution**:
- Implement proper disposal pattern for all resources
- Track all subscriptions and intervals
- Clean up in dispose() methods
- Add global error boundaries to prevent extension crashes
**Effort**: 2-3 hours

---

## 🟡 MEDIUM PRIORITY - Code Quality & TypeScript

### [ ] 7. Eliminate 'any' Types and Add Type Safety
**Issue**: Using `any` types and missing return type annotations
**Files**: `src/extension.ts`, `src/webview.ts`
**Solution**:
- Enable `noImplicitAny` in tsconfig.json
- Define proper interfaces for all data structures
- Add return type annotations to all functions
**Effort**: 2-3 hours

### [ ] 8. Replace String Literals with Enums
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

### [ ] 9. Improve Error Handling
**Issue**: Silent failures and poor error messages
**Files**: Throughout codebase
**Solution**:
- Create custom error classes
- Add try-catch blocks with meaningful error messages
- Show user-friendly notifications for common errors
**Effort**: 2-3 hours

---

## 🟢 LOW PRIORITY - Performance & Enhancements

### [ ] 10. Replace Polling with File System Watchers
**Issue**: Auto-refresh runs every 2 seconds regardless of changes
**Files**: `src/extension.ts:59-66`
**Solution**:
- Use VS Code's FileSystemWatcher API
- Implement smart refresh based on actual file changes
- Add debouncing to prevent excessive updates
**Effort**: 2-3 hours

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