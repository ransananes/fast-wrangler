import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function handleDownloadData(
    message: { filename: string; content: string | Uint8Array; format: string },
    context: vscode.ExtensionContext
): Promise<void> {
    const filters: Record<string, string[]> = {};
    if (message.format === 'csv') { filters['CSV'] = ['csv']; }
    else if (message.format === 'parquet') { filters['Parquet'] = ['parquet']; }
    else if (message.format === 'json') { filters['JSON'] = ['json']; }

    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(context.extensionPath, 'temp', message.filename)),
        filters,
    });

    if (!saveUri) { return; }

    if (typeof message.content !== 'string') {
        fs.writeFileSync(saveUri.fsPath, message.content as Uint8Array);
    } else {
        fs.writeFileSync(saveUri.fsPath, message.content, 'utf8');
    }

    vscode.window.showInformationMessage(`Exported to ${path.basename(saveUri.fsPath)}`);
}
