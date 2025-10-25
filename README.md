# NuGet Config Editor ✨

A Visual Studio Code extension that gives you a friendly, table-based editor for NuGet `nuget.config` files — no more fiddling with XML by hand! 🚀

Edit package sources and package source mappings with a clear, accessible UI while preserving the intent of your original configuration when possible.

<img alt="NuGet Config Editor screenshot" src="https://github.com/user-attachments/assets/93f93c73-5a5c-4a19-bbba-90294e81d872" />



## Key features

- 🧾 Visual, table-based editor for `nuget.config` package sources: add, edit, remove, enable/disable sources.
- 🔁 Mappings panel: manage package source mappings (pattern-based mappings) with add/remove and validation support.
- 🛡️ Preserve unknown XML sections where possible and validate values before saving.
- 🎨 Theme-aware UI and accessibility support (ARIA labels, keyboard navigation).
- 📁 Integrated file picker for workspaces with multiple `nuget.config` files.

## Getting started

1. Install the extension from the VS Code Marketplace or load it from this repository in Extension Development Host.
2. Open a folder or workspace containing a `nuget.config` file.
3. Right-click a `nuget.config` file in the Explorer and choose "Open With..." → "NuGet Config Editor", or open the command palette (Ctrl+Shift+P) and run the command titled "NuGet: Open nuget.config editor".
4. Use the table to add, edit, enable/disable, or remove package sources. Switch to the Mappings panel to manage source mappings. 🎉

## Settings

The extension contributes the following settings (available in Settings UI):

- `nugetConfigEditor.logLevel` (string) — Log level for the extension output (e.g. `info`, `debug`, `error`).
- `nugetConfigEditor.preferVisualEditor` (boolean) — When true, open `nuget.config` files in the visual editor by default.
- `nugetConfigEditor.preserveUnknownXml` (boolean) — Attempt to preserve unknown XML nodes/sections when saving changes.


## Usage tips

- Changes are saved back to the `nuget.config` XML file; review diffs in source control if you want to inspect XML edits.
- If your workspace contains several `nuget.config` files, use the file picker to choose which config to edit.
- Some advanced or custom XML nodes may not round-trip perfectly; enable `preserveUnknownXml` to reduce loss of unknown content.

Tip: if a config doesn't round-trip perfectly, enable `nugetConfigEditor.preserveUnknownXml` to help keep unknown nodes/comments where possible.

## Known limitations

- Comment preservation in XML is best-effort — some comments or formatting may change when saving.
- Very large or heavily customized `nuget.config` files may show limited round-trip fidelity for uncommon XML structures.


### VS Code Git diff viewing ⚠️

Because this is a custom editor, if it is set as the default editor VS Code will render both editor views when showing file diffs, and you won't see the raw text diff. Switch to the Text Editor to view raw diffs. This is a known limitation of VS Code custom editor extensibility points: [microsoft/vscode#138525](https://github.com/microsoft/vscode/issues/138525).

Recommendation (add to workspace or user settings):

```json
"workbench.editorAssociations": {
   "{git}:/**/nuget.config": "default",
   "nuget.config": "nugetConfigEditor.visualEditor"
}
```

## Contributing

If you'd like to contribute, please open issues or pull requests in this repository. Keep change sets focused and include tests where appropriate.

Love this project? Contributions, issues, and PRs are very welcome — thanks! ❤️

When developing locally, the repository provides watch/build scripts (see `package.json`).

Development quick-start:

```powershell
# build webview and extension for development (watch mode)
npm run watch

# run tests
npm run test

# create a packaged VSIX (production build)
npm run package
```

## License

See the repository license for details.
