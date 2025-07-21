/**
 * Base error class for DiffPilot extension
 */
export class DiffPilotError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DiffPilotError';
    Object.setPrototypeOf(this, DiffPilotError.prototype);
  }
}

/**
 * Error thrown when Git operations fail
 */
export class GitOperationError extends DiffPilotError {
  constructor(message: string, public readonly operation: string) {
    super(message, 'GIT_OPERATION_ERROR');
    this.name = 'GitOperationError';
    Object.setPrototypeOf(this, GitOperationError.prototype);
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends DiffPilotError {
  constructor(message: string, public readonly path?: string) {
    super(message, 'FILE_SYSTEM_ERROR');
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends DiffPilotError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when review operations fail
 */
export class ReviewOperationError extends DiffPilotError {
  constructor(message: string, public readonly operation: string) {
    super(message, 'REVIEW_OPERATION_ERROR');
    this.name = 'ReviewOperationError';
    Object.setPrototypeOf(this, ReviewOperationError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends DiffPilotError {
  constructor(message: string, public readonly setting?: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Maps error codes to user-friendly messages
 */
export const USER_FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  GIT_OPERATION_ERROR: 'Git operation failed. Please ensure you have a valid Git repository.',
  FILE_SYSTEM_ERROR: 'File operation failed. Please check file permissions.',
  VALIDATION_ERROR: 'Invalid input provided. Please check your input and try again.',
  REVIEW_OPERATION_ERROR: 'Review operation failed. Please try again.',
  CONFIGURATION_ERROR: 'Invalid configuration. Please check your settings.'
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof DiffPilotError) {
    return USER_FRIENDLY_ERROR_MESSAGES[error.code] || error.message;
  }
  
  if (error instanceof Error) {
    // Special cases for common errors
    if (error.message.includes('Git extension not available')) {
      return 'Git extension is not available. Please ensure Git is installed and the Git extension is enabled.';
    }
    if (error.message.includes('No Git repository found')) {
      return 'No Git repository found in the current workspace.';
    }
    if (error.message.includes('No workspace folder found')) {
      return 'Please open a folder in VS Code to use DiffPilot.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please check the output console for details.';
}