import type { ConfigModel, ValidationIssue } from './types';

export type HostToWebview =
    | { type: 'init'; model: ConfigModel; settings: Record<string, unknown> }
    | { type: 'validation'; issues: ValidationIssue[] }
    | { type: 'saveResult'; ok: true }
    | { type: 'saveResult'; ok: false; error: string }
    | { type: 'error'; error: string };

export type EditOp =
    | { kind: 'addSource'; key: string; url: string }
    | { kind: 'updateSource'; key: string; newKey?: string; url?: string }
    | { kind: 'deleteSource'; key: string }
    | { kind: 'toggleSource'; key: string; enabled: boolean }
    | { kind: 'setMappings'; key: string; patterns: string[] };

export type WebviewToHost =
    | { type: 'ready' }
    | { type: 'edit'; ops: EditOp[] }
    | { type: 'requestSave' }
    | { type: 'requestReparse' };
