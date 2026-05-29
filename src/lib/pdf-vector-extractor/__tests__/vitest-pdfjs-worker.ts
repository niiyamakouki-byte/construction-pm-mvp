/**
 * vitest setup: pdf.js worker を file:// パスへ向ける。
 *
 * jsdom 環境では import.meta.url が http://localhost に解決され、
 * Node の ESM ローダが http スキームの動的 import を拒否するため、
 * 実ファイルの file:// URL を GlobalWorkerOptions.workerSrc に設定する。
 * setupFiles はテストモジュールより先に実行されるので、
 * pdf-loader 側の `if (!workerSrc)` ガードによりこの値が優先される。
 */

import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
