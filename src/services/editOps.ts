import { ConfigModel } from '../model/types';
import { EditOp } from '../model/messages';

export function applyEditOps(model: ConfigModel, ops: EditOp[]): ConfigModel {
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
                    break;
                }
                current.sources.push({ key: op.key, url: op.url, enabled: true });
                break;
            }
            case 'updateSource': {
                const idx = current.sources.findIndex(s => s.key === op.key);
                if (idx === -1) { break; }
                const existing = current.sources[idx];
                let newKey = op.newKey ?? existing.key;
                if (newKey !== existing.key && current.sources.some(s => s.key === newKey)) {
                    // collision – skip
                    break;
                }
                current.sources[idx] = { ...existing, key: newKey, url: op.url ?? existing.url };
                // Update mapping key references if key changed
                if (newKey !== existing.key) {
                    current.mappings = current.mappings.map(m => m.sourceKey === existing.key ? { ...m, sourceKey: newKey } : m);
                }
                break;
            }
            case 'deleteSource': {
                current.sources = current.sources.filter(s => s.key !== op.key);
                current.mappings = current.mappings.filter(m => m.sourceKey !== op.key);
                break;
            }
            case 'toggleSource': {
                const s = current.sources.find(src => src.key === op.key);
                if (s) { s.enabled = op.enabled; }
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
