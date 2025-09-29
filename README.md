# NuGet Config Visual Editor (nuget-config-editor)

A Visual Studio Code extension that provides a friendly visual editor for working with NuGet's `nuget.config` files.

This extension lets you view and manage package sources and package source mappings using a table-based GUI instead of editing XML by hand. It focuses on clarity, accessibility, and preserving configuration intent when saving changes.

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

---

If you'd like the README tailored further (shorter/longer, add screenshots or commands), tell me what to include and I will update it.
# nuget-config-editor README

This is the README for your extension "nuget-config-editor". After writing up a brief description, we recommend including the following sections.


## Features

- **Visual Editor for nuget.config**: Add, edit, delete, enable/disable package sources in a table view.
- **Mappings Panel**: Manage package source mappings per source, with add/remove pattern support and validation.
- **Codicon-based UI**: All action buttons use [VS Code codicon icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html) for a native look and feel.
- **Theme & Accessibility**: UI colors and backgrounds follow VS Code theme variables. All buttons have ARIA labels and keyboard navigation is supported.

![Mappings Panel Example](images/mappings-panel-example.png)

> Tip: The extension is designed for accessibility and keyboard navigation. All actions are available via buttons with ARIA labels, and the UI adapts to light/dark themes.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.


## Extension Settings

This extension contributes the following settings:

- `nugetConfigEditor.logLevel`: Log level for NuGet Config Editor logging output.
- `nugetConfigEditor.preferVisualEditor`: Prefer opening nuget.config files in the visual editor by default.
- `nugetConfigEditor.preserveUnknownXml`: Preserve unknown XML nodes and sections when saving nuget.config.


## Known Issues

- Comment preservation is best-effort; some formatting or comments may be lost on save.
- Only one nuget.config per workspace root is common; multiple are supported via file picker.


## Release Notes

### 0.0.1

- Initial release: Visual editor for nuget.config, mappings panel, codicon-based UI, theme and accessibility compliance.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
