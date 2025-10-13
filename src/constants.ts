// Shared glob patterns for locating NuGet configuration files
// Keep patterns centralized to ensure consistency across tree provider, commands, etc.
export const NUGET_CONFIG_GLOB = '**/[nN][uU][gG][eE][tT].[cC][oO][nN][fF][iI][gG]';
export const NUGET_CONFIG_EXCLUDE_GLOB = '**/{node_modules,bin,obj}/**';

// ========== Configuration Keys ==========
export const SETTING_SHOW_GLOBAL = 'nugetConfigEditor.showGlobalConfig';
export const SETTING_LOG_LEVEL = 'nugetConfigEditor.logLevel';
export const SETTING_PREFER_VISUAL_EDITOR = 'nugetConfigEditor.preferVisualEditor';
export const SETTING_PRESERVE_UNKNOWN_XML = 'nugetConfigEditor.preserveUnknownXml';

// ========== Technical Constants ==========
export const CUSTOM_EDITOR_VIEW_TYPE = 'nugetConfigEditor.visualEditor';

// ========== Command Titles ==========
export const COMMAND_TITLE_OPEN_EDITOR = 'NuGet: Open nuget.config editor';
export const COMMAND_TITLE_ADD_PACKAGE_SOURCE = 'NuGet: Add Package Source';
export const COMMAND_TITLE_REFRESH_TREE = 'NuGet: Refresh nuget.config view';
export const COMMAND_TITLE_OPEN_SETTINGS = 'NuGet: Open Settings';

// ========== Dialog & Notification Messages ==========
export const MSG_NO_NUGET_CONFIG_FOUND = 'No nuget.config files found in workspace.';
export const MSG_SELECT_NUGET_CONFIG = 'Select a nuget.config to open';
export const MSG_SELECT_NUGET_CONFIG_FOR_SOURCE = 'Select a nuget.config file to add the package source to';
export const MSG_ENTER_PACKAGE_SOURCE_KEY = 'Enter package source key';
export const MSG_ENTER_PACKAGE_SOURCE_URL = 'Enter package source URL';
export const MSG_CANNOT_SAVE_VALIDATION_ERRORS = 'Cannot save nuget.config due to validation errors.';

// ========== Custom Editor Messages ==========
export const MSG_OPENING_EDITOR = 'Opening NuGet Config Editor';
export const MSG_DELETE_SOURCE_CONFIRM = (key: string) => `Delete source '${key}'? This cannot be undone.`;
export const MSG_DELETE_BUTTON = 'Delete';
export const MSG_APPLIED_EDIT = 'Applied edit to document (unsaved)';
export const MSG_APPLIED_DELETE = 'Applied delete to document (unsaved)';

// ========== Tree View Constants ==========
export const TREE_GLOBAL_CONFIG_LABEL = 'Global nuget.config';
export const TREE_SOURCES_SUFFIX = 'sources';
export const TREE_PARSE_ERROR = 'parse error';
export const TREE_OPEN_EDITOR_COMMAND = 'Open Editor';

// ========== Webview UI Text ==========
export const UI_PACKAGE_SOURCES = 'Package Sources';
export const UI_KEY = 'Key';
export const UI_URL = 'URL';
export const UI_ENABLED = 'Enabled';
export const UI_ACTIONS = 'Actions';
export const UI_NO_SOURCES = '(No sources)';
export const UI_YES = 'Yes';
export const UI_NO = 'No';
export const UI_EDIT_SOURCE = 'Edit source';
export const UI_EDIT = 'Edit';
export const UI_DISABLE_SOURCE = 'Disable source';
export const UI_ENABLE_SOURCE = 'Enable source';
export const UI_DISABLE = 'Disable';
export const UI_ENABLE = 'Enable';
export const UI_DELETE_SOURCE = 'Delete source';
export const UI_DELETE = 'Delete';
export const UI_ADD_SOURCE = 'Add source';
export const UI_PACKAGE_SOURCE_MAPPINGS = 'Package Source Mappings';
export const UI_PATTERN = 'pattern';
export const UI_PATTERNS = 'patterns';
export const UI_REMOVE_PATTERN = 'Remove pattern';
export const UI_ADD_PATTERN = 'Add pattern';
export const UI_SAVE = 'Save';
export const UI_CANCEL = 'Cancel';
export const UI_LOADING = 'Loading nuget.config...';
export const UI_UNKNOWN_ERROR = 'Unknown error';
export const UI_SAVE_FAILED_PREFIX = 'Save failed: ';

// ========== Validation Messages ==========
export const VALIDATION_EMPTY_KEY = 'Source key is empty';
export const VALIDATION_DUPLICATE_KEY = (key: string) => `Duplicate source key '${key}'`;
export const VALIDATION_INVALID_URL = (key: string) => `Invalid URL for source '${key}'`;
export const VALIDATION_DUPLICATE_PATTERN = (pattern: string, sourceKey: string) => `Duplicate pattern '${pattern}' for source '${sourceKey}'`;
