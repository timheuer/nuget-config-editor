import * as vscode from 'vscode';
import { parseNugetConfig } from '../services/nugetConfigService';
import { NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, SETTING_SHOW_GLOBAL, TREE_GLOBAL_CONFIG_LABEL, TREE_SOURCES_SUFFIX, TREE_PARSE_ERROR, TREE_OPEN_EDITOR_COMMAND, MSG_REFRESHING_NUGET_CONFIGS } from '../constants';
import { findGlobalNugetConfig } from '../services/globalConfigLocator';
import { Logger } from '@timheuer/vscode-ext-logger';

interface NodeData { uri?: vscode.Uri; label: string; description?: string; isSearching?: boolean }

// Minimum duration to show the searching status (in milliseconds)
const SEARCHING_STATUS_MIN_DURATION_MS = 100;

export class NugetConfigTreeProvider implements vscode.TreeDataProvider<NodeData> {
    private _onDidChangeTreeData = new vscode.EventEmitter<NodeData | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private isSearching = false;
    private cachedNodes: NodeData[] = [];
    private globalConfigWatcher?: vscode.FileSystemWatcher;

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
                this.refreshFile(uri);
            }
        });
        context.subscriptions.push(watcher);

        // React to configuration changes for showing global config
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SETTING_SHOW_GLOBAL)) {
                this.updateGlobalConfigWatcher();
                this.refresh();
            }
        }));

        // Initialize global config watcher based on current settings
        this.updateGlobalConfigWatcher();
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

    /**
     * Refresh a specific file's tree item without doing a full tree refresh.
     * This is more efficient than refresh() when only one file has changed.
     */
    async refreshFile(uri: vscode.Uri): Promise<void> {
        // Find the cached node for this URI - use fsPath for more reliable comparison
        // This handles cases where URI objects might be different instances but point to the same file
        const nodeIndex = this.cachedNodes.findIndex(n => 
            n.uri?.fsPath.toLowerCase() === uri.fsPath.toLowerCase());
        
        if (nodeIndex >= 0) {
            // Update just this node's description
            try {
                const text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
                const model = parseNugetConfig(text, false, uri.fsPath, this.log);
                const enabled = model.sources.filter(s => s.enabled).length;
                const disabled = model.sources.length - enabled;
                this.cachedNodes[nodeIndex].description = disabled > 0 
                    ? `✓ ${enabled} ⊘ ${disabled}`
                    : `${model.sources.length} ${TREE_SOURCES_SUFFIX}`;
            } catch {
                this.cachedNodes[nodeIndex].description = TREE_PARSE_ERROR;
            }
            
            // Fire change event to refresh the tree view
            this._onDidChangeTreeData.fire(this.cachedNodes[nodeIndex]);
        } else {
            // File not in cache, do a full refresh
            this.refresh();
        }
    }

    getTreeItem(element: NodeData): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        
        // Handle searching status node
        if (element.isSearching) {
            item.iconPath = new vscode.ThemeIcon('loading~spin');
            return item;
        }
        
        // Only set command and properties for regular nodes (not searching nodes)
        if (element.uri) {
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
        }
        
        return item;
    }

    async getChildren(_element?: NodeData): Promise<NodeData[]> {
        // Show searching status if a search is in progress
        if (this.isSearching) {
            this.isSearching = false;
            // Return a temporary searching node
            const searchingNode: NodeData = { 
                label: MSG_REFRESHING_NUGET_CONFIGS, 
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
                const enabled = model.sources.filter(s => s.enabled).length;
                const disabled = model.sources.length - enabled;
                const description = disabled > 0 
                    ? `✓ ${enabled} ⊘ ${disabled}`
                    : `${model.sources.length} ${TREE_SOURCES_SUFFIX}`;
                nodes.push({ uri: f, label: vscode.workspace.asRelativePath(f), description });
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
                    const enabled = model.sources.filter(s => s.enabled).length;
                    const disabled = model.sources.length - enabled;
                    const description = disabled > 0 
                        ? `✓ ${enabled} ⊘ ${disabled}`
                        : `${model.sources.length} ${TREE_SOURCES_SUFFIX}`;
                    nodes.push({ uri, label: TREE_GLOBAL_CONFIG_LABEL, description });
                } catch {
                    nodes.push({ uri: vscode.Uri.file(globalPath), label: TREE_GLOBAL_CONFIG_LABEL, description: TREE_PARSE_ERROR });
                }
            }
        }

        // Cache the nodes for efficient single-file updates
        this.cachedNodes = nodes;
        return nodes;
    }
    
    private async performSearch(): Promise<void> {
        // Ensure the searching status is visible for a minimum duration
        // The actual search happens in the next getChildren() call
        await new Promise(resolve => setTimeout(resolve, SEARCHING_STATUS_MIN_DURATION_MS));
    }

    /**
     * Update the global config file watcher based on current settings.
     * Creates or destroys the watcher as needed.
     */
    private updateGlobalConfigWatcher(): void {
        // Dispose existing watcher if it exists
        if (this.globalConfigWatcher) {
            this.globalConfigWatcher.dispose();
            this.globalConfigWatcher = undefined;
        }

        // Create new watcher if global config should be shown
        const showGlobal = vscode.workspace.getConfiguration('nugetConfigEditor').get<boolean>('showGlobalConfig', false);
        if (showGlobal) {
            const globalPath = findGlobalNugetConfig();
            if (globalPath) {
                try {
                    // Create a watcher for the specific global config file
                    this.globalConfigWatcher = vscode.workspace.createFileSystemWatcher(globalPath);
                    
                    // Handle changes to the global config file
                    this.globalConfigWatcher.onDidChange((uri) => {
                        this.log.debug(`🔄 Global nuget.config changed: ${uri.fsPath}, refreshing tree item`);
                        this.refreshFile(uri);
                    });
                    
                    // Handle deletion of the global config file
                    this.globalConfigWatcher.onDidDelete(() => {
                        this.log.debug('🗑️ Global nuget.config deleted, refreshing tree');
                        this.refresh();
                    });
                    
                    // Handle creation of the global config file
                    this.globalConfigWatcher.onDidCreate((uri) => {
                        this.log.debug('✨ Global nuget.config created, refreshing tree');
                        this.refresh();
                    });
                    
                    this.context.subscriptions.push(this.globalConfigWatcher);
                    this.log.debug(`👀 Watching global nuget.config at: ${globalPath}`);
                } catch (error) {
                    this.log.warn('⚠️ Failed to create global config watcher', { error: String(error), path: globalPath });
                }
            }
        }
    }

    /**
     * Manually refresh the global config tree item.
     * This is useful when external changes are made that don't trigger file watchers.
     */
    refreshGlobalConfig(): void {
        const showGlobal = vscode.workspace.getConfiguration('nugetConfigEditor').get<boolean>('showGlobalConfig', false);
        if (showGlobal) {
            const globalPath = findGlobalNugetConfig();
            if (globalPath) {
                const uri = vscode.Uri.file(globalPath);
                this.log.debug(`🔄 Manually refreshing global config: ${globalPath}`);
                this.refreshFile(uri);
            }
        }
    }

    /**
     * Dispose of resources when the tree provider is disposed.
     */
    dispose(): void {
        if (this.globalConfigWatcher) {
            this.globalConfigWatcher.dispose();
            this.globalConfigWatcher = undefined;
        }
    }
}

export function registerNugetConfigTree(context: vscode.ExtensionContext, log: Logger): NugetConfigTreeProvider {
    const provider = new NugetConfigTreeProvider(context, log);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('nugetConfigEditor.configs', provider),
        vscode.commands.registerCommand('nuget-config-editor.refreshConfigTree', () => provider.refresh()),
        // Ensure proper cleanup of the tree provider
        { dispose: () => provider.dispose() }
    );
    // Trigger initial refresh to ensure tree updates after workspace is fully loaded
    setTimeout(() => provider.refresh(), 10);
    return provider;
}
