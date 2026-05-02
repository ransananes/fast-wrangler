import * as vscode from 'vscode';

const EXPORT_PY = `
def __fastwrangler_export(var_obj, parquet_path, csv_path):
    t = type(var_obj)
    mod = getattr(t, '__module__', '') or ''

    if mod.startswith('polars'):
        if hasattr(var_obj, 'write_parquet'):
            var_obj.write_parquet(parquet_path)
        elif hasattr(var_obj, 'to_frame'):
            var_obj.to_frame().write_parquet(parquet_path)
        else:
            raise TypeError(f"Unsupported Polars type: {t.__name__}")
        return

    if mod.startswith('pyarrow'):
        import pyarrow.parquet as pq
        pq.write_table(var_obj, parquet_path)
        return

    if mod.startswith('dask'):
        var_obj = var_obj.compute()

    if hasattr(var_obj, 'to_frame') and not hasattr(var_obj, 'to_parquet'):
        var_obj = var_obj.to_frame()

    if hasattr(var_obj, 'to_parquet'):
        try:
            var_obj.to_parquet(parquet_path)
            return
        except ImportError:
            pass

    if hasattr(var_obj, 'to_csv'):
        var_obj.to_csv(csv_path, index=False)
        return

    raise TypeError(
        f"Cannot export '{t.__name__}': not a recognised DataFrame type "
        f"(pandas, Polars, PyArrow, or Dask)"
    )
`;

/**
 * Resolve the active frame ID.
 * Prefers the frameId embedded in the debug/variables/context arg (which
 * reflects the frame the user has selected in the Call Stack panel), then
 * falls back to querying the DAP for the top frame of the first stopped thread.
 */
export async function resolveFrameId(
    arg: Record<string, any>,
    session: vscode.DebugSession
): Promise<number | undefined> {
    if (typeof arg.frameId === 'number') {
        return arg.frameId;
    }

    try {
        const threadsResp = await session.customRequest('threads');
        const threads: Array<{ id: number }> = threadsResp?.threads ?? [];
        for (const thread of threads) {
            try {
                const stackResp = await session.customRequest('stackTrace', {
                    threadId: thread.id,
                    startFrame: 0,
                    levels: 1,
                });
                const frames: Array<{ id: number }> = stackResp?.stackFrames ?? [];
                if (frames.length > 0) {
                    return frames[0].id;
                }
            } catch {
                // thread may not be stopped — try the next one
            }
        }
    } catch (e) {
        console.warn('FastWrangler: could not resolve active frame', e);
    }
    return undefined;
}

/**
 * Export a Python variable to parquet (preferred) or CSV (fallback when
 * pyarrow/fastparquet are not installed) via the debug adapter.
 * Raises if the DAP evaluate request fails (e.g. not a DataFrame).
 */
export async function exportVariableToParquet(
    variableName: string,
    parquetPath: string,
    csvPath: string,
    frameId: number | undefined,
    session: vscode.DebugSession
): Promise<void> {
    const code = EXPORT_PY + `\n__fastwrangler_export(${variableName}, ${JSON.stringify(parquetPath)}, ${JSON.stringify(csvPath)})\n`;
    await session.customRequest('evaluate', {
        expression: `exec(${JSON.stringify(code)})`,
        frameId,
        context: 'repl',
    });
}
