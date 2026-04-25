import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'media', 'duckdb');

mkdirSync(outDir, { recursive: true });

await esbuild.build({
    entryPoints: [join(root, 'scripts', 'duckdb-entry.mjs')],
    bundle: true,
    format: 'iife',
    globalName: 'DuckDBBundle',
    outfile: join(outDir, 'duckdb-bundle.js'),
    platform: 'browser',
    target: ['chrome100'],
    define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
    },
    logLevel: 'info',
});

const duckdbDist = join(root, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
for (const file of [
    'duckdb-browser-eh.worker.js',
    'duckdb-eh.wasm',
]) {
    copyFileSync(join(duckdbDist, file), join(outDir, file));
    console.log('Copied:', file);
}

console.log('DuckDB bundle complete →', outDir);
