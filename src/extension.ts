import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('FastWrangler is now active.');

    const disposable = vscode.commands.registerCommand('fastWrangler.explore', async (arg: any) => {
        let fileUri: vscode.Uri | undefined;

        if (arg instanceof vscode.Uri) {
            fileUri = arg;
        } else if (arg && arg.variable) {
            const variableName = arg.variable.evaluateName || arg.variable.name;
            const session = vscode.debug.activeDebugSession;
            if (session) {
                const tempDir = path.join(context.extensionPath, 'temp');
                if (!fs.existsSync(tempDir)) { fs.mkdirSync(tempDir, { recursive: true }); }
                const tempFileBase = path.join(tempDir, `debug_${variableName}`);
                const parquetFile = tempFileBase + '.parquet';

                if (fs.existsSync(parquetFile)) fs.unlinkSync(parquetFile);

                let frameId: number | undefined;
                try {
                    const threadsResponse = await session.customRequest('threads');
                    const threads: Array<{ id: number }> = threadsResponse?.threads ?? [];
                    for (const thread of threads) {
                        try {
                            const stackResponse = await session.customRequest('stackTrace', {
                                threadId: thread.id,
                                startFrame: 0,
                                levels: 1
                            });
                            const frames: Array<{ id: number }> = stackResponse?.stackFrames ?? [];
                            if (frames.length > 0) {
                                frameId = frames[0].id;
                                break;
                            }
                        } catch {
                        }
                    }
                } catch (e) {
                    console.warn('FastWrangler: Could not resolve active frame, falling back to no frameId', e);
                }

                try {
                    const pyCode = `
def __fastwrangler_export(var_obj, parquet_path):
    try:
        if hasattr(var_obj, 'to_frame'):
            var_obj = var_obj.to_frame()
    except Exception:
        pass
    
    var_obj.to_parquet(parquet_path)

__fastwrangler_export(${variableName}, ${JSON.stringify(parquetFile)})
`;
                    const expression = `exec(${JSON.stringify(pyCode)})`;

                    await session.customRequest('evaluate', {
                        expression: expression,
                        frameId: frameId,
                        context: 'repl'
                    });

                    if (fs.existsSync(parquetFile)) {
                        fileUri = vscode.Uri.file(parquetFile);
                    }
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to export DataFrame '${variableName}': ${err}`);
                    return;
                }
            }
        }

        if (!fileUri || !fileUri.fsPath) {
            vscode.window.showInformationMessage('FastWrangler: Please select a file or DataFrame to explore.');
            return;
        }

        const mediaDir = vscode.Uri.file(path.join(context.extensionPath, 'media', 'duckdb'));

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
                    mediaDir
                ]
            }
        );

        const htmlPath = path.join(context.extensionPath, 'src', 'webview.html');
        const duckdbDir = path.join(context.extensionPath, 'media', 'duckdb');
        const webviewAsset = (file: string) => panel.webview.asWebviewUri(vscode.Uri.file(path.join(duckdbDir, file))).toString();

        panel.webview.html = fs.readFileSync(htmlPath, 'utf8')
            .replace('__FILE_URI__', panel.webview.asWebviewUri(fileUri).toString())
            .replace('__FILE_EXT__', path.extname(fileUri.fsPath).substring(1).toLowerCase())
            .replace('__DUCKDB_BUNDLE__', webviewAsset('duckdb-bundle.js'))
            .replace('__DUCKDB_EH_WORKER__', webviewAsset('duckdb-browser-eh.worker.js'))
            .replace('__DUCKDB_EH_WASM__', webviewAsset('duckdb-eh.wasm'));

        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'downloadData':
                    handleDownloadData(message, context).finally(() => {
                        panel.webview.postMessage({ command: 'exportFinished' });
                    });
                    return;
            }
        }, undefined, context.subscriptions);
    });

    context.subscriptions.push(disposable);
}


async function handleDownloadData(message: { filename: string; content: string | Uint8Array; format: string }, context: vscode.ExtensionContext) {
    const filters: { [key: string]: string[] } = {};
    if (message.format === 'csv') filters['CSV'] = ['csv'];
    else if (message.format === 'parquet') filters['Parquet'] = ['parquet'];
    else if (message.format === 'json') filters['JSON'] = ['json'];

    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(context.extensionPath, 'temp', message.filename)),
        filters
    });

    if (saveUri) {
        if (message.content instanceof Uint8Array || typeof message.content !== 'string') {
            const buffer = Buffer.from(message.content as any);
            fs.writeFileSync(saveUri.fsPath, buffer);
        } else {
            fs.writeFileSync(saveUri.fsPath, message.content, 'utf8');
        }
        vscode.window.showInformationMessage(`Exported to ${path.basename(saveUri.fsPath)}`);
    }
}

export function deactivate() { }
