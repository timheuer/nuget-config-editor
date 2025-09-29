import { ConfigModel, ValidationIssue } from '../model/types';

const URL_REGEX = /^(https?):\/\/[\w\-_.~%/:?#@!$&'()*+,;=]+$/i;

export function validate(model: ConfigModel): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();
    for (const s of model.sources) {
        if (!s.key || !s.key.trim()) {
            issues.push(err('EMPTY_KEY', 'Source key is empty', `sources.${s.key || '<empty>'}`));
        } else if (seen.has(s.key)) {
            issues.push(err('DUP_KEY', `Duplicate source key '${s.key}'`, `sources.${s.key}`));
        } else {
            seen.add(s.key);
        }
        if (!s.url || !URL_REGEX.test(s.url)) {
            issues.push(err('BAD_URL', `Invalid URL for source '${s.key}'`, `sources.${s.key}.url`));
        }
    }
    for (const m of model.mappings) {
        const patternSet = new Set<string>();
        for (const p of m.patterns) {
            if (patternSet.has(p)) {
                issues.push(err('DUP_PATTERN', `Duplicate pattern '${p}' for source '${m.sourceKey}'`, `mappings.${m.sourceKey}`));
            }
            patternSet.add(p);
        }
    }
    return issues;
}

function err(code: string, message: string, path: string): ValidationIssue {
    return { level: 'error', code, message, path };
}
