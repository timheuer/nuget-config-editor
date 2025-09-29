export interface PackageSource { key: string; url: string; enabled: boolean; }
export interface PackageSourceMapping { sourceKey: string; patterns: string[]; }
export interface ConfigModel {
    sources: PackageSource[];
    mappings: PackageSourceMapping[];
    rawUnknown?: string;
    versionInfo?: { originalIndent?: string };
}
export interface ValidationIssue { level: 'error' | 'warn'; code: string; message: string; path: string; }
