import * as vscode from 'vscode';

// Git extension API types based on VS Code's Git extension
export interface GitExtension {
  getAPI(version: number): GitAPI;
}

export interface GitAPI {
  repositories: Repository[];
  onDidOpenRepository: vscode.Event<Repository>;
}

export interface Repository {
  rootUri: vscode.Uri;
  state: RepositoryState & {
    onDidChange: vscode.Event<void>;
  };
  show(ref: string, path: string): Promise<string>;
  getRefs?(query?: RefQuery): Promise<Ref[]>;
}

export interface RefQuery {
  pattern?: string;
  count?: number;
  contains?: string;
  sort?: 'alphabetically' | 'committerdate';
}

export interface Ref {
  type: RefType;
  name?: string;
  commit?: string;
  remote?: string;
}

export enum RefType {
  Head,
  RemoteHead,
  Tag
}

export interface RepositoryState {
  HEAD: Branch | undefined;
  workingTreeChanges: Change[];
  indexChanges: Change[];
  untrackedChanges: vscode.Uri[]; // Untracked files are represented as URIs
}

export interface Branch {
  name?: string;
  commit?: string;
  type: number;
  upstream?: {
    name: string;
    remote: string;
  };
}

export interface Change {
  uri: vscode.Uri;
  status: number;
}

export interface Commit {
  hash: string;
  message: string;
  parents: string[];
  authorDate?: Date;
  authorName?: string;
  authorEmail?: string;
  commitDate?: Date;
}