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
    // If preserveUnknown and original raw XML is available, use string-based replacement to preserve structure
    if (preserveUnknown && model.rawUnknown) {
        return preserveXmlStructure(model, model.rawUnknown, eol);
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

function preserveXmlStructure(model: ConfigModel, originalXml: string, eol: string): string {
    let result = originalXml;
    
    // Update packageSources section
    result = updatePackageSourcesInXml(result, model.sources, eol);
    
    // Update disabledPackageSources section
    const disabled = model.sources.filter(s => !s.enabled);
    result = updateDisabledSourcesInXml(result, disabled, eol);
    
    // Update packageSourceMapping section
    result = updateMappingsInXml(result, model.mappings, eol);
    
    // Normalize line endings
    result = result.replace(/\r?\n/g, eol);
    
    return result;
}

function updatePackageSourcesInXml(xml: string, sources: PackageSource[], eol: string): string {
    // Find the packageSources section
    const packageSourcesRegex = /<packageSources>([\s\S]*?)<\/packageSources>/;
    const match = xml.match(packageSourcesRegex);
    
    if (!match) {
        // No existing packageSources section - add one if there are sources
        if (sources.length > 0) {
            const newSection = buildPackageSourcesSection(sources, eol);
            return xml.replace('</configuration>', `  ${newSection}${eol}</configuration>`);
        }
        return xml;
    }
    
    const [fullMatch, innerContent] = match;
    
    // Remove <add> elements while preserving comments and other content
    // Strategy: split by lines, filter out lines with <add> tags that are NOT inside comments
    const nonAddContent = removeAddElementsPreservingComments(innerContent);
    
    // Build new add elements with proper indentation
    const indent = detectIndentation(innerContent);
    const addElements = sources.map(s => 
        `${indent}<add key="${escapeXmlAttribute(s.key)}" value="${escapeXmlAttribute(s.url)}" />`
    ).join(eol);
    
    // Reconstruct the section preserving non-add content
    const newInnerContent = nonAddContent.trimEnd() + (nonAddContent.trim() ? eol : '') + addElements + eol + '  ';
    const newSection = `<packageSources>${newInnerContent}</packageSources>`;
    
    return xml.replace(fullMatch, newSection);
}

function removeAddElementsPreservingComments(content: string): string {
    // Parse the content to track comment boundaries and only remove <add> elements outside comments
    let result = '';
    let inComment = false;
    let i = 0;
    
    while (i < content.length) {
        // Check for comment start
        if (!inComment && content.substring(i, i + 4) === '<!--') {
            inComment = true;
            result += '<!--';
            i += 4;
            continue;
        }
        
        // Check for comment end
        if (inComment && content.substring(i, i + 3) === '-->') {
            inComment = false;
            result += '-->';
            i += 3;
            continue;
        }
        
        // If we're in a comment, just copy the character
        if (inComment) {
            result += content[i];
            i++;
            continue;
        }
        
        // Outside comment: check for <add> tags
        if (content.substring(i, i + 4) === '<add') {
            // Find the end of this add element
            const selfClosing = content.indexOf('/>', i);
            const openClosing = content.indexOf('</add>', i);
            
            let endPos = -1;
            if (selfClosing !== -1 && (openClosing === -1 || selfClosing < openClosing)) {
                endPos = selfClosing + 2;
            } else if (openClosing !== -1) {
                endPos = openClosing + 6;
            }
            
            if (endPos !== -1) {
                // Skip the entire <add> element
                i = endPos;
                continue;
            }
        }
        
        // Copy character
        result += content[i];
        i++;
    }
    
    return result;
}

function updateDisabledSourcesInXml(xml: string, disabled: PackageSource[], eol: string): string {
    const disabledRegex = /<disabledPackageSources>([\s\S]*?)<\/disabledPackageSources>/;
    const match = xml.match(disabledRegex);
    
    if (disabled.length === 0) {
        // Remove the section if no disabled sources
        if (match) {
            return xml.replace(disabledRegex, '');
        }
        return xml;
    }
    
    const newSection = buildDisabledSourcesSection(disabled, eol);
    
    if (match) {
        // Replace existing section
        return xml.replace(disabledRegex, newSection);
    } else {
        // Add new section after packageSources
        const packageSourcesRegex = /<\/packageSources>/;
        if (packageSourcesRegex.test(xml)) {
            return xml.replace(packageSourcesRegex, `</packageSources>${eol}  ${newSection}`);
        } else {
            // Add before closing configuration tag
            return xml.replace('</configuration>', `  ${newSection}${eol}</configuration>`);
        }
    }
}

function updateMappingsInXml(xml: string, mappings: PackageSourceMapping[], eol: string): string {
    const mappingRegex = /<packageSourceMapping>([\s\S]*?)<\/packageSourceMapping>/;
    const match = xml.match(mappingRegex);
    
    if (mappings.length === 0) {
        // Remove the section if no mappings
        if (match) {
            return xml.replace(mappingRegex, '');
        }
        return xml;
    }
    
    // If there's an existing section, preserve its structure including comments inside packageSource elements
    if (match) {
        const [fullMatch, innerContent] = match;
        const newSection = updateMappingsPreservingComments(innerContent, mappings, eol);
        return xml.replace(fullMatch, `<packageSourceMapping>${newSection}</packageSourceMapping>`);
    } else {
        // Add new section before closing configuration tag
        const newSection = buildMappingsSection(mappings, eol);
        return xml.replace('</configuration>', `  ${newSection}${eol}</configuration>`);
    }
}

function updateMappingsPreservingComments(originalContent: string, mappings: PackageSourceMapping[], eol: string): string {
    // Parse the original content to extract packageSource elements with their comments
    const originalPackageSources = new Map<string, string>();
    
    // Match packageSource elements including their content and any comments inside
    const packageSourceRegex = /<packageSource\s+key="([^"]+)">([\s\S]*?)<\/packageSource>/g;
    let match;
    while ((match = packageSourceRegex.exec(originalContent)) !== null) {
        const key = match[1];
        const content = match[2];
        originalPackageSources.set(key, content);
    }
    
    // Build new packageSource elements, preserving comments from original if the key exists
    const packageSources = mappings.map(m => {
        const originalContent = originalPackageSources.get(m.sourceKey);
        
        if (originalContent) {
            // Extract comments from original content
            const comments: string[] = [];
            const commentRegex = /<!--[\s\S]*?-->/g;
            const commentMatches = originalContent.match(commentRegex);
            if (commentMatches) {
                comments.push(...commentMatches);
            }
            
            // Build new package patterns
            const patterns = m.patterns.map(p => 
                `      <package pattern="${escapeXmlAttribute(p)}" />`
            ).join(eol);
            
            // Combine patterns with preserved comments
            let content = eol + patterns;
            if (comments.length > 0) {
                // Add comments before the patterns
                content = eol + comments.map(c => `      ${c}`).join(eol) + eol + patterns;
            }
            content += eol + '    ';
            
            return `    <packageSource key="${escapeXmlAttribute(m.sourceKey)}">${content}</packageSource>`;
        } else {
            // New packageSource without comments
            const patterns = m.patterns.map(p => 
                `      <package pattern="${escapeXmlAttribute(p)}" />`
            ).join(eol);
            return `    <packageSource key="${escapeXmlAttribute(m.sourceKey)}">${eol}${patterns}${eol}    </packageSource>`;
        }
    }).join(eol);
    
    return eol + packageSources + eol + '  ';
}

function buildPackageSourcesSection(sources: PackageSource[], eol: string): string {
    const addElements = sources.map(s => 
        `    <add key="${escapeXmlAttribute(s.key)}" value="${escapeXmlAttribute(s.url)}" />`
    ).join(eol);
    return `<packageSources>${eol}${addElements}${eol}  </packageSources>`;
}

function buildDisabledSourcesSection(disabled: PackageSource[], eol: string): string {
    const addElements = disabled.map(s => 
        `    <add key="${escapeXmlAttribute(s.key)}" value="true" />`
    ).join(eol);
    return `<disabledPackageSources>${eol}${addElements}${eol}  </disabledPackageSources>`;
}

function buildMappingsSection(mappings: PackageSourceMapping[], eol: string): string {
    const packageSources = mappings.map(m => {
        const patterns = m.patterns.map(p => 
            `      <package pattern="${escapeXmlAttribute(p)}" />`
        ).join(eol);
        return `    <packageSource key="${escapeXmlAttribute(m.sourceKey)}">${eol}${patterns}${eol}    </packageSource>`;
    }).join(eol);
    return `<packageSourceMapping>${eol}${packageSources}${eol}  </packageSourceMapping>`;
}

function escapeXmlAttribute(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function detectIndentation(xmlContent: string): string {
    // Try to detect the indentation used in the XML
    const match = xmlContent.match(/\n(\s+)</);
    return match ? match[1] : '    '; // Default to 4 spaces
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
