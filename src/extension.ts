// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerNugetConfigCustomEditor, broadcastToVisualEditors, sendToVisualEditor } from './customEditor/nugetConfigCustomEditorProvider';
import { registerNugetConfigTree } from './tree/nugetConfigTreeProvider';
import { createLoggerWithConfigMonitoring, Logger } from '@timheuer/vscode-ext-logger';
import { NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, MSG_NO_NUGET_CONFIG_FOUND, MSG_SELECT_NUGET_CONFIG, MSG_SELECT_NUGET_CONFIG_FOR_SOURCE, MSG_ENTER_PACKAGE_SOURCE_KEY, MSG_ENTER_PACKAGE_SOURCE_URL, SETTING_PREFER_VISUAL_EDITOR } from './constants';

let log: Logger;

export function activate(context: vscode.ExtensionContext) {
	
	// Initialize logging as early as possible
	log = createLoggerWithConfigMonitoring('NuGet Config Editor', 'nugetConfigEditor', 'logLevel', 'info', true, context) as unknown as Logger;

	// Basic workspace scan for nuget.config presence (activation event already configured, but double-check & log)
	vscode.workspace.findFiles(NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, 10)
		.then(files => {
			if (files.length > 0) {
				log.debug(`🔍 Detected ${files.length} nuget.config file(s).`);
			} else {
				log.debug('🔍 No nuget.config found during initial scan.');
		}
		}, (err: unknown) => {
			log.warn('⚠️ Error scanning for nuget.config', { err: String(err) });
		});

	// Register tree provider first so we can pass it to the custom editor
	const treeProvider = registerNugetConfigTree(context, log);
	
	// Register custom editor provider with callback to refresh tree on save
	registerNugetConfigCustomEditor(context, log, (uri: vscode.Uri) => treeProvider.refreshFile(uri));
	
	// Listen for document saves to refresh tree view when nuget.config files are saved
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
		if (/nuget\.config$/i.test(doc.uri.fsPath)) {
			treeProvider.refreshFile(doc.uri);
		}
	}));

	// Command: open visual editor for current or chosen nuget.config
	context.subscriptions.push(vscode.commands.registerCommand('nuget-config-editor.openVisualEditor', async (uri?: vscode.Uri) => {
		let target = uri as vscode.Uri | undefined;
		if (!target) {
			const active = vscode.window.activeTextEditor?.document;
			if (active && /nuget\.config$/i.test(active.uri.fsPath)) {
				target = active.uri;
			}
		}
		if (!target) {
			const files = await vscode.workspace.findFiles(NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, 10);
			if (files.length === 0) {
				vscode.window.showWarningMessage(MSG_NO_NUGET_CONFIG_FOUND);
				return;
			}
			if (files.length === 1) {
				target = files[0];
			} else {
				const pick = await vscode.window.showQuickPick(files.map(f => ({ label: vscode.workspace.asRelativePath(f), uri: f })), { placeHolder: MSG_SELECT_NUGET_CONFIG });
				target = pick?.uri;
			}
		}
		if (target) {
			// For files outside the workspace, we need to ensure the document is opened first
			// This helps VS Code recognize the file and apply the custom editor
			try {
				const doc = await vscode.workspace.openTextDocument(target);
				await vscode.commands.executeCommand('vscode.openWith', target, 'nugetConfigEditor.visualEditor');
			} catch (err) {
				log.error('❌ Failed to open nuget.config', { error: String(err) });
				vscode.window.showErrorMessage(`Failed to open nuget.config: ${err}`);
			}
		}
	}));

	// Command: add package source (sends prompt to active visual editor or prompts for file selection)
	context.subscriptions.push(vscode.commands.registerCommand('nuget-config-editor.addPackageSource', async () => {
		// Check if the active editor is a nuget.config file
		let targetUri: vscode.Uri | undefined;
		const activeEditor = vscode.window.activeTextEditor;
		
		if (activeEditor && /nuget\.config$/i.test(activeEditor.document.uri.fsPath)) {
			// Active editor is a nuget.config file
			targetUri = activeEditor.document.uri;
		} else {
			// Check if there are any nuget.config files in the workspace
			const files = await vscode.workspace.findFiles(NUGET_CONFIG_GLOB, NUGET_CONFIG_EXCLUDE_GLOB, 10);
			if (files.length === 0) {
				vscode.window.showWarningMessage(MSG_NO_NUGET_CONFIG_FOUND);
				return;
			}
			if (files.length === 1) {
				targetUri = files[0];
			} else {
				// Multiple files - ask user to pick one
				const pick = await vscode.window.showQuickPick(
					files.map(f => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
					{ placeHolder: MSG_SELECT_NUGET_CONFIG_FOR_SOURCE }
				);
				if (!pick) { return; }
				targetUri = pick.uri;
			}
		}

		if (!targetUri) { return; }

		// Get the key and URL from user
		const key = await vscode.window.showInputBox({ prompt: MSG_ENTER_PACKAGE_SOURCE_KEY, ignoreFocusOut: true });
		if (!key) { return; }
		const url = await vscode.window.showInputBox({ prompt: MSG_ENTER_PACKAGE_SOURCE_URL, ignoreFocusOut: true });
		if (!url) { return; }

		// Try to send to an open visual editor for this URI
		const sent = sendToVisualEditor(targetUri, { type: 'externalAddSource', key, url });
		
		// If no visual editor is open for this URI, open it
		if (!sent) {
			await vscode.commands.executeCommand('vscode.openWith', targetUri, 'nugetConfigEditor.visualEditor');
			// Wait a bit for the editor to initialize, then send the message
			setTimeout(() => {
				sendToVisualEditor(targetUri!, { type: 'externalAddSource', key, url });
			}, 500);
		}
	}));

	// Command: open extension settings
	context.subscriptions.push(vscode.commands.registerCommand('nuget-config-editor.openSettings', async () => {
		await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:timheuer.nuget-config-editor');
	}));

	// Auto-open preference
	const cfg = vscode.workspace.getConfiguration('nugetConfigEditor');
    const prefer = cfg.get<boolean>('preferVisualEditor', true);
	if (prefer) {
		vscode.workspace.textDocuments.forEach(d => {
			if (/nuget\.config$/i.test(d.uri.fsPath) && d.languageId === 'xml') {
				vscode.commands.executeCommand('vscode.openWith', d.uri, 'nugetConfigEditor.visualEditor');
			}
		});
		context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(d => {
			if (/nuget\.config$/i.test(d.uri.fsPath) && d.languageId === 'xml') {
				vscode.commands.executeCommand('vscode.openWith', d.uri, 'nugetConfigEditor.visualEditor');
			}
		}));
	}
	log.info('🚀 NuGet Config Editor activated');
}

// This method is called when your extension is deactivated
export function deactivate() {}
