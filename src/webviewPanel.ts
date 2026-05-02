import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function createDataPanel(
    fileUri: vscode.Uri,
    context: vscode.ExtensionContext
): vscode.WebviewPanel {
    const duckdbDir = path.join(context.extensionPath, 'media', 'duckdb');

    const panel = vscode.window.createWebviewPanel(
        'fastWrangler',
        'FastWrangler: ' + path.basename(fileUri.fsPath),
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.dirname(fileUri.fsPath)),
                vscode.Uri.file(context.extensionPath),
                vscode.Uri.file(duckdbDir),
            ],
        }
    );

    const asset = (file: string) =>
        panel.webview.asWebviewUri(vscode.Uri.file(path.join(duckdbDir, file))).toString();

    const htmlPath = path.join(context.extensionPath, 'src', 'webview.html');
    panel.webview.html = fs.readFileSync(htmlPath, 'utf8')
        .replace('__FILE_URI__', panel.webview.asWebviewUri(fileUri).toString())
        .replace('__FILE_EXT__', path.extname(fileUri.fsPath).substring(1).toLowerCase())
        .replace('__DUCKDB_BUNDLE__', asset('duckdb-bundle.js'))
        .replace('__DUCKDB_EH_WORKER__', asset('duckdb-browser-eh.worker.js'))
        .replace('__DUCKDB_EH_WASM__', asset('duckdb-eh.wasm'));

    return panel;
}
