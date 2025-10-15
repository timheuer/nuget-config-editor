import * as assert from 'assert';
import { parseNugetConfig, serializeModel } from '../services/nugetConfigService';
import { validate } from '../services/validationService';

const sample = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="Contoso" value="https://pkgs.contoso.local/v3/index.json" />
  </packageSources>
  <disabledPackageSources>
    <add key="Contoso" value="true" />
  </disabledPackageSources>
  <packageSourceMapping>
    <package key="nuget.org">
      <add pattern="Newtonsoft.*" />
    </package>
  </packageSourceMapping>
</configuration>`;

suite('NuGet Config Parsing & Serialization', () => {
    test('parse basic config', () => {
        const model = parseNugetConfig(sample, false);
        assert.strictEqual(model.sources.length, 2);
        const contoso = model.sources.find(s => s.key === 'Contoso');
        assert.ok(contoso && !contoso.enabled, 'Contoso should be disabled');
        assert.strictEqual(model.mappings.length, 1);
        assert.deepStrictEqual(model.mappings[0].patterns, ['Newtonsoft.*']);
    });

    test('validation catches duplicate and bad url', () => {
        const model = parseNugetConfig(sample, false);
        // inject dup + bad
        model.sources.push({ key: 'nuget.org', url: 'notaurl', enabled: true });
        const issues = validate(model);
        const codes = issues.map(i => i.code).sort();
        assert.ok(codes.includes('DUP_KEY'));
        assert.ok(codes.includes('BAD_URL'));
    });

    test('round trip serialization basic', () => {
        const model = parseNugetConfig(sample, false);
        const xml = serializeModel(model, false, '\n');
        const model2 = parseNugetConfig(xml, false);
        assert.strictEqual(model2.sources.length, model.sources.length);
    });

    test('validation accepts file paths as valid sources', () => {
        const model = parseNugetConfig(sample, false);
        // Add sources with file paths
        model.sources.push({ key: 'LocalFolder', url: 'C:\\packages', enabled: true });
        model.sources.push({ key: 'UnixPath', url: '/home/user/packages', enabled: true });
        model.sources.push({ key: 'UNCPath', url: '\\\\server\\share\\packages', enabled: true });
        const issues = validate(model);
        // Should not have BAD_URL errors for file paths
        const badUrlIssues = issues.filter(i => i.code === 'BAD_URL');
        assert.strictEqual(badUrlIssues.length, 0, 'File paths should be valid package sources');
    });
});
