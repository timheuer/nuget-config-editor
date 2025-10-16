import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as vscode from 'vscode';
import { ConfigModel, PackageSource, PackageSourceMapping } from '../model/types';
import { Logger } from '@timheuer/vscode-ext-logger';
import { SETTING_PRESERVE_UNKNOWN_XML } from '../constants';

export interface ParseResult {
    model: ConfigModel;
    raw: string;
}

const parser = new XMLParser({
    ignoreAttributes: false,
    allowBooleanAttributes: true,
    preserveOrder: false,
});

export function parseNugetConfig(xml: string, preserveUnknown: boolean, sourcePath?: string, log?: Logger): ConfigModel {
    
    try {
        const doc = parser.parse(xml) as any; // expected root configuration
        const configuration = doc.configuration || doc['configuration'] || doc; // be tolerant
        const packageSourcesNode = configuration.packageSources || {};
        const disabledNode = configuration.disabledPackageSources || {};
        const mappingNode = configuration.packageSourceMapping || {};

        const sources: PackageSource[] = [];
        if (packageSourcesNode.add) {
            const adds = Array.isArray(packageSourcesNode.add) ? packageSourcesNode.add : [packageSourcesNode.add];
            for (const a of adds) {
                const key = a['@_key'] ?? a.key ?? '';
                const value = a['@_value'] ?? a.value ?? '';
                if (key) {
                    sources.push({ key, url: value, enabled: true });
                }
            }
        }

        const disabledMap = new Set<string>();
        if (disabledNode.add) {
            const adds = Array.isArray(disabledNode.add) ? disabledNode.add : [disabledNode.add];
            for (const a of adds) {
                const key = a['@_key'] ?? a.key;
                if (key) { disabledMap.add(String(key)); }
            }
        }

        for (const s of sources) {
            if (disabledMap.has(s.key)) { s.enabled = false; }
        }

        // Support multiple mapping schema variants. nuget.config may use either:
        //  - <packageSourceMapping><package key="..."><add pattern="..."/></package></packageSourceMapping>
        //  - <packageSourceMapping><packageSource key="..."><package pattern="..."/></packageSource></packageSourceMapping>
        const mappings: PackageSourceMapping[] = [];
        // Variant A: mappingNode.package
        if (mappingNode.package) {
            const pkgs = Array.isArray(mappingNode.package) ? mappingNode.package : [mappingNode.package];
            for (const p of pkgs) {
                const sourceKey = p['@_key'] ?? p.key;
                const patterns: string[] = [];
                if (p.add) {
                    const adds = Array.isArray(p.add) ? p.add : [p.add];
                    for (const a of adds) {
                        const pattern = a['@_pattern'] ?? a.pattern;
                        if (pattern) { patterns.push(String(pattern)); }
                    }
                }
                if (sourceKey) { mappings.push({ sourceKey, patterns }); }
            }
        }
        // Variant B: mappingNode.packageSource (more common in newer nuget.config samples)
        else if (mappingNode.packageSource) {
            const pkgs = Array.isArray(mappingNode.packageSource) ? mappingNode.packageSource : [mappingNode.packageSource];
            for (const ps of pkgs) {
                const sourceKey = ps['@_key'] ?? ps.key ?? ps['@_name'] ?? undefined;
                const patterns: string[] = [];
                if (ps.package) {
                    const adds = Array.isArray(ps.package) ? ps.package : [ps.package];
                    for (const p of adds) {
                        const pattern = p['@_pattern'] ?? p.pattern;
                        if (pattern) { patterns.push(String(pattern)); }
                    }
                }
                if (sourceKey) { mappings.push({ sourceKey, patterns }); }
            }
        }

        let unknown = '';
        if (preserveUnknown) {
            // Simple preservation: store entire original xml (will evolve to partial preservation in future iteration)
            unknown = xml;
        }

        const model: ConfigModel = { sources, mappings, rawUnknown: preserveUnknown ? unknown : undefined };
        // Log debug info about the parsed content. If a sourcePath was provided, include it.
        try {
            log?.debug('✅ Parsed nuget.config', { path: sourcePath, sources: model.sources.length, mappings: model.mappings.length });
        } catch {
            // ignore logging failures
            log?.error('❌ Logging parsed nuget.config failed', { path: sourcePath });
        }

        return model;
    } catch (err) {
        log?.error('❌ Failed to parse nuget.config', { error: String(err) });
        throw err;
    }
}

export function serializeModel(model: ConfigModel, preserveUnknown: boolean, eol: string): string {
    // Build XML object structure
    const configuration: any = {};
    if (model.sources.length) {
        configuration.packageSources = { add: model.sources.map(s => ({ '@_key': s.key, '@_value': s.url })) };
    }
    const disabled = model.sources.filter(s => !s.enabled);
    if (disabled.length) {
        configuration.disabledPackageSources = { add: disabled.map(s => ({ '@_key': s.key, '@_value': 'true' })) };
    }
    // Serialize mappings using the packageSource/package pattern which preserves the common nuget.config form
    if (model.mappings.length) {
        configuration.packageSourceMapping = {
            packageSource: model.mappings.map(m => ({
                '@_key': m.sourceKey,
                package: m.patterns.map(p => ({ '@_pattern': p }))
            }))
        };
    }

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        suppressBooleanAttributes: false,
        format: true,
        suppressEmptyNode: true,
    });

    // If preserveUnknown and original raw XML is available, merge changes into that original structure
    if (preserveUnknown && model.rawUnknown) {
        try {
            const orig = parser.parse(model.rawUnknown) as any;
            const origConfig = orig.configuration || orig['configuration'] || orig;
            // Replace or delete known sections according to new configuration
            if (configuration.packageSources) {
                origConfig.packageSources = configuration.packageSources;
            } else {
                delete origConfig.packageSources;
            }
            if (configuration.disabledPackageSources) {
                origConfig.disabledPackageSources = configuration.disabledPackageSources;
            } else {
                delete origConfig.disabledPackageSources;
            }
            if (configuration.packageSourceMapping) {
                origConfig.packageSourceMapping = configuration.packageSourceMapping;
            } else {
                delete origConfig.packageSourceMapping;
            }
            // Ensure the top-level has configuration property if original did
            const toBuild = { configuration: origConfig };
            const built = builder.build(toBuild);
            const normalized = built.replace(/\r?\n/g, eol);
            return normalized;
        } catch (e) {
            // Fall back to building from scratch on error
        }
    }

    const built = builder.build({ configuration });
    // Basic newline normalization
    const normalized = built.replace(/\r?\n/g, eol);
    return normalized;
}


export async function writeModelToUri(uri: vscode.Uri, model: ConfigModel, preserveUnknown: boolean): Promise<void> {
    const eol = detectEol();
    const xml = serializeModel(model, preserveUnknown, eol);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(xml));
}

function detectEol(): string {
    const eol = vscode.workspace.getConfiguration('files').get<string>('eol');
    if (eol === '\n' || eol === '\r\n') { return eol; }
    return '\n';
}
