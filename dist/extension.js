"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));
var fs3 = __toESM(require("fs"));

// src/debugExport.ts
var EXPORT_PY = `
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
async function resolveFrameId(arg, session) {
  if (typeof arg.frameId === "number") {
    return arg.frameId;
  }
  try {
    const threadsResp = await session.customRequest("threads");
    const threads = threadsResp?.threads ?? [];
    for (const thread of threads) {
      try {
        const stackResp = await session.customRequest("stackTrace", {
          threadId: thread.id,
          startFrame: 0,
          levels: 1
        });
        const frames = stackResp?.stackFrames ?? [];
        if (frames.length > 0) {
          return frames[0].id;
        }
      } catch {
      }
    }
  } catch (e) {
    console.warn("FastWrangler: could not resolve active frame", e);
  }
  return void 0;
}
async function exportVariableToParquet(variableName, parquetPath, csvPath, frameId, session) {
  const code = EXPORT_PY + `
__fastwrangler_export(${variableName}, ${JSON.stringify(parquetPath)}, ${JSON.stringify(csvPath)})
`;
  await session.customRequest("evaluate", {
    expression: `exec(${JSON.stringify(code)})`,
    frameId,
    context: "repl"
  });
}

// src/webviewPanel.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
function createDataPanel(fileUri, context) {
  const duckdbDir = path.join(context.extensionPath, "media", "duckdb");
  const panel = vscode.window.createWebviewPanel(
    "fastWrangler",
    "FastWrangler: " + path.basename(fileUri.fsPath),
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(fileUri.fsPath)),
        vscode.Uri.file(context.extensionPath),
        vscode.Uri.file(duckdbDir)
      ]
    }
  );
  const asset = (file) => panel.webview.asWebviewUri(vscode.Uri.file(path.join(duckdbDir, file))).toString();
  const htmlPath = path.join(context.extensionPath, "media", "webview.html");
  panel.webview.html = fs.readFileSync(htmlPath, "utf8").replace("__FILE_URI__", panel.webview.asWebviewUri(fileUri).toString()).replace("__FILE_EXT__", path.extname(fileUri.fsPath).substring(1).toLowerCase()).replace("__DUCKDB_BUNDLE__", asset("duckdb-bundle.js")).replace("__DUCKDB_EH_WORKER__", asset("duckdb-browser-eh.worker.js")).replace("__DUCKDB_EH_WASM__", asset("duckdb-eh.wasm"));
  return panel;
}

// src/downloadHandler.ts
var vscode2 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
async function handleDownloadData(message, context) {
  const filters = {};
  if (message.format === "csv") {
    filters["CSV"] = ["csv"];
  } else if (message.format === "parquet") {
    filters["Parquet"] = ["parquet"];
  } else if (message.format === "json") {
    filters["JSON"] = ["json"];
  }
  const saveUri = await vscode2.window.showSaveDialog({
    defaultUri: vscode2.Uri.file(path2.join(context.extensionPath, "temp", message.filename)),
    filters
  });
  if (!saveUri) {
    return;
  }
  if (typeof message.content !== "string") {
    fs2.writeFileSync(saveUri.fsPath, message.content);
  } else {
    fs2.writeFileSync(saveUri.fsPath, message.content, "utf8");
  }
  vscode2.window.showInformationMessage(`Exported to ${path2.basename(saveUri.fsPath)}`);
}

// src/extension.ts
function activate(context) {
  console.log("FastWrangler is now active.");
  const disposable = vscode3.commands.registerCommand("fastWrangler.explore", async (arg) => {
    let fileUri;
    if (arg instanceof vscode3.Uri) {
      fileUri = arg;
    } else if (arg?.variable) {
      const variableName = arg.variable.evaluateName || arg.variable.name;
      const session = vscode3.debug.activeDebugSession;
      if (!session) {
        vscode3.window.showErrorMessage("FastWrangler: No active debug session.");
        return;
      }
      const tempDir = path3.join(context.extensionPath, "temp");
      if (!fs3.existsSync(tempDir)) {
        fs3.mkdirSync(tempDir, { recursive: true });
      }
      const parquetFile = path3.join(tempDir, `debug_${variableName}.parquet`);
      const csvFile = path3.join(tempDir, `debug_${variableName}.csv`);
      if (fs3.existsSync(parquetFile)) {
        fs3.unlinkSync(parquetFile);
      }
      if (fs3.existsSync(csvFile)) {
        fs3.unlinkSync(csvFile);
      }
      const frameId = await resolveFrameId(arg, session);
      try {
        await exportVariableToParquet(variableName, parquetFile, csvFile, frameId, session);
      } catch (err) {
        vscode3.window.showErrorMessage(`FastWrangler: Failed to export '${variableName}': ${err}`);
        return;
      }
      const exportedFile = fs3.existsSync(parquetFile) ? parquetFile : fs3.existsSync(csvFile) ? csvFile : void 0;
      if (!exportedFile) {
        vscode3.window.showErrorMessage(`FastWrangler: Export produced no file for '${variableName}'.`);
        return;
      }
      fileUri = vscode3.Uri.file(exportedFile);
    }
    if (!fileUri?.fsPath) {
      vscode3.window.showInformationMessage("FastWrangler: Please select a file or DataFrame variable to explore.");
      return;
    }
    const panel = createDataPanel(fileUri, context);
    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "downloadData") {
        handleDownloadData(message, context).finally(() => {
          panel.webview.postMessage({ command: "exportFinished" });
        });
      }
    }, void 0, context.subscriptions);
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
