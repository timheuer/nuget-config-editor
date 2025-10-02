import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

async function ensureExtensionActivated() {
	// Activate the extension (some test environments don't auto-activate on activationEvents)
	const ext = vscode.extensions.all.find(e => (e.packageJSON && e.packageJSON.name) === 'nuget-config-editor');
	if (ext && !ext.isActive) {
		await ext.activate();
	}
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Open visual editor command exists', async () => {
		await ensureExtensionActivated();
		const cmds = await vscode.commands.getCommands(true);
		assert.ok(cmds.includes('nuget-config-editor.openVisualEditor'));
	});

	test('Add package source command exists', async () => {
		await ensureExtensionActivated();
		const cmds = await vscode.commands.getCommands(true);
		assert.ok(cmds.includes('nuget-config-editor.addPackageSource'));
	});
});
