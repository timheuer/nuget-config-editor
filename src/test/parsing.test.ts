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

    test('preserve XML declaration and comments', () => {
        const xmlWithComments = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <!--Begin: Package sources managed by Dependency Flow automation. Do not edit the sources below.-->
    <!--  Begin: Package sources from dotnet-aspnetcore -->
    <!--  End: Package sources from dotnet-aspnetcore -->
    <add key="dotnet-public" value="https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-public/nuget/v3/index.json" />
    <add key="dotnet-eng" value="https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-eng/nuget/v3/index.json" />
  </packageSources>
</configuration>`;
        
        const model = parseNugetConfig(xmlWithComments, true);
        // Toggle a source to trigger a change
        const dotnetPublic = model.sources.find(s => s.key === 'dotnet-public');
        if (dotnetPublic) {
            dotnetPublic.enabled = false;
        }
        
        const xml = serializeModel(model, true, '\n');
        
        // Should preserve XML declaration
        assert.ok(xml.includes('<?xml version="1.0" encoding="utf-8"?>'), 'XML declaration should be preserved');
        
        // Should preserve comments (content preserved, whitespace may be normalized)
        assert.ok(xml.includes('<!--Begin: Package sources managed by Dependency Flow'), 'First comment should be preserved');
        assert.ok(xml.includes('Begin: Package sources from dotnet-aspnetcore'), 'Second comment content should be preserved');
        assert.ok(xml.includes('<clear'), '<clear /> element should be preserved');
        assert.ok(xml.includes('<disabledPackageSources>'), 'disabledPackageSources should be added for disabled source');
    });
});
