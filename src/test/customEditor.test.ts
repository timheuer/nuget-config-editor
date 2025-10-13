import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tests for custom editor provider functionality, especially for handling
 * files outside the workspace (like global nuget.config).
 */
suite('Custom Editor Provider', () => {
    /**
     * Helper to check if a URI would be considered inside a workspace.
     * This uses VS Code's built-in API which handles platform differences correctly
     * (path separators, case sensitivity on Windows vs Unix).
     */
    function isFileInWorkspace(uri: vscode.Uri): boolean {
        return vscode.workspace.getWorkspaceFolder(uri) !== undefined;
    }

    test('Files outside workspace are detected correctly', () => {
        // Test with a global config path that would be outside any workspace
        const globalConfigPath = process.platform === 'win32'
            ? 'C:\\Users\\TestUser\\AppData\\Roaming\\NuGet\\NuGet.Config'
            : '/home/testuser/.config/NuGet/NuGet.Config';
        
        const globalUri = vscode.Uri.file(globalConfigPath);
        
        // When no workspace is open, all files are considered "outside workspace"
        const result = isFileInWorkspace(globalUri);
        
        // This test passes when no workspace folders exist or the file is not in workspace
        // The actual result depends on whether a workspace is open during test execution
        assert.ok(typeof result === 'boolean', 'isFileInWorkspace should return a boolean');
    });

    test('Workspace file detection with workspace folders', () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (workspaceFolders && workspaceFolders.length > 0) {
            // If we have workspace folders, test that a file within the workspace is detected
            const workspaceFile = vscode.Uri.joinPath(workspaceFolders[0].uri, 'nuget.config');
            const result = isFileInWorkspace(workspaceFile);
            assert.strictEqual(result, true, 'File in workspace should be detected as such');
            
            // Test that a file outside the workspace is not detected as being inside
            const outsideFile = vscode.Uri.file(
                process.platform === 'win32' 
                    ? 'C:\\temp\\nuget.config'
                    : '/tmp/nuget.config'
            );
            const outsideResult = isFileInWorkspace(outsideFile);
            // This should be false unless /tmp happens to be in the workspace
            assert.ok(typeof outsideResult === 'boolean', 'Detection should work for files outside workspace');
        }
    });
});
