import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
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
            log?.debug('Parsed nuget.config', { path: sourcePath, sources: model.sources.length, mappings: model.mappings.length });
        } catch {
            // ignore logging failures
            log?.error('Logging parsed nuget.config failed', { path: sourcePath });
        }

        return model;
    } catch (err) {
        log?.error('Failed to parse nuget.config', { error: String(err) });
        throw err;
    }
}

export function serializeModel(model: ConfigModel, preserveUnknown: boolean, eol: string): string {
    // If preserveUnknown and original raw XML is available, use DOM-based merging to preserve comments and structure
    if (preserveUnknown && model.rawUnknown) {
        return serializeWithDom(model, model.rawUnknown, eol);
    }

    // Build XML object structure using fast-xml-parser for new files
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

    const built = builder.build({ configuration });
    // Basic newline normalization
    const normalized = built.replace(/\r?\n/g, eol);
    return normalized;
}

function serializeWithDom(model: ConfigModel, originalXml: string, eol: string): string {
    try {
        // Normalize XML to ensure comments are parsed correctly by xmldom
        // We need to remove newlines but preserve whitespace inside comments
        let normalizedXml = originalXml.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Parse the original XML using xmldom to preserve comments and structure
        const domParser = new DOMParser();
        const doc = domParser.parseFromString(normalizedXml, 'text/xml');
        
        // Get or create configuration element
        let configElement = doc.getElementsByTagName('configuration')[0];
        if (!configElement) {
            configElement = doc.createElement('configuration');
            doc.appendChild(configElement);
        }
        
        // Update packageSources section
        updatePackageSourcesSection(doc, configElement, model.sources);
        
        // Update disabledPackageSources section
        updateDisabledSourcesSection(doc, configElement, model.sources);
        
        // Update packageSourceMapping section
        updatePackageSourceMappingSection(doc, configElement, model.mappings);
        
        // Serialize back to string
        const serializer = new XMLSerializer();
        let result = serializer.serializeToString(doc);
        
        // Apply basic formatting to make output more readable
        result = formatXmlOutput(result);
        
        // Normalize line endings
        result = result.replace(/\r?\n/g, eol);
        
        return result;
    } catch (error) {
        // Fall back to fast-xml-parser if DOM parsing fails
        return serializeWithFastXmlParser(model, eol);
    }
}

function updatePackageSourcesSection(doc: Document, configElement: Element, sources: PackageSource[]): void {
    // Find existing packageSources element
    let packageSourcesElement = findDirectChild(configElement, 'packageSources');
    
    if (sources.length === 0) {
        // Remove packageSources if no sources
        if (packageSourcesElement) {
            configElement.removeChild(packageSourcesElement);
        }
        return;
    }
    
    if (!packageSourcesElement) {
        // Create new packageSources element
        packageSourcesElement = doc.createElement('packageSources');
        configElement.appendChild(packageSourcesElement);
    } else {
        // Remove only <add> elements, preserve comments and other elements like <clear/>
        const nodesToRemove: Node[] = [];
        for (let i = 0; i < packageSourcesElement.childNodes.length; i++) {
            const child = packageSourcesElement.childNodes[i];
            if (child.nodeType === 1 && child.nodeName === 'add') { // Element node
                nodesToRemove.push(child);
            }
        }
        nodesToRemove.forEach(node => packageSourcesElement!.removeChild(node));
    }
    
    // Add new source elements
    for (const source of sources) {
        const addElement = doc.createElement('add');
        addElement.setAttribute('key', source.key);
        addElement.setAttribute('value', source.url);
        packageSourcesElement.appendChild(addElement);
    }
}

function updateDisabledSourcesSection(doc: Document, configElement: Element, sources: PackageSource[]): void {
    const disabledSources = sources.filter(s => !s.enabled);
    let disabledElement = findDirectChild(configElement, 'disabledPackageSources');
    
    if (disabledSources.length === 0) {
        // Remove disabledPackageSources if no disabled sources
        if (disabledElement) {
            configElement.removeChild(disabledElement);
        }
        return;
    }
    
    if (!disabledElement) {
        // Create new disabledPackageSources element after packageSources
        disabledElement = doc.createElement('disabledPackageSources');
        const packageSourcesElement = findDirectChild(configElement, 'packageSources');
        if (packageSourcesElement && packageSourcesElement.nextSibling) {
            configElement.insertBefore(disabledElement, packageSourcesElement.nextSibling);
        } else {
            configElement.appendChild(disabledElement);
        }
    } else {
        // Clear existing add elements
        while (disabledElement.firstChild) {
            disabledElement.removeChild(disabledElement.firstChild);
        }
    }
    
    // Add disabled source elements
    for (const source of disabledSources) {
        const addElement = doc.createElement('add');
        addElement.setAttribute('key', source.key);
        addElement.setAttribute('value', 'true');
        disabledElement.appendChild(addElement);
    }
}

function updatePackageSourceMappingSection(doc: Document, configElement: Element, mappings: PackageSourceMapping[]): void {
    let mappingElement = findDirectChild(configElement, 'packageSourceMapping');
    
    if (mappings.length === 0) {
        // Remove packageSourceMapping if no mappings
        if (mappingElement) {
            configElement.removeChild(mappingElement);
        }
        return;
    }
    
    if (!mappingElement) {
        // Create new packageSourceMapping element
        mappingElement = doc.createElement('packageSourceMapping');
        configElement.appendChild(mappingElement);
    } else {
        // Clear existing content
        while (mappingElement.firstChild) {
            mappingElement.removeChild(mappingElement.firstChild);
        }
    }
    
    // Add mapping elements
    for (const mapping of mappings) {
        const packageSourceElement = doc.createElement('packageSource');
        packageSourceElement.setAttribute('key', mapping.sourceKey);
        
        for (const pattern of mapping.patterns) {
            const packageElement = doc.createElement('package');
            packageElement.setAttribute('pattern', pattern);
            packageSourceElement.appendChild(packageElement);
        }
        
        mappingElement.appendChild(packageSourceElement);
    }
}

function findDirectChild(parent: Element, tagName: string): Element | null {
    for (let i = 0; i < parent.childNodes.length; i++) {
        const child = parent.childNodes[i];
        if (child.nodeType === 1 && child.nodeName === tagName) {
            return child as Element;
        }
    }
    return null;
}

function formatXmlOutput(xml: string): string {
    // Basic formatting to add indentation
    let formatted = xml;
    
    // Add newlines after closing tags for better readability
    formatted = formatted.replace(/<\/packageSources>/g, '\n  </packageSources>');
    formatted = formatted.replace(/<\/disabledPackageSources>/g, '\n  </disabledPackageSources>');
    formatted = formatted.replace(/<\/packageSourceMapping>/g, '\n  </packageSourceMapping>');
    formatted = formatted.replace(/<\/configuration>/g, '\n</configuration>');
    
    // Add indentation for add elements
    formatted = formatted.replace(/<add /g, '\n    <add ');
    
    // Add indentation for packageSource elements
    formatted = formatted.replace(/<packageSource /g, '\n    <packageSource ');
    formatted = formatted.replace(/<\/packageSource>/g, '\n    </packageSource>');
    
    // Add indentation for package elements
    formatted = formatted.replace(/<package /g, '\n      <package ');
    
    // Clean up multiple consecutive newlines
    formatted = formatted.replace(/\n\n+/g, '\n');
    
    // Add newline after opening packageSources/disabledPackageSources/packageSourceMapping tags
    formatted = formatted.replace(/<packageSources>/g, '<packageSources>\n');
    formatted = formatted.replace(/<disabledPackageSources>/g, '<disabledPackageSources>\n');
    formatted = formatted.replace(/<packageSourceMapping>/g, '<packageSourceMapping>\n');
    formatted = formatted.replace(/<configuration>/g, '<configuration>\n  ');
    
    return formatted;
}

function serializeWithFastXmlParser(model: ConfigModel, eol: string): string {
    const configuration: any = {};
    if (model.sources.length) {
        configuration.packageSources = { add: model.sources.map(s => ({ '@_key': s.key, '@_value': s.url })) };
    }
    const disabled = model.sources.filter(s => !s.enabled);
    if (disabled.length) {
        configuration.disabledPackageSources = { add: disabled.map(s => ({ '@_key': s.key, '@_value': 'true' })) };
    }
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

    const built = builder.build({ configuration });
    return built.replace(/\r?\n/g, eol);
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
