import * as vscode from 'vscode';
import { parseNugetConfig } from '../services/nugetConfigService';

interface NodeData { uri: vscode.Uri; label: string; description?: string }

export class NugetConfigTreeProvider implements vscode.TreeDataProvider<NodeData> {
    private _onDidChangeTreeData = new vscode.EventEmitter<NodeData | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    refresh(): void { this._onDidChangeTreeData.fire(); }

    getTreeItem(element: NodeData): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.resourceUri = element.uri;
        item.description = element.description;
        item.command = {
            command: 'nuget-config-editor.openVisualEditor',
            title: 'Open Visual Editor',
            arguments: [element.uri]
        };
        return item;
    }

    async getChildren(_element?: NodeData): Promise<NodeData[]> {
        const files = await vscode.workspace.findFiles('**/nuget.config', '**/node_modules/**', 50);
        const nodes: NodeData[] = [];
        for (const f of files) {
            try {
                const text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(f));
                const model = parseNugetConfig(text, false);
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description: `${model.sources.length} sources` });
            } catch {
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description: 'parse error' });
            }
        }
        return nodes;
    }
}

export function registerNugetConfigTree(context: vscode.ExtensionContext) {
    const provider = new NugetConfigTreeProvider(context);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('nugetConfigEditor.configs', provider),
        vscode.commands.registerCommand('nuget-config-editor.refreshConfigTree', () => provider.refresh())
    );
}
