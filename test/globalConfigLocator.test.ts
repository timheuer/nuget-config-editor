import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { findGlobalNugetConfig } from '../src/services/globalConfigLocator';

// This test focuses on non-Windows logic (HOME-based) which will run on CI (Linux/macOS).
// It temporarily points HOME to a temp directory and creates only the second candidate path
// to verify precedence and detection.

describe('globalConfigLocator', () => {
    const originalHome = process.env.HOME;
    const tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), 'tmp-home-'));

    after(() => {
        if (originalHome !== undefined) {
            process.env.HOME = originalHome;
        } else {
            delete process.env.HOME;
        }
    });

    it('returns undefined when no candidates exist', () => {
        process.env.HOME = tempRoot + '-empty'; // point to directory that doesn't exist
        const result = findGlobalNugetConfig();
        assert.strictEqual(result, undefined);
    });

    it('finds ~/.config/NuGet/NuGet.Config when present', () => {
        const home = path.join(tempRoot, 'home1');
        fs.mkdirSync(path.join(home, '.config', 'NuGet'), { recursive: true });
        const cfg = path.join(home, '.config', 'NuGet', 'NuGet.Config');
        fs.writeFileSync(cfg, '<configuration />');
        process.env.HOME = home;
        const result = findGlobalNugetConfig();
        assert.strictEqual(result, cfg);
    });

    it('falls back to ~/.nuget/NuGet/NuGet.Config when .config variant missing', () => {
        const home = path.join(tempRoot, 'home2');
        fs.mkdirSync(path.join(home, '.nuget', 'NuGet'), { recursive: true });
        const cfg = path.join(home, '.nuget', 'NuGet', 'NuGet.Config');
        fs.writeFileSync(cfg, '<configuration />');
        process.env.HOME = home;
        const result = findGlobalNugetConfig();
        assert.strictEqual(result, cfg);
    });
});
