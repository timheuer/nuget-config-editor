import * as vscode from 'vscode';
import { createLoggerFromConfig } from '@timheuer/vscode-ext-logger';

// Minimal Logger interface used by callers in this extension. It mirrors
// the small surface we use: trace/debug/info/warn/error. We prefer this
// explicit type over `any` so call sites get proper completion and safety.
export type Logger = {
    trace?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
};

let loggerInstance: Logger | undefined;

// Initializes logging using the workspace setting `nugetConfigEditor.logLevel`.
// If the external logger is available it will be used; otherwise a console
// fallback is selected. Call this during extension activation.
export function initLogging(context: vscode.ExtensionContext): void {
    if (loggerInstance) { return; }

    try {
        // createLoggerFromConfig will read the configuration section and set
        // the level accordingly. Passing `monitorConfig = true` so it updates
        // automatically when the setting changes.
        loggerInstance = createLoggerFromConfig('NuGet Config Editor', 'nugetConfigEditor', 'logLevel', 'info', true, context, true) as unknown as Logger;
        return;
    } catch (e) {
        // fall back to console if anything goes wrong
    }

    loggerInstance = {
        trace: (...args: any[]) => console.debug('[trace]', ...args),
        debug: (...args: any[]) => console.debug('[debug]', ...args),
        info: (...args: any[]) => console.info('[info]', ...args),
        warn: (...args: any[]) => console.warn('[warn]', ...args),
        error: (...args: any[]) => console.error('[error]', ...args),
    } as Logger;
    getLog().warn?.('[nuget-config-editor] Structured logger unavailable, using console fallback.');
}

export function getLog(): Logger {
    if (!loggerInstance) {
        loggerInstance = {
            trace: (...args: any[]) => console.debug('[trace]', ...args),
            debug: (...args: any[]) => console.debug('[debug]', ...args),
            info: (...args: any[]) => console.info('[info]', ...args),
            warn: (...args: any[]) => console.warn('[warn]', ...args),
            error: (...args: any[]) => console.error('[error]', ...args),
        } as Logger;
    }
    return loggerInstance;
}

// Redact potential secrets in URLs and obvious tokens.
export function redact(value: string): string {
    if (!value) { return value; }
    value = value.replace(/(https?:\/\/)([^\s/@]+?:[^\s/@]+?)@/gi, '$1***@');
    value = value.replace(/([A-Za-z0-9+/_-]{20,})/g, '***');
    return value;
}
