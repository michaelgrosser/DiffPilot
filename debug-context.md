# DiffPilot Debug Context

## Current Issue
The new comment forms in the DiffPilot VS Code extension are not closing when:
- Pressing Escape key
- Clicking outside the form

However:
- The Cancel button DOES work
- Clicking the same row again DOES close the form (toggles it)
- Edit comment forms work correctly with Escape and click-outside

## Key Findings

1. **No console logs are appearing** from the event listeners (keydown, mousedown)
2. **The Cancel button works**, which calls `cancelComment` → `toggleCommentForm`
3. **No change in behavior** despite multiple code changes, suggesting:
   - Either the extension isn't reloading properly
   - Or the event listeners aren't being attached

## Recent Changes Made

### 1. Modified event handlers in extension.ts
- Changed `handleAddComment`, `handleEditComment`, `handleDeleteComment` to use postMessage instead of calling `updateWebview()`
- This was to prevent full HTML regeneration which destroys JavaScript state

### 2. Updated webview.ts
- Simplified `cancelComment` to just call `toggleCommentForm`
- Added debug logging throughout
- Moved event listener to top of script (line 702) with alert to test if it runs
- Removed inline onclick handlers and used event delegation instead

### 3. Current State
- Added alert on line 704: `alert('Escape key pressed!');` to test if keydown event fires
- Added alert on line 770: `alert('Cancel button clicked for line ' + lineNumber);` in cancelComment function

## Next Steps to Debug

1. **After VS Code restart**, check if:
   - The alerts fire (Escape key and Cancel button)
   - Console shows "[DiffPilot] Webview script loaded"
   - Developer Tools show any JavaScript errors

2. **If alerts don't fire**, the issue is:
   - Extension not reloading (try F5 in the extension development host)
   - JavaScript syntax error preventing execution
   - Webview caching issue

3. **If only Cancel button alert fires** but not Escape:
   - Event listeners at bottom of template aren't running
   - Need to move ALL event listeners to top of script

## Code Structure
- Main extension logic: `/src/extension.ts`
- Webview HTML generation: `/src/webview.ts`
- Key functions:
  - `toggleCommentForm()` - Opens/closes comment forms
  - `cancelComment()` - Now just calls toggleCommentForm
  - Event listeners start around line 1013 in webview.ts

## The Core Problem
The escape/click-outside work for EDIT forms but not NEW COMMENT forms. The difference seems to be in how the event listeners are set up or when they're attached.