# NuGet Config Visual Editor (nuget-config-editor)

A Visual Studio Code extension that provides a friendly visual editor for working with NuGet's `nuget.config` files.

This extension lets you view and manage package sources and package source mappings using a table-based GUI instead of editing XML by hand. It focuses on clarity, accessibility, and preserving configuration intent when saving changes.

<img width="1606" height="1035" alt="image" src="https://github.com/user-attachments/assets/c49203bb-ae27-4626-885f-a47fe98ecadb" />

## Key features

- Visual, table-based editor for `nuget.config` package sources: add, edit, remove, enable/disable sources.
- Mappings panel: manage package source mappings (pattern-based mappings) with add/remove and validation support.
- Preserve unknown XML sections where possible and validate values before saving.
- Theme-aware UI and accessibility support (ARIA labels, keyboard navigation).
- Integrated file picker for workspaces with multiple `nuget.config` files.

## Getting started

1. Install the extension from the VS Code Marketplace or load it from this repository in Extension Development Host.
2. Open a folder or workspace containing a `nuget.config` file.
3. Right-click a `nuget.config` file in the Explorer and choose "Open With..." → "NuGet Config Visual Editor", or open the command palette (Ctrl+Shift+P) and run "NuGet Config: Open Visual Editor".
4. Use the table to add, edit, enable/disable, or remove package sources. Switch to the Mappings panel to manage source mappings.

## Settings

The extension contributes the following settings (available in Settings UI):

- `nugetConfigEditor.logLevel` (string) — Log level for the extension output (e.g. `info`, `debug`, `error`).
- `nugetConfigEditor.preferVisualEditor` (boolean) — When true, open `nuget.config` files in the visual editor by default.
- `nugetConfigEditor.preserveUnknownXml` (boolean) — Attempt to preserve unknown XML nodes/sections when saving changes.

## Usage tips

- Changes are saved back to the `nuget.config` XML file; review diffs in source control if you want to inspect XML edits.
- If your workspace contains several `nuget.config` files, use the file picker to choose which config to edit.
- Some advanced or custom XML nodes may not round-trip perfectly; enable `preserveUnknownXml` to reduce loss of unknown content.

## Known limitations

- Comment preservation in XML is best-effort — some comments or formatting may change when saving.
- Very large or heavily customized `nuget.config` files may show limited round-trip fidelity for uncommon XML structures.

### VS Code Git diff viewing

Because this is a custom editor, if it is set as default, when viewing a diff it will render both editor views and you won't be able to see the actual diff.  You'll want to switch to the Text Editor to see it.  This is a known limitation of the VS Code custom editor extensbility points [microsoft/vscode#138525](https://github.com/microsoft/vscode/issues/138525) right now.

Because of this I recommend having this setting in your workspace or user settings:

```json
"workbench.editorAssociations": {
   "{git}:/**/nuget.config": "default",
   "nuget.config": "timheuer.nuget-config-editor"
}
```

## Contributing

If you'd like to contribute, please open issues or pull requests in this repository. Keep change sets focused and include tests where appropriate.

## License

See the repository license for details.
