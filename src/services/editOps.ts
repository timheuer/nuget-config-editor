import { ConfigModel } from '../model/types';
import { EditOp } from '../model/messages';
import { Logger } from '@timheuer/vscode-ext-logger';

export function applyEditOps(model: ConfigModel, ops: EditOp[], logger?: Logger): ConfigModel {
    // Work on shallow clones to keep immutability semantics simple.
    let current: ConfigModel = {
        sources: model.sources.map(s => ({ ...s })),
        mappings: model.mappings.map(m => ({ sourceKey: m.sourceKey, patterns: [...m.patterns] })),
        rawUnknown: model.rawUnknown,
        versionInfo: model.versionInfo ? { ...model.versionInfo } : undefined
    };

    for (const op of ops) {
        switch (op.kind) {
            case 'addSource': {
                if (current.sources.some(s => s.key === op.key)) {
                    // ignore duplicate add
                    logger?.debug(`⏭️ Skipped adding duplicate package source key: ${op.key}`);
                    break;
                }
                current.sources.push({ key: op.key, url: op.url, enabled: true });
                logger?.debug(`➕ Added package source - key: ${op.key}, url: ${op.url}`);
                break;
            }
            case 'updateSource': {
                const idx = current.sources.findIndex(s => s.key === op.key);
                if (idx === -1) { 
                    logger?.debug(`⏭️ Update source skipped - package source key not found: ${op.key}`);
                    break; 
                }
                const existing = current.sources[idx];
                let newKey = op.newKey ?? existing.key;
                if (newKey !== existing.key && current.sources.some(s => s.key === newKey)) {
                    // collision – skip
                    logger?.debug(`⏭️ Update source skipped - key collision: ${existing.key} -> ${newKey}`);
                    break;
                }
                const newUrl = op.url ?? existing.url;
                current.sources[idx] = { ...existing, key: newKey, url: newUrl };
                // Update mapping key references if key changed
                if (newKey !== existing.key) {
                    current.mappings = current.mappings.map(m => m.sourceKey === existing.key ? { ...m, sourceKey: newKey } : m);
                    logger?.debug(`✏️ Updated package source - key: ${existing.key} -> ${newKey}, url: ${existing.url} -> ${newUrl}`);
                } else {
                    logger?.debug(`✏️ Updated package source - key: ${existing.key}, url: ${existing.url} -> ${newUrl}`);
                }
                break;
            }
            case 'deleteSource': {
                const sourceExists = current.sources.some(s => s.key === op.key);
                current.sources = current.sources.filter(s => s.key !== op.key);
                current.mappings = current.mappings.filter(m => m.sourceKey !== op.key);
                if (sourceExists) {
                    logger?.debug(`🗑️ Deleted package source - key: ${op.key}`);
                } else {
                    logger?.debug(`⏭️ Delete source skipped - key not found: ${op.key}`);
                }
                break;
            }
            case 'toggleSource': {
                const s = current.sources.find(src => src.key === op.key);
                if (s) { 
                    const action = op.enabled ? 'enabled' : 'disabled';
                    s.enabled = op.enabled;
                    logger?.debug(`🔄 Package source ${action} - key: ${op.key}`);
                } else {
                    logger?.debug(`⏭️ Toggle source skipped - key not found: ${op.key}`);
                }
                break;
            }
            case 'setMappings': {
                const existing = current.mappings.find(m => m.sourceKey === op.key);
                if (existing) {
                    existing.patterns = [...op.patterns];
                } else {
                    current.mappings.push({ sourceKey: op.key, patterns: [...op.patterns] });
                }
                break;
            }
        }
    }
    return current;
}
