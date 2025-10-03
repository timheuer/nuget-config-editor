// Shared glob patterns for locating NuGet configuration files
// Keep patterns centralized to ensure consistency across tree provider, commands, etc.
export const NUGET_CONFIG_GLOB = '**/[nN][uU][gG][eE][tT].[cC][oO][nN][fF][iI][gG]';
export const NUGET_CONFIG_EXCLUDE_GLOB = '**/{node_modules,bin,obj}/**';

// Configuration setting keys (centralized to avoid string duplication)
export const SETTING_SHOW_GLOBAL = 'nugetConfigEditor.showGlobalConfig';
