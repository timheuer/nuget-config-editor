import * as assert from 'assert';
import { applyEditOps } from '../services/editOps';
import { ConfigModel } from '../model/types';

suite('EditOps', () => {
    const base: ConfigModel = { sources: [{ key: 'a', url: 'http://a', enabled: true }], mappings: [] };

    test('addSource', () => {
        const updated = applyEditOps(base, [{ kind: 'addSource', key: 'b', url: 'http://b' }]);
        assert.strictEqual(updated.sources.length, 2);
    });

    test('toggleSource', () => {
        const updated = applyEditOps(base, [{ kind: 'toggleSource', key: 'a', enabled: false }]);
        assert.strictEqual(updated.sources[0].enabled, false);
    });

    test('updateSource rename', () => {
        const updated = applyEditOps(base, [{ kind: 'updateSource', key: 'a', newKey: 'c', url: 'http://a2' }]);
        assert.ok(updated.sources.find(s => s.key === 'c'));
        assert.strictEqual(updated.sources[0].url, 'http://a2');
    });

    test('deleteSource', () => {
        const updated = applyEditOps(base, [{ kind: 'deleteSource', key: 'a' }]);
        assert.strictEqual(updated.sources.length, 0);
    });
});
