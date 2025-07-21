import * as vscode from 'vscode';
import { errorLog } from '../services/loggingService';
import { getUserFriendlyErrorMessage } from '../models/errors';

export class ErrorBoundary {
  /**
   * Wraps an async function with error handling to prevent crashes
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    fallbackValue?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      errorLog(`${errorMessage}:`, error);
      const userMessage = getUserFriendlyErrorMessage(error);
      vscode.window.showErrorMessage(`DiffPilot: ${userMessage}`);
      return fallbackValue;
    }
  }

  /**
   * Wraps a sync function with error handling to prevent crashes
   */
  static wrap<T>(
    operation: () => T,
    errorMessage: string,
    fallbackValue?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      errorLog(`${errorMessage}:`, error);
      const userMessage = getUserFriendlyErrorMessage(error);
      vscode.window.showErrorMessage(`DiffPilot: ${userMessage}`);
      return fallbackValue;
    }
  }

  /**
   * Wraps command handlers to prevent extension crashes
   */
  static wrapCommand<T extends unknown[]>(
    handler: (...args: T) => unknown,
    commandName: string
  ): (...args: T) => Promise<unknown> {
    return async (...args: T) => {
      try {
        const result = handler(...args);
        if (result instanceof Promise) {
          return await result;
        }
        return result;
      } catch (error) {
        errorLog(`Command '${commandName}' failed:`, error);
        const userMessage = getUserFriendlyErrorMessage(error);
        vscode.window.showErrorMessage(`DiffPilot: ${userMessage}`);
      }
    };
  }

  /**
   * Wraps event handlers to prevent extension crashes
   */
  static wrapEventHandler<T>(
    handler: (event: T) => unknown,
    eventName: string
  ): (event: T) => void {
    return (event: T) => {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch(error => {
            errorLog(`Event handler '${eventName}' failed:`, error);
          });
        }
      } catch (error) {
        errorLog(`Event handler '${eventName}' failed:`, error);
      }
    };
  }
}