import * as vscode from 'vscode';
import { parseNugetConfig, writeModelToUri, serializeModel } from '../services/nugetConfigService';
import { validate } from '../services/validationService';
import { ConfigModel } from '../model/types';
import { applyEditOps } from '../services/editOps';
import { EditOp } from '../model/messages';
import { Logger } from '@timheuer/vscode-ext-logger';
import { CUSTOM_EDITOR_VIEW_TYPE, MSG_OPENING_EDITOR, MSG_CANNOT_SAVE_VALIDATION_ERRORS, MSG_DELETE_SOURCE_CONFIRM, MSG_DELETE_BUTTON, MSG_APPLIED_EDIT, MSG_APPLIED_DELETE, SETTING_PRESERVE_UNKNOWN_XML } from '../constants';

export class NugetConfigCustomEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = CUSTOM_EDITOR_VIEW_TYPE;
    private static panels = new Map<vscode.WebviewPanel, vscode.Uri>();

    constructor(private readonly context: vscode.ExtensionContext, private readonly log: Logger) {}

    /**
     * Check if a URI is within the workspace.
     * Files outside the workspace (like global nuget.config) need different handling.
     */
    private isFileInWorkspace(uri: vscode.Uri): boolean {
        // Use VS Code's built-in method which handles platform differences correctly
        return vscode.workspace.getWorkspaceFolder(uri) !== undefined;
    }

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.log.info(MSG_OPENING_EDITOR);
    // Allow loading codicons assets (fonts) from the bundled dist/webview folder so they are available in the VSIX
    webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
        ]
    };
    NugetConfigCustomEditorProvider.panels.set(webviewPanel, document.uri);
        webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

        const cfg = vscode.workspace.getConfiguration('nugetConfigEditor');
        const preserveUnknown = cfg.get<boolean>('preserveUnknownXml', true);

        let model: ConfigModel | undefined;
        const load = () => {
            try {
                model = parseNugetConfig(document.getText(), preserveUnknown, document.uri.fsPath, this.log);
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
                        vscode.window.showErrorMessage(MSG_CANNOT_SAVE_VALIDATION_ERRORS);
                        return;
                    }
                    try {
                        await writeModelToUri(document.uri, model, preserveUnknown);
                        webviewPanel.webview.postMessage({ type: 'saveResult', ok: true });
                        this.log.info('nuget.config saved successfully');
                    } catch (err) {
                        this.log.error('Save failed', { error: String(err) });
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
                        const isInWorkspace = this.isFileInWorkspace(document.uri);
                        
                        if (isInWorkspace) {
                            // For workspace files: use WorkspaceEdit so Undo/Redo and editor dirty state behave natively
                            const newText = serializeModel(model, preserveUnknown, '\n');
                            const edit = new vscode.WorkspaceEdit();
                            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                            edit.replace(document.uri, fullRange, newText);
                            const applied = await vscode.workspace.applyEdit(edit);
                            if (applied) {
                                webviewPanel.webview.postMessage({ type: 'saveResult', ok: true, message: MSG_APPLIED_EDIT});
                                this.log.debug('Applied WorkspaceEdit to nuget.config (awaiting user save)');
                            } else {
                                this.log.error('workspace.applyEdit returned false');
                                throw new Error('workspace.applyEdit returned false');
                            }
                        } else {
                            // For files outside workspace (e.g., global nuget.config): write directly to file
                            await writeModelToUri(document.uri, model, preserveUnknown);
                            webviewPanel.webview.postMessage({ type: 'saveResult', ok: true, message: MSG_APPLIED_EDIT});
                            this.log.debug('Wrote changes directly to file outside workspace');
                        }
                    } catch (err) {
                        this.log.error('Persist failed', { error: String(err) });
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
                        MSG_DELETE_SOURCE_CONFIRM(key),
                        { modal: true },
                        MSG_DELETE_BUTTON
                    );
                    if (choice !== MSG_DELETE_BUTTON) { return; }
                    try {
                        const ops: EditOp[] = [{ kind: 'deleteSource', key } as any];
                        model = applyEditOps(model, ops);
                        const issues = validate(model);
                        webviewPanel.webview.postMessage({ type: 'validation', issues });
                        if (issues.some(i => i.level === 'error')) {
                            webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
                            break;
                        }
                        
                        const isInWorkspace = this.isFileInWorkspace(document.uri);
                        
                        if (isInWorkspace) {
                            // For workspace files: use WorkspaceEdit
                            const newText = serializeModel(model, preserveUnknown, '\n');
                            const edit = new vscode.WorkspaceEdit();
                            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
                            edit.replace(document.uri, fullRange, newText);
                            const applied = await vscode.workspace.applyEdit(edit);
                            if (applied) {
                                webviewPanel.webview.postMessage({ type: 'saveResult', ok: true, message: MSG_APPLIED_DELETE});
                                this.log.debug(`Deleted source ${key} via WorkspaceEdit`);
                            } else {
                                this.log.error('workspace.applyEdit returned false');
                                throw new Error('workspace.applyEdit returned false');
                            }
                        } else {
                            // For files outside workspace: write directly to file
                            await writeModelToUri(document.uri, model, preserveUnknown);
                            webviewPanel.webview.postMessage({ type: 'saveResult', ok: true, message: MSG_APPLIED_DELETE});
                            this.log.debug(`Deleted source ${key} by writing directly to file outside workspace`);
                        }
                        
                        webviewPanel.webview.postMessage({ type: 'init', model, settings: { preserveUnknown } });
                    } catch (err) {
                        this.log.error('Delete failed', { error: String(err) });
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
    // Use the copied codicon.css from the extension's dist/webview so the font asset is packaged in the VSIX
    const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'codicon.css'));
    // Allow styles and fonts from the webview source so codicons CSS and its fonts can load
    const csp = `default-src 'none'; script-src 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource}; font-src ${webview.cspSource};`;
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>NuGet Config Editor</title>
<link rel="stylesheet" href="${codiconUri}" />
</head>
<body>
<script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

export function registerNugetConfigCustomEditor(context: vscode.ExtensionContext, logger: Logger) {
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            NugetConfigCustomEditorProvider.viewType,
            new NugetConfigCustomEditorProvider(context, logger),
            { supportsMultipleEditorsPerDocument: false }
        )
    );
}

export function broadcastToVisualEditors(message: any) {
    for (const panel of (NugetConfigCustomEditorProvider as any).panels.keys()) {
        panel.webview.postMessage(message);
    }
}

export function sendToVisualEditor(uri: vscode.Uri, message: any): boolean {
    for (const [panel, docUri] of (NugetConfigCustomEditorProvider as any).panels as Map<vscode.WebviewPanel, vscode.Uri>) {
        if (docUri.toString() === uri.toString()) {
            panel.webview.postMessage(message);
            return true;
        }
    }
    return false;
}

