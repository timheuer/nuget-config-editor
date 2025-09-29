import * as vscode from 'vscode';
import { parseNugetConfig, writeModelToUri, serializeModel } from '../services/nugetConfigService';
import { validate } from '../services/validationService';
import { ConfigModel } from '../model/types';
import { getLog } from '../logging/logger';
import { applyEditOps } from '../services/editOps';
import { EditOp } from '../model/messages';

export class NugetConfigCustomEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'nugetConfigEditor.visualEditor';
    private static panels = new Set<vscode.WebviewPanel>();

    constructor(private readonly context: vscode.ExtensionContext) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const log = getLog();
        log.info?.('Opening NuGet Config Editor');
    // Allow loading codicons assets (fonts) from node_modules and local script resources
    webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
        ]
    };
    NugetConfigCustomEditorProvider.panels.add(webviewPanel);
        webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

        const cfg = vscode.workspace.getConfiguration('nugetConfigEditor');
        const preserveUnknown = cfg.get<boolean>('preserveUnknownXml', true);

        let model: ConfigModel | undefined;
        const load = () => {
            try {
                model = parseNugetConfig(document.getText(), preserveUnknown);
                log.debug?.(`Parsed nuget.config sources=${model.sources.length} mappings=${model.mappings.length}`);
            } catch (err) {
                webviewPanel.webview.postMessage({ type: 'error', error: String(err) });
                return;
            }
        };
        load();

        const sendInit = () => {
            if (!model) { return; }
            webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
        };

        const disposables: vscode.Disposable[] = [];

        disposables.push(webviewPanel.webview.onDidReceiveMessage(async (msg: any) => {
            switch (msg?.type) {
                case 'ready':
                    sendInit();
                    break;
                case 'requestReparse':
                    load();
                    sendInit();
                    break;
                case 'requestSave':
                    if (!model) { return; }
                    const issues = validate(model);
                    if (issues.some(i => i.level === 'error')) {
                        webviewPanel.webview.postMessage({ type: 'validation', issues });
                        vscode.window.showErrorMessage('Cannot save nuget.config due to validation errors.');
                        return;
                    }
                    try {
                        await writeModelToUri(document.uri, model, preserveUnknown);
                        webviewPanel.webview.postMessage({ type: 'saveResult', ok: true });
                        log.info?.('nuget.config saved successfully');
                    } catch (err) {
                        log.error?.('Save failed', { error: String(err) });
                        webviewPanel.webview.postMessage({ type: 'saveResult', ok: false, error: String(err) });
                    }
                    break;
                case 'edit': {
                    if (!model) { return; }
                    const ops: EditOp[] = Array.isArray(msg.ops) ? msg.ops : [];
                    model = applyEditOps(model, ops);
                    const issues = validate(model);
                    // Always send validation results back to the webview
                    webviewPanel.webview.postMessage({ type: 'validation', issues });
                    // If there are errors, don't write; just send the updated model for display
                    if (issues.some(i => i.level === 'error')) {
                        webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
                        break;
                    }
                    try {
                        // Persist changes via WorkspaceEdit so Undo/Redo and editor dirty state behave natively
                        const newText = serializeModel(model, preserveUnknown, '\n');
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                        edit.replace(document.uri, fullRange, newText);
                        const applied = await vscode.workspace.applyEdit(edit);
                        if (applied) {
                            webviewPanel.webview.postMessage({ type: 'saveResult', ok: true, message: 'Applied edit to document (unsaved)'});
                            getLog().debug?.('Applied WorkspaceEdit to nuget.config (awaiting user save)');
                        } else {
                            getLog().error?.('workspace.applyEdit returned false');
                            throw new Error('workspace.applyEdit returned false');
                        }
                    } catch (err) {
                        getLog().error?.('Persist via WorkspaceEdit failed', { error: String(err) });
                        webviewPanel.webview.postMessage({ type: 'saveResult', ok: false, error: String(err) });
                    }
                    // Send refreshed model back to the webview
                    webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
                    break; }
                case 'requestDelete': {
                    if (!model) { return; }
                    const key = msg.key as string | undefined;
                    if (!key) { return; }
                    // Ask the user via a native modal before deleting
                    const choice = await vscode.window.showWarningMessage(
                        `Delete source '${key}'? This cannot be undone.`,
                        { modal: true },
                        'Delete'
                    );
                    if (choice !== 'Delete') { return; }
                    try {
                        const ops: EditOp[] = [{ kind: 'deleteSource', key } as any];
                        model = applyEditOps(model, ops);
                        const issues = validate(model);
                        webviewPanel.webview.postMessage({ type: 'validation', issues });
                        if (issues.some(i => i.level === 'error')) {
                            webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
                            break;
                        }
                        const newText = serializeModel(model, preserveUnknown, '\n');
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                        edit.replace(document.uri, fullRange, newText);
                        const applied = await vscode.workspace.applyEdit(edit);
                        if (applied) {
                            webviewPanel.webview.postMessage({ type: 'saveResult', ok: true, message: 'Applied delete to document (unsaved)'});
                            getLog().debug?.(`Deleted source ${key} via WorkspaceEdit`);
                        } else {
                            getLog().error?.('workspace.applyEdit returned false');
                            throw new Error('workspace.applyEdit returned false');
                        }
                        webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
                    } catch (err) {
                        getLog().error?.('Delete failed', { error: String(err) });
                        webviewPanel.webview.postMessage({ type: 'saveResult', ok: false, error: String(err) });
                    }
                    break; }
            }
        }));

        // Document change listener (external edits)
        disposables.push(vscode.workspace.onDidChangeTextDocument(ev => {
            if (ev.document.uri.toString() === document.uri.toString()) {
                load();
                sendInit();
            }
        }));

        webviewPanel.onDidDispose(() => {
            disposables.forEach(d => d.dispose());
            NugetConfigCustomEditorProvider.panels.delete(webviewPanel);
        });
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js'));
        const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));
        // Allow styles and fonts from the webview source so codicons CSS and its fonts can load
        const csp = `default-src 'none'; script-src 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource}; font-src ${webview.cspSource};`;
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>NuGet Config Visual Editor</title>
<link rel="stylesheet" href="${codiconUri}" />
</head>
<body>
<script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

export function registerNugetConfigCustomEditor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            NugetConfigCustomEditorProvider.viewType,
            new NugetConfigCustomEditorProvider(context),
            { supportsMultipleEditorsPerDocument: false }
        )
    );
}

export function broadcastToVisualEditors(message: any) {
    for (const panel of (NugetConfigCustomEditorProvider as any).panels as Set<vscode.WebviewPanel>) {
        panel.webview.postMessage(message);
    }
}

