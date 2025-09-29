# Feature Specification: NuGet Config Visual Editor

## Overview

Provide a visual, user-friendly editor inside VS Code for managing `nuget.config` files: viewing, adding, editing, disabling/enabling package sources, and managing package source mappings. It replaces (or supplements) raw XML editing with a structured UI to reduce user error and speed up feed configuration.

## User Journey

1. User opens (or creates) a `nuget.config` file in the workspace.
2. Extension offers (or automatically opens, per setting) the "NuGet Config Visual Editor" custom view instead of plain XML.
3. The editor loads and displays: list of package sources (name, URL, enabled status), disabled sources, and package source mappings.
4. User performs actions (add / edit / delete source, toggle enable/disable, manage mappings, save changes).
5. Validation runs; errors are shown inline (e.g., duplicate key, invalid URL). User resolves any issues.
6. User saves; file is rewritten with updated XML. VS Code shows success notification (or errors if write fails).
7. (Optional) User re-opens file or switches to text view; changes are reflected.

## Functional Requirements

1. **FR-01: Activate on nuget.config Presence**
   - **Description**: The extension activates when a file named `nuget.config` (case-insensitive) is opened or exists in the workspace.
   - **Acceptance Criteria**:
     - [ ] Opening `nuget.config` after install activates the extension (verified via logs / commands available).
     - [ ] No activation for unrelated XML files.

2. **FR-02: Custom Editor Registration**
   - **Description**: Provide a custom (webview-based) editor for `nuget.config` files, selectable via "Reopen With…" and defaultable via user setting.
   - **Acceptance Criteria**:
     - [ ] Custom editor appears in "Reopen With" list as "NuGet Config Visual Editor".
     - [ ] Opening `nuget.config` can auto-use custom editor if the user sets a setting (e.g., `nugetConfigEditor.preferVisualEditor = true`).

3. **FR-03: XML Parsing to Internal Model**
   - **Description**: Parse existing `nuget.config` (XML) into an internal strongly-typed model (package sources, disabled sources, mappings) with graceful handling of missing sections.
   - **Acceptance Criteria**:
     - [ ] Valid XML yields model with correct counts for sources, disabled sources, mappings.
     - [ ] Missing `<packageSources>` creates empty list without error.
     - [ ] Malformed XML triggers error UI with retry option (no crash).

4. **FR-04: Display Sources & Status**
   - **Description**: Show a table/grid of package sources (Name/Key, URL, Enabled/Disabled state, actions: edit, delete, toggle, view mappings count).
   - **Acceptance Criteria**:
     - [ ] All sources present in `<packageSources>` are rendered.
     - [ ] Disabled sources indicated via state derived from `<disabledPackageSources>`.
     - [ ] Sorting by Name supported (optional initial ascending default).

5. **FR-05: Add / Edit Package Source**
   - **Description**: Provide form to add a new source or modify existing name/key & URL with validation (unique key, non-empty, URL-like format).
   - **Acceptance Criteria**:
     - [ ] Adding source updates in-memory model instantly.
     - [ ] Duplicate key shows validation error and blocks save/apply.
     - [ ] Editing existing source updates model and UI without reload.

6. **FR-06: Delete Package Source**
   - **Description**: Allow removal of a source with confirmation dialog.
   - **Acceptance Criteria**:
     - [ ] Deleting removes source and any related disabled or mapping entries.
     - [ ] User must confirm (Yes/No) before final removal.

7. **FR-07: Enable / Disable Source**
   - **Description**: Toggle a source's enabled state; reflects in `<disabledPackageSources>` section by adding or removing corresponding entry.
   - **Acceptance Criteria**:
     - [ ] Toggling on an enabled source adds an entry under `<disabledPackageSources>`.
     - [ ] Re-enabling removes its disabled entry.
     - [ ] UI reflects state change immediately.

8. **FR-08: Manage Package Source Mappings**
   - **Description**: View and edit package source mappings: patterns associated with each source under `<packageSourceMapping>`.
   - **Acceptance Criteria**:
     - [ ] Mappings displayed per source with pattern list.
     - [ ] Add/remove pattern operations update model.
     - [ ] Duplicate identical pattern under a source is prevented.

9. **FR-09: Persist Changes to XML**
   - **Description**: Serialize the internal model back to valid `nuget.config` XML on save, creating missing sections as needed.
   - **Acceptance Criteria**:
     - [ ] Saving writes syntactically valid XML consumed by `nuget restore`.
     - [ ] Sections not managed (unrelated existing config nodes) remain intact OR (MVP fallback) are preserved if easily mappable; if not, documented.
     - [ ] File save triggers no VS Code diagnostics for XML well-formedness.

10. **FR-10: Validation & Diagnostics**
    - **Description**: Provide inline validation before save plus optional diagnostics collection.
    - **Acceptance Criteria**:
      - [ ] Duplicate keys, empty names, invalid URLs flagged.
      - [ ] Save blocked if critical validation errors remain.
      - [ ] User sees clear error messages.

11. **FR-11: Command Palette Commands**
    - **Description**: Expose helpful commands (`NuGet: Open nuget.config Visual Editor`, `NuGet: Add Package Source`).
    - **Acceptance Criteria**:
      - [ ] Commands searchable in Command Palette.
      - [ ] `Open Visual Editor` focuses current `nuget.config` or prompts to pick if multiple.

12. **FR-12: Status / Tree View (Optional MVP+)**
    - **Description**: A sidebar view listing discovered `nuget.config` files and counts of sources.
    - **Acceptance Criteria**:
      - [ ] View refreshes on file changes.
      - [ ] Clicking an item opens visual editor.

13. **FR-13: Undo / Redo (Session Only)**
    - **Description**: Support local undo/redo inside the webview (not necessarily integrated with VS Code global undo initially).
    - **Acceptance Criteria**:
      - [ ] Users can revert last add/edit/delete/mapping change.
      - [ ] Stack cleared on successful save or editor close.

14. **FR-14: Settings Support**
    - **Description**: Provide extension settings for default behaviors.
    - **Acceptance Criteria**:
      - [ ] `nugetConfigEditor.preferVisualEditor` (boolean) respected.
      - [ ] `nugetConfigEditor.preserveUnknownXml` (boolean) controlling serialization strategy.

15. **FR-15: Basic Telemetry Toggle (If Implemented)**
    - **Description**: (Optional) Count usage events (open editor, save) with user opt-out.
    - **Acceptance Criteria**:
      - [ ] No telemetry emitted when VS Code telemetry disabled.
      - [ ] Only non-PII aggregates collected.

16. **FR-16: Structured Logging**
    - **Description**: Provide consistent, structured, leveled logging using `@timheuer/vscode-ext-logger` for diagnostics (activation, parsing, validation, serialization, save operations, error handling) with redaction of possible secrets (URLs containing credentials, patterns that look like tokens).
    - **Acceptance Criteria**:
      - [ ] Logger initialized during activation with extension name & log level derived from a setting (e.g., `nugetConfigEditor.logLevel`).
      - [ ] Logs written to VS Code output channel and log file location (per library behavior).
      - [ ] Errors include contextual metadata (operation, file path, source key) without leaking secrets.
      - [ ] Debug-level logs can be enabled without code changes (setting-based).
      - [ ] Webview -> host important actions (save request, edit batch) logged at trace/debug.

## Non-Functional Requirements

- Performance: Initial parse & render under 200ms for typical configs (<200 sources, <500 mappings).
- Robustness: Malformed XML shows recoverable error UI; user can open raw text editor.
- Security: Never display or log API keys/passwords if present in comments or values. No outbound network calls.
- Accessibility: Keyboard navigation for all actions; proper ARIA roles and labels in the webview.
- Localization-ready: All user strings centralized for future translation.
- Reliability: No data loss—save only occurs via explicit user action; unsaved changes prompt before closing.

## Out of Scope (Initial Release)

- Credential management or secure storage of tokens.
- Merging multi-level NuGet config hierarchy (user/global/machine). Only the opened file.
- Comment preservation beyond best-effort (may lose formatting or some comments in MVP if complex to keep).
- Schema validation beyond essential structural + basic field validation.
- Advanced diff/merge conflict resolution.

## Assumptions

- Only one `nuget.config` per workspace root is common; multiple are edge cases but supported via file picker.
- Users prefer visual editing but may still need raw XML fallback.
- XML library chosen can round-trip attribute ordering (if not, ordering changes are acceptable for MVP).

## Open Questions (Tracked for Later Clarification)

- Should we support environment variable expansion preview? (Future)
- Provide quick test of feed reachability? (Would require network calls—deferred.)
- Preserve original XML indentation exactly? (Deferred; consistent formatting acceptable.)

---
Feedback welcome. Once approved, an Implementation Plan section will be appended covering architecture, data model, parsing/serialization strategy, UI structure, and step-by-step development tasks.

---

## Implementation Plan: NuGet Config Visual Editor

## Architecture Overview

Layers:

- Extension Host (Node/TypeScript)
  - Activation & custom editor registration (`NugetConfigCustomEditorProvider`).
  - File parsing & serialization service (`NugetConfigService`).
  - Model validation service (`ValidationService`).
  - Optional tree view provider (MVP+).
  - Settings access + telemetry (guarded by user opt-out & VS Code telemetry setting).

- Webview (Browser context)
  - UI built with `@vscode-elements/elements-lite` (lightweight web components) + `@vscode/codicons` for iconography to match VS Code feel.
  - State store (simple observable pattern) holding `ConfigModel` (sources, disabled map, mappings, dirty flag, undo stack).
  - Component set: SourcesTable, SourceFormDialog, MappingsPanel, ValidationBanner, Toolbar.

- Messaging Bridge
  - PostMessage channel for: `loadModel`, `applyEdits`, `requestSave`, `saveResult`, `showError`, `settingsChanged`.

- Utilities
  - XML parse/serialize adapter (e.g., `fast-xml-parser` or custom minimal wrapper) with optional preservation of unknown nodes.
  - Diff generator (optional) for diagnostics / undo granularity.

Data Flow:
`nuget.config` file -> Extension Host parses -> Model JSON -> Sent to Webview -> User Edits -> Incremental edit messages -> Host validates & (optionally) echoes normalized model -> On Save request -> Host serializes -> Writes file -> Success/failure message -> Webview resets dirty & undo stacks.

## Data Model (TypeScript Interfaces)

```ts
interface PackageSource { key: string; url: string; enabled: boolean; } // enabled derived; stored as absence in disabled section
interface PackageSourceMapping { sourceKey: string; patterns: string[]; }
interface ConfigModel {
  sources: PackageSource[]; // unique by key
  mappings: PackageSourceMapping[]; // zero or one per sourceKey (list of patterns)
  rawUnknown?: string; // serialized fragment for unhandled nodes if preserveUnknownXml
  versionInfo?: { originalIndent?: string; }; // formatting hints (optional)
}
interface ValidationIssue { level: 'error' | 'warn'; code: string; message: string; path: string; }
```

## Key Technical Decisions

- **UI Framework**: Use `@vscode-elements/elements-lite` to avoid heavy frameworks (no React overhead) and maintain native styling; leverage VS Code theming via CSS variables.
- **Icons**: Import `@vscode/codicons/dist/codicon.css` and use `<span class="codicon codicon-add"></span>` style markup.
- **Undo/Redo**: Maintain stack of shallow-cloned `ConfigModel` snapshots or apply reversible operations; cap length (e.g., 50) for memory.
- **Validation**: Pure functions run on each edit (debounced 150ms). Critical errors block save; warnings do not.
- **Unknown XML Preservation**: If setting enabled, store untouched segments (e.g., other top-level nodes) and re-inject at serialization time; else ignore.
- **Serialization Ordering**: Deterministic ordering: `<configuration>` -> `<packageSources>` -> `<disabledPackageSources>` -> `<packageSourceMapping>` -> (unknown preserved) to minimize diff noise.

## Messaging Contracts

```ts
// Host -> Webview
type HostToWebview =
  | { type: 'init'; model: ConfigModel; settings: SettingsSnapshot }
  | { type: 'validation'; issues: ValidationIssue[] }
  | { type: 'saveResult'; ok: true } 
  | { type: 'saveResult'; ok: false; error: string }
  | { type: 'error'; error: string };

// Webview -> Host
type WebviewToHost =
  | { type: 'ready' }
  | { type: 'edit'; ops: EditOp[] } // small granular ops (addSource, updateSource, deleteSource, toggleSource, setMappings)
  | { type: 'requestSave' }
  | { type: 'requestReparse' };
```

## Edit Operations (Examples)

```ts
type EditOp =
  | { kind: 'addSource'; key: string; url: string }
  | { kind: 'updateSource'; key: string; newKey?: string; url?: string }
  | { kind: 'deleteSource'; key: string }
  | { kind: 'toggleSource'; key: string; enabled: boolean }
  | { kind: 'setMappings'; key: string; patterns: string[] };
```

## Pseudocode Sketches

Parsing:

```ts
function parseNugetConfig(xml: string, preserveUnknown: boolean): ConfigModel {
  const doc = parseXml(xml); // library call
  const sources = extractPackageSources(doc);
  const disabled = extractDisabled(doc); // map key -> true
  const mappings = extractMappings(doc);
  // merge disabled into sources
  for (const s of sources) s.enabled = !disabled[s.key];
  const model: ConfigModel = { sources, mappings };
  if (preserveUnknown) model.rawUnknown = captureUnknownNodes(doc);
  return model;
}
```

Serialization:

```ts
function serializeModel(model: ConfigModel, preserveUnknown: boolean): string {
  const pkgSources = buildPackageSourcesNode(model.sources);
  const disabled = buildDisabledNode(model.sources.filter(s => !s.enabled));
  const mapping = buildMappingNode(model.mappings);
  const nodes = [pkgSources, disabled, mapping].filter(Boolean);
  if (preserveUnknown && model.rawUnknown) nodes.push(model.rawUnknown);
  return wrapInConfiguration(nodes);
}
```

Validation (example rule):

```ts
function validate(model: ConfigModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const s of model.sources) {
    if (!s.key.trim()) issues.push(err('EMPTY_KEY','Source key empty',`sources.${s.key||'<empty>'}`));
    if (seen.has(s.key)) issues.push(err('DUP_KEY','Duplicate key',`sources.${s.key}`)); else seen.add(s.key);
    if (!isValidUrl(s.url)) issues.push(err('BAD_URL','Invalid URL',`sources.${s.key}.url`));
  }
  // mapping patterns uniqueness per source
  for (const m of model.mappings) {
    const patternSet = new Set<string>();
    for (const p of m.patterns) {
      if (patternSet.has(p)) issues.push(err('DUP_PATTERN',`Duplicate pattern '${p}'`, `mappings.${m.sourceKey}`));
      patternSet.add(p);
    }
  }
  return issues;
}
```

Undo Operation:

```ts
function applyEdit(model: ConfigModel, op: EditOp): ConfigModel { /* returns new model */ }
```

## Implementation Steps (Mapped to FRs)

- [x] Step 1: Add Dependencies (FR-02, UI infra)
  - Objective: Introduce required NPM packages (`@vscode-elements/elements-lite`, `@vscode/codicons`, XML parser like `fast-xml-parser`).
  - Technical Approach: Update `package.json` dependencies; adjust build script to bundle webview entry `src/webview/main.ts`.
  - Pseudocode:
    
    ```json
    // package.json (snippet)
    "dependencies": { "fast-xml-parser": "^x.y.z", "@vscode-elements/elements-lite": "^1.0.0", "@vscode/codicons": "^0.0.36" }
    ```
    
  - Manual Developer Action: Run install; verify esbuild includes webview code.

- [x] Step 1b: Add Structured Logger (FR-16)
  - Objective: Add and initialize `@timheuer/vscode-ext-logger`.
  - Technical Approach: Install dependency; create `src/logging/logger.ts` exporting a singleton accessor. Configure level from setting `nugetConfigEditor.logLevel` (default `info`). Provide redaction helper for potential secrets (simple regex for `://.*@` in URLs or token-like strings).
  - Pseudocode:
    
    ```ts
    // logger.ts
    import { createExtensionLogger, LogLevel } from '@timheuer/vscode-ext-logger';
    let logger: ReturnType<typeof createExtensionLogger> | undefined;
    export function initLogging(ctx: vscode.ExtensionContext, level: LogLevel) {
      logger = createExtensionLogger({ level, logPath: ctx.logUri.fsPath, name: 'nuget-config-editor' });
    }
    export const getLog = () => logger!;
    ```
    
  - Manual Developer Action: Confirm actual API surface of library (adjust names accordingly) and update if differences exist.

- [x] Step 2: Define Data & Message Types (FR-03, FR-04, FR-05..08, FR-13)
  - Objective: Create `src/model/types.ts` & `src/model/messages.ts`.
  - Technical Approach: Export interfaces & union types; ensure reused by host & webview.
  - Pseudocode: (as in Data Model section).
  - Manual Developer Action: None beyond file creation.

- [x] Step 3: Parsing & Serialization Service (FR-03, FR-09, FR-14)
  - Objective: Implement `NugetConfigService` with parse & serialize.
  - Technical Approach: Wrap XML lib; handle missing sections; unknown node capture.
  - Pseudocode: `parseNugetConfig`, `serializeModel` above.
  - Manual Developer Action: Add unit tests with sample XML fixtures.

- [x] Step 4: Validation Service (FR-10)
  - Objective: Provide rule-based validation function.
  - Technical Approach: Pure function; codes enumerated; easy extension.
  - Manual Developer Action: Add tests for edge cases (duplicate, invalid URL, empty key, duplicate pattern).

- [x] Step 5: Custom Editor Provider (FR-01, FR-02, FR-09)
  - Objective: Register custom editor for `nuget.config` (matching filename) & open webview.
  - Technical Approach: Implement `CustomTextEditorProvider`; on resolve, parse file and send `init` message.
  - Manual Developer Action: Add contribution to `package.json` (`contributes.customEditors`).
  - Logging: Log lifecycle: provider registered (info), editor opened (info), parse start/finish (debug), parse errors (error with sanitized snippet length), model size (#sources/#mappings at debug).

- [x] Step 6: Webview Scaffolding & Asset Loading (FR-02, FR-04)
  - Objective: Create `main.ts` that listens for messages & renders root component.
  - Technical Approach: Use DOM + web components from `@vscode-elements/elements-lite`; import codicons CSS.
  - Pseudocode:
    
    ```ts
    import '@vscode-elements/elements-lite/components/vscode-table.js';
    import '@vscode/codicons/dist/codicon.css';
    vscodeApi.postMessage({ type: 'ready' });
    window.addEventListener('message', e => { /* switch on e.data.type */ });
    ```
    
  - Manual Developer Action: Verify styling under dark/light themes.


  - [x] Step 7: Sources Table Component (FR-04, FR-05, FR-06, FR-07)
  - [x] Step 8: Add/Edit Source Dialog (FR-05)
  - [x] Step 9: Disable/Enable Logic & Delete Handling (FR-06, FR-07)
  - [x] Step 10: Mappings Panel (FR-08)
  - [ ] Step 11: Undo/Redo Mechanism (FR-13)
  - [x] Step 12: Save Workflow (FR-09, FR-10) (Basic path; advanced conflict handling pending)
  - [x] Step 13: Settings Integration (FR-14)
  - [x] Step 14: Commands & Contribution Points (FR-11)
  - [x] Step 15: Optional Tree View (FR-12)

- [ ] Step 16: Telemetry (FR-15 Optional)
  - Objective: Wrap in conditional; events: editorOpened, saveSuccess, validationErrorCount.

- [ ] Step 17: Testing & QA Pass (All FRs)
  - Objective: Unit tests (parsing, serialization, validation), integration smoke (open editor, edit, save).
  - Technical Approach: Use `@vscode/test-electron` to script UI flows partially or rely on model-level tests + manual for UI specifics.
  - Logging Tests: Verify logger init does not throw; simulate redaction helper on credential-like URL.

- [ ] Step 18: Documentation & README Update
  - Objective: Add usage instructions, limitations (comment preservation, unknown XML behavior setting).

- [ ] Step 19: Performance & Accessibility Pass (Non-Functional)
  - Objective: Audit keyboard traversal & ARIA labels; measure parse time with sample large config.

## Testing Strategy

Unit Tests:

- Parsing: handles missing sections, disabled sources, mappings.
- Serialization round-trip ensures equivalence (ignoring order/whitespace where acceptable).
- Validation rules per error code.
- Edit operations produce expected model transitions.

Integration (Automated / Semi):

- Open sample `nuget.config` -> ensure model loads (FR-03, FR-04).
- Add new source -> validate presence & no duplicate allowed.
- Toggle disable -> serialization includes `<disabledPackageSources>` entry.
- Add mapping pattern -> duplicates blocked.
- Save -> file updated; reopen -> state persists.

Manual Edge Cases:

- Malformed XML -> error UI with retry.
- External modification while editor open -> conflict handling path.
- Large list (100+ sources) scroll & performance.

## Edge Cases & Error Handling

- Blank file -> create minimal structure on first save.
- Source key rename that collides -> validation blocks.
- Patterns containing wildcard `*` vs literal: treat as opaque strings; no pattern parsing needed initially.
- Unicode characters in keys/URLs preserved.
- BOM or different newline styles maintained (normalize newline to file's detected style on write).

## Performance Considerations

- Avoid re-parsing full XML on every small edit; update model in memory; only serialize/parse on save or explicit reparse.
- Debounce validation (150ms) after bursts of edits.
- Lazy render mapping panel only when opened.

## Accessibility Considerations

- All actionable icons have `aria-label`.
- Table rows focusable; keyboard shortcuts for Add (Alt+A), Save (Ctrl+S forwarded), Undo (Ctrl+Z), Redo (Ctrl+Y / Ctrl+Shift+Z).

## Security / Privacy

- No secrets logged; redact if value looks like token (heuristic) in logs.
- Telemetry optional and aggregated only.

## Dependencies & Contribution Points (Planned)

- Dependencies: `fast-xml-parser`, `@vscode-elements/elements-lite`, `@vscode/codicons`.
- `contributes.customEditors`: custom editor selector by filename pattern `nuget.config`.
- `contributes.configuration`: expose settings.
- `contributes.commands`: open editor, add source.
- `views` (optional): explorer tree.

## Rollout / Incremental Delivery

1. Milestone A: Core parse/display/save (FR-01..05, 07, 09, 10 minimal, 14) behind custom editor.
2. Milestone B: Mappings & delete & validation completeness (FR-06, 08, 10 full).
3. Milestone C: Undo/Redo + commands (FR-11, FR-13).
4. Milestone D: Tree View + telemetry optional (FR-12, FR-15).
5. Milestone E: Perf & accessibility polish, docs.

## Risks & Mitigations

- Comment Loss: Document limitation; add setting later if needed.
- XML Parser Differences: Write tests with real-world configs to ensure compatibility.
- Large File Performance: Use streaming parse only if needed; fallback acceptable for MVP.

## Quality Checklist Mapping

- [ ] All FRs implemented & tested (Unit + Integration list above)
- [ ] Dependencies pinned & minimal
- [ ] Validation covers duplicates, empties, URLs, mapping duplicates
- [ ] Save conflict scenario handled
- [ ] Accessibility roles & keyboard navigation verified
- [ ] Performance target (<200ms typical parse) measured
- [ ] Security/telemetry compliance reviewed
- [ ] Logging redaction verified (no raw credentials in logs)

---
End of Implementation Plan. Proceed next with dependency addition & scaffolding (Step 1) when ready.
