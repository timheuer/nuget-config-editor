import * as vscode from 'vscode';
import { parseNugetConfig } from '../services/nugetConfigService';
import { NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, SETTING_SHOW_GLOBAL, TREE_GLOBAL_CONFIG_LABEL, TREE_SOURCES_SUFFIX, TREE_PARSE_ERROR, TREE_OPEN_EDITOR_COMMAND } from '../constants';
import { findGlobalNugetConfig } from '../services/globalConfigLocator';
import { Logger } from '@timheuer/vscode-ext-logger';

interface NodeData { uri?: vscode.Uri; label: string; description?: string; isSearching?: boolean }

export class NugetConfigTreeProvider implements vscode.TreeDataProvider<NodeData> {
    private _onDidChangeTreeData = new vscode.EventEmitter<NodeData | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private isSearching = false;

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

    refresh(): void { 
        this.isSearching = true;
        this._onDidChangeTreeData.fire(); 
    }

    getTreeItem(element: NodeData): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        
        // Handle searching status node
        if (element.isSearching) {
            item.iconPath = new vscode.ThemeIcon('loading~spin');
            return item;
        }
        
        item.resourceUri = element.uri;
        item.description = element.description;
        item.command = {
            command: 'nuget-config-editor.openVisualEditor',
            title: TREE_OPEN_EDITOR_COMMAND,
            arguments: [element.uri]
        };
        
        // Add globe icon for global config
        if (element.label === TREE_GLOBAL_CONFIG_LABEL) {
            item.iconPath = new vscode.ThemeIcon('globe');
        }
        
        return item;
    }

    async getChildren(_element?: NodeData): Promise<NodeData[]> {
        // Show searching status if a search is in progress
        if (this.isSearching) {
            this.isSearching = false;
            // Return a temporary searching node
            const searchingNode: NodeData = { 
                label: 'Searching for nuget.config files in this workspace...', 
                isSearching: true 
            };
            
            // Trigger actual search asynchronously and refresh when done
            this.performSearch().then(() => {
                this._onDidChangeTreeData.fire();
            });
            
            return [searchingNode];
        }
        
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
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description: `${model.sources.length} ${TREE_SOURCES_SUFFIX}` });
            } catch {
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description: TREE_PARSE_ERROR });
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
                    nodes.push({ uri, label: TREE_GLOBAL_CONFIG_LABEL, description: `${model.sources.length} ${TREE_SOURCES_SUFFIX}` });
                } catch {
                    nodes.push({ uri: vscode.Uri.file(globalPath), label: TREE_GLOBAL_CONFIG_LABEL, description: TREE_PARSE_ERROR });
                }
            }
        }

        return nodes;
    }
    
    private async performSearch(): Promise<void> {
        // This method performs the actual search
        // The search logic is already in getChildren, so we just need to wait a moment
        // to ensure the searching status is visible
        await new Promise(resolve => setTimeout(resolve, 100));
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
