import { CommentType, Priority } from './types';

// Base message interface
export interface WebviewMessage {
  command: string;
}

// Specific message types
export interface AddCommentMessage extends WebviewMessage {
  command: 'addComment';
  line: number;
  comment: string;
  type: CommentType;
  priority: Priority;
}

export interface EditCommentMessage extends WebviewMessage {
  command: 'editComment';
  commentId: string;
  comment: string;
  type: CommentType;
  priority: Priority;
}

export interface DeleteCommentMessage extends WebviewMessage {
  command: 'deleteComment';
  commentId: string;
}

// Union type for all possible messages
export type IncomingWebviewMessage = 
  | AddCommentMessage 
  | EditCommentMessage 
  | DeleteCommentMessage;

// Messages sent from extension to webview
export interface CommentAddedMessage {
  command: 'commentAdded';
  comment: any; // This should be ReviewComment but avoiding circular dependency
}

export interface CommentUpdatedMessage {
  command: 'commentUpdated';
  comment: any; // This should be ReviewComment
}

export interface CommentDeletedMessage {
  command: 'commentDeleted';
  commentId: string;
}

export type OutgoingWebviewMessage =
  | CommentAddedMessage
  | CommentUpdatedMessage
  | CommentDeletedMessage;