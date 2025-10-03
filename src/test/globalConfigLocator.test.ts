import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { findGlobalNugetConfig } from '../services/globalConfigLocator';

// This test suite tests platform-specific logic for locating global NuGet configs.
// Unix/macOS tests use HOME env var, Windows tests use APPDATA.

suite('globalConfigLocator', () => {
    // Non-Windows (Unix/macOS) tests - skip on Windows
    (process.platform === 'win32' ? suite.skip : suite)('Unix/macOS HOME-based logic', () => {
        const originalHome = process.env.HOME;
        const tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), 'tmp-home-'));

        suiteTeardown(() => {
            if (originalHome !== undefined) {
                process.env.HOME = originalHome;
            } else {
                delete process.env.HOME;
            }
        });

        test('returns undefined when no candidates exist', () => {
            process.env.HOME = tempRoot + '-empty'; // point to directory that doesn't exist
            const result = findGlobalNugetConfig();
            assert.strictEqual(result, undefined);
        });

        test('finds ~/.config/NuGet/NuGet.Config when present', () => {
            const home = path.join(tempRoot, 'home1');
            fs.mkdirSync(path.join(home, '.config', 'NuGet'), { recursive: true });
            const cfg = path.join(home, '.config', 'NuGet', 'NuGet.Config');
            fs.writeFileSync(cfg, '<configuration />');
            process.env.HOME = home;
            const result = findGlobalNugetConfig();
            assert.strictEqual(result, cfg);
        });

        test('falls back to ~/.nuget/NuGet/NuGet.Config when .config variant missing', () => {
            const home = path.join(tempRoot, 'home2');
            fs.mkdirSync(path.join(home, '.nuget', 'NuGet'), { recursive: true });
            const cfg = path.join(home, '.nuget', 'NuGet', 'NuGet.Config');
            fs.writeFileSync(cfg, '<configuration />');
            process.env.HOME = home;
            const result = findGlobalNugetConfig();
            assert.strictEqual(result, cfg);
        });
    });

    // Windows tests - skip on non-Windows
    (process.platform === 'win32' ? suite : suite.skip)('Windows APPDATA-based logic', () => {
        const originalAppData = process.env.APPDATA;
        const tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), 'tmp-appdata-'));

        suiteTeardown(() => {
            if (originalAppData !== undefined) {
                process.env.APPDATA = originalAppData;
            } else {
                delete process.env.APPDATA;
            }
        });

        test('returns undefined when APPDATA not set', () => {
            delete process.env.APPDATA;
            const result = findGlobalNugetConfig();
            assert.strictEqual(result, undefined);
        });

        test('returns undefined when config does not exist', () => {
            process.env.APPDATA = tempRoot + '-empty'; // point to directory that doesn't exist
            const result = findGlobalNugetConfig();
            assert.strictEqual(result, undefined);
        });

        test('finds APPDATA/NuGet/NuGet.Config when present', () => {
            const appData = path.join(tempRoot, 'appdata1');
            fs.mkdirSync(path.join(appData, 'NuGet'), { recursive: true });
            const cfg = path.join(appData, 'NuGet', 'NuGet.Config');
            fs.writeFileSync(cfg, '<configuration />');
            process.env.APPDATA = appData;
            const result = findGlobalNugetConfig();
            assert.strictEqual(result, cfg);
        });
    });
});
