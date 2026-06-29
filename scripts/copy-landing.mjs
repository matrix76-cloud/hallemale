// scripts/copy-landing.mjs
// web/ 디렉터리 내용을 public/landing/ 으로 복사 (크로스플랫폼)
// 기존 "mkdir -p public/landing && cp -R web/. public/landing/" 를 대체.
// - Windows cmd.exe에는 mkdir -p / cp 가 없어 prestart·prebuild가 실패하던 문제 해결.

import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "web");
const dest = resolve(root, "public", "landing");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-landing] copied ${src} -> ${dest}`);
