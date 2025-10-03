import * as vscode from 'vscode';
import { parseNugetConfig } from '../services/nugetConfigService';
import { NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, SETTING_SHOW_GLOBAL } from '../constants';
import { findGlobalNugetConfig } from '../services/globalConfigLocator';
import { Logger } from '@timheuer/vscode-ext-logger';

interface NodeData { uri: vscode.Uri; label: string; description?: string }

export class NugetConfigTreeProvider implements vscode.TreeDataProvider<NodeData> {
    private _onDidChangeTreeData = new vscode.EventEmitter<NodeData | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly context: vscode.ExtensionContext, private readonly log: Logger) {
        // Watch for nuget.config file changes and refresh the tree
        const watcher = vscode.workspace.createFileSystemWatcher('**/[Nn][Uu][Gg][Ee][Tt].[Cc][Oo][Nn][Ff][Ii][Gg]');
        watcher.onDidCreate((uri) => {
            // Exclude common build/dependency folders from triggering refresh
            if (!this.isExcludedPath(uri.fsPath)) {
                this.refresh();
            }
        });
        watcher.onDidDelete((uri) => {
            if (!this.isExcludedPath(uri.fsPath)) {
                this.refresh();
            }
        });
        watcher.onDidChange((uri) => {
            if (!this.isExcludedPath(uri.fsPath)) {
                this.refresh();
            }
        });
        context.subscriptions.push(watcher);

        // React to configuration changes for showing global config
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SETTING_SHOW_GLOBAL)) {
                this.refresh();
            }
        }));
    }

    private isExcludedPath(fsPath: string): boolean {
        const normalizedPath = fsPath.toLowerCase().replace(/\\/g, '/');
        const excludePatterns = ['/node_modules/', '/obj/', '/bin/'];
        return excludePatterns.some(pattern => normalizedPath.includes(pattern));
    }

    refresh(): void { this._onDidChangeTreeData.fire(); }

    getTreeItem(element: NodeData): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.resourceUri = element.uri;
        item.description = element.description;
        item.command = {
            command: 'nuget-config-editor.openVisualEditor',
            title: 'Open Editor',
            arguments: [element.uri]
        };
        
        // Add globe icon for global config
        if (element.label === 'Global nuget.config') {
            item.iconPath = new vscode.ThemeIcon('globe');
        }
        
        return item;
    }

    async getChildren(_element?: NodeData): Promise<NodeData[]> {
        const showGlobal = vscode.workspace.getConfiguration('nugetConfigEditor').get<boolean>('showGlobalConfig', false);
        const files = await vscode.workspace.findFiles(NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, 50);
        const seen = new Set<string>();
        const nodes: NodeData[] = [];

        // Workspace files
        for (const f of files) {
            const key = f.fsPath.toLowerCase();
            if (seen.has(key)) { continue; }
            seen.add(key);
            try {
                const text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(f));
                const model = parseNugetConfig(text, false, f.fsPath, this.log);
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description: `${model.sources.length} sources` });
            } catch {
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description: 'parse error' });
            }
        }

        // Global config (optional, appended to end for clarity)
        if (showGlobal) {
            const globalPath = findGlobalNugetConfig();
            if (globalPath && !seen.has(globalPath.toLowerCase())) {
                try {
                    const uri = vscode.Uri.file(globalPath);
                    const text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
                    const model = parseNugetConfig(text, false, uri.fsPath, this.log);
                    nodes.push({ uri, label: 'Global nuget.config', description: `${model.sources.length} sources` });
                } catch {
                    nodes.push({ uri: vscode.Uri.file(globalPath), label: 'Global nuget.config', description: 'parse error' });
                }
            }
        }

        return nodes;
    }
}

export function registerNugetConfigTree(context: vscode.ExtensionContext, log: Logger) {
    const provider = new NugetConfigTreeProvider(context, log);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('nugetConfigEditor.configs', provider),
        vscode.commands.registerCommand('nuget-config-editor.refreshConfigTree', () => provider.refresh())
    );
    // Trigger initial refresh to ensure tree updates after workspace is fully loaded
    setTimeout(() => provider.refresh(), 10);
}
