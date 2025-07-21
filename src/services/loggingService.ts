import * as vscode from 'vscode';
import { DEBUG } from '../models/constants';

export class LoggingService {
  private static instance: LoggingService;
  private outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('DiffPilot');
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  public debug(...args: unknown[]): void {
    if (DEBUG) {
      const message = this.formatMessage('DEBUG', args);
      console.log(message);
      this.outputChannel.appendLine(message);
    }
  }

  public info(...args: unknown[]): void {
    const message = this.formatMessage('INFO', args);
    console.log(message);
    this.outputChannel.appendLine(message);
  }

  public error(...args: unknown[]): void {
    const message = this.formatMessage('ERROR', args);
    console.error(message);
    this.outputChannel.appendLine(message);
  }

  public warn(...args: unknown[]): void {
    const message = this.formatMessage('WARN', args);
    console.warn(message);
    this.outputChannel.appendLine(message);
  }

  private formatMessage(level: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    return `[${timestamp}] [${level}] [DiffPilot] ${formattedArgs}`;
  }

  public show(): void {
    this.outputChannel.show();
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export convenience functions that match the original API
const logger = LoggingService.getInstance();

export const debugLog = (...args: unknown[]) => logger.debug(...args);
export const infoLog = (...args: unknown[]) => logger.info(...args);
export const errorLog = (...args: unknown[]) => logger.error(...args);
export const warnLog = (...args: unknown[]) => logger.warn(...args);