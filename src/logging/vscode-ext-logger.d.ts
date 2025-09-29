declare module '@timheuer/vscode-ext-logger' {
    export enum LogLevel {
        Off = 0,
        Error = 1,
        Warn = 2,
        Info = 3,
        Debug = 4,
        Trace = 5
    }

    export type Logger = {
        trace?: (...args: any[]) => void;
        debug?: (...args: any[]) => void;
        info?: (...args: any[]) => void;
        warn?: (...args: any[]) => void;
        error?: (...args: any[]) => void;
        setLevel?: (level: any) => void;
        enableConfigMonitoring?: (configSection: string, configKey?: string, defaultLevel?: string) => void;
    };

    export function createLogger(options?: { name?: string; level?: string | LogLevel; outputChannel?: boolean; context?: any; logPath?: string }): Logger;
    export function createLoggerFromConfig(name: string, configSection: string, configKey?: string, defaultLevel?: string, outputChannel?: boolean, context?: any, monitorConfig?: boolean): Logger;
    export function createLoggerWithConfigMonitoring(name: string, configSection: string, configKey?: string, defaultLevel?: string, outputChannel?: boolean, context?: any): Logger;

    export { Logger as LoggerType };
}

