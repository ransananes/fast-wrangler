import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { resolveFrameId, exportVariableToParquet } from './debugExport';
import { createDataPanel } from './webviewPanel';
import { handleDownloadData } from './downloadHandler';

export function activate(context: vscode.ExtensionContext) {
    console.log('FastWrangler is now active.');

    const disposable = vscode.commands.registerCommand('fastWrangler.explore', async (arg: any) => {
        let fileUri: vscode.Uri | undefined;

        if (arg instanceof vscode.Uri) {
            fileUri = arg;
        } else if (arg?.variable) {
            const variableName: string = arg.variable.evaluateName || arg.variable.name;
            const session = vscode.debug.activeDebugSession;
            if (!session) {
                vscode.window.showErrorMessage('FastWrangler: No active debug session.');
                return;
            }

            const tempDir = path.join(context.extensionPath, 'temp');
            if (!fs.existsSync(tempDir)) { fs.mkdirSync(tempDir, { recursive: true }); }

            const parquetFile = path.join(tempDir, `debug_${variableName}.parquet`);
            const csvFile = path.join(tempDir, `debug_${variableName}.csv`);
            if (fs.existsSync(parquetFile)) { fs.unlinkSync(parquetFile); }
            if (fs.existsSync(csvFile)) { fs.unlinkSync(csvFile); }

            const frameId = await resolveFrameId(arg, session);

            try {
                await exportVariableToParquet(variableName, parquetFile, csvFile, frameId, session);
            } catch (err) {
                vscode.window.showErrorMessage(`FastWrangler: Failed to export '${variableName}': ${err}`);
                return;
            }

            const exportedFile = fs.existsSync(parquetFile) ? parquetFile
                : fs.existsSync(csvFile) ? csvFile
                : undefined;

            if (!exportedFile) {
                vscode.window.showErrorMessage(`FastWrangler: Export produced no file for '${variableName}'.`);
                return;
            }

            fileUri = vscode.Uri.file(exportedFile);
        }

        if (!fileUri?.fsPath) {
            vscode.window.showInformationMessage('FastWrangler: Please select a file or DataFrame variable to explore.');
            return;
        }

        const panel = createDataPanel(fileUri, context);
        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'downloadData') {
                handleDownloadData(message, context).finally(() => {
                    panel.webview.postMessage({ command: 'exportFinished' });
                });
            }
        }, undefined, context.subscriptions);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
