# NuGet Config Editor - AI Developer Guide

## Project Overview

This VS Code extension provides a visual editor for `nuget.config` XML files using a custom editor provider pattern with webview-based UI.

You MUST always make the most minimal edit possible focused on the change.

## Architecture

- **Extension Host** (`src/extension.ts`): Main activation, command registration, logging setup
- **Custom Editor Provider** (`src/customEditor/`): VS Code custom editor implementation with webview communication
- **Services Layer** (`src/services/`): Core business logic separated into focused services
- **Webview UI** (`src/webview/main.ts`): Browser-based table editor (bundled separately by esbuild)
- **Tree Provider** (`src/tree/`): Explorer panel showing workspace nuget.config files

## Key Patterns

### Message-Based Communication

The extension uses strongly-typed message passing between host and webview:

```typescript
// Host → Webview: 'init', 'validation', 'saveResult'
// Webview → Host: 'edit', 'requestSave', 'requestDelete'
```

All messages defined in `src/model/messages.ts` with discriminated unions.

### Immutable Edit Operations

Changes flow through `applyEditOps()` using operation objects:

```typescript
{ kind: 'addSource', key: string, url: string }
{ kind: 'updateSource', key: string, newKey?: string, url?: string }
{ kind: 'deleteSource', key: string }
```

Always returns new ConfigModel instances - never mutates existing state.

### XML Preservation Strategy

`nugetConfigService.ts` implements "unknown XML preservation" - attempts to merge changes back into original XML structure to preserve comments/formatting when `preserveUnknownXml` setting is true.

### Dual Build System

- **Extension**: Node.js bundle (`dist/extension.js`) for VS Code host process
- **Webview**: Browser bundle (`dist/webview/main.js`) with codicons copied for VSIX packaging
- Use `npm run watch` to build both in parallel during development

## Development Workflow

### Building & Testing

```bash
npm run watch          # Start dual-bundle watch mode
npm run test          # Run unit tests (extension host tests)
npm run package       # Production build for VSIX
```

### Key Extension Points

- **Custom Editor**: `vscode.window.registerCustomEditorProvider()` with `supportsMultipleEditorsPerDocument: false`
- **Tree View**: `vscode.window.registerTreeDataProvider()` for Explorer integration
- **WorkspaceEdit**: Changes persist via `vscode.workspace.applyEdit()` for proper undo/redo support

## Validation & Error Handling

Validation runs after every edit operation:

- **Error-level issues**: Block saves, show red validation messages
- **Warning-level issues**: Allow saves, show yellow indicators
- Validation logic in `validationService.ts` - URL regex, duplicate key detection

## Testing Patterns

- Unit tests focus on pure functions (`editOps.test.ts`, `parsing.test.ts`)
- Use VS Code test framework (`@vscode/test-electron`) for integration tests
- Mock external dependencies, test message flows and state transitions

## Configuration System

Three key settings affect behavior:

- `preferVisualEditor`: Auto-open nuget.config files in visual editor
- `preserveUnknownXml`: Attempt to preserve original XML structure
- `logLevel`: Extension logging verbosity (uses `@timheuer/vscode-ext-logger`)

## XML Parsing Nuances

Handles multiple NuGet configuration schema variants:

- `<packageSources><add key="..." value="..."/></packageSources>`
- `<disabledPackageSources><add key="..." value="true"/></disabledPackageSources>`
- `<packageSourceMapping><packageSource key="..."><package pattern="..."/></packageSource></packageSourceMapping>`

When adding XML parsing features, check both schema variants in `parseNugetConfig()`.
