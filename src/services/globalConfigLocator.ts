import * as path from 'path';
import * as fs from 'fs';

/**
 * Attempts to locate the user-level global NuGet.Config file across platforms.
 * Returns the absolute path if found, otherwise undefined.
 * Priority order follows common NuGet documentation: user config locations.
 */
export function findGlobalNugetConfig(): string | undefined {
    const candidates: string[] = [];
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA; // e.g. C:\Users\user\AppData\Roaming
        if (appData) {
            candidates.push(path.join(appData, 'NuGet', 'NuGet.Config'));
        }
        // (Intentionally not including machine-wide config to avoid write permission issues.)
    } else {
        const home = process.env.HOME;
        if (home) {
            // Newer layout
            candidates.push(path.join(home, '.config', 'NuGet', 'NuGet.Config'));
            // Older layout still used by some environments
            candidates.push(path.join(home, '.nuget', 'NuGet', 'NuGet.Config'));
        }
    }
    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) {
                return c;
            }
        } catch { /* ignore */ }
    }
    return undefined;
}
