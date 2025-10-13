import { ConfigModel, ValidationIssue } from '../model/types';
import { VALIDATION_EMPTY_KEY, VALIDATION_DUPLICATE_KEY, VALIDATION_INVALID_URL, VALIDATION_DUPLICATE_PATTERN } from '../constants';

const URL_REGEX = /^(https?):\/\/[\w\-_.~%/:?#@!$&'()*+,;=]+$/i;

export function validate(model: ConfigModel): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();
    for (const s of model.sources) {
        if (!s.key || !s.key.trim()) {
            issues.push(err('EMPTY_KEY', VALIDATION_EMPTY_KEY, `sources.${s.key || '<empty>'}`));
        } else if (seen.has(s.key)) {
            issues.push(err('DUP_KEY', VALIDATION_DUPLICATE_KEY(s.key), `sources.${s.key}`));
        } else {
            seen.add(s.key);
        }
        if (!s.url || !URL_REGEX.test(s.url)) {
            issues.push(err('BAD_URL', VALIDATION_INVALID_URL(s.key), `sources.${s.key}.url`));
        }
    }
    for (const m of model.mappings) {
        const patternSet = new Set<string>();
        for (const p of m.patterns) {
            if (patternSet.has(p)) {
                issues.push(err('DUP_PATTERN', VALIDATION_DUPLICATE_PATTERN(p, m.sourceKey), `mappings.${m.sourceKey}`));
            }
            patternSet.add(p);
        }
    }
    return issues;
}

function err(code: string, message: string, path: string): ValidationIssue {
    return { level: 'error', code, message, path };
}
