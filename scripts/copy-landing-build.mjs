// scripts/copy-landing-build.mjs
// web/ 디렉터리 내용을 build/landing/ 으로 복사 (Firebase hosting predeploy용, 크로스플랫폼)
// 기존 predeploy "mkdir -p build/landing && cp -R web/. build/landing/" 를 대체.
// - Windows cmd.exe에는 mkdir -p / cp 가 없어 predeploy가 실패하던 문제 해결.

import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "web");
const dest = resolve(root, "build", "landing");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-landing-build] copied ${src} -> ${dest}`);
