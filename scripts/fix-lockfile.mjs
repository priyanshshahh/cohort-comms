#!/usr/bin/env node
/**
 * Repair platform-specific optional dependencies in package-lock.json.
 *
 * npm intermittently writes the nested `@esbuild/*` binaries without
 * `"optional": true`, even though esbuild declares all 26 of them as
 * optionalDependencies. `npm ci` then tries to install the AIX binary on a
 * Linux runner and dies with EBADPLATFORM, so CI fails while every developer
 * machine stays green.
 *
 * This bit CI twice: once on the original lockfile and again the moment a
 * dependency change regenerated it. Run this after any npm install that
 * touches the lockfile:
 *
 *   node scripts/fix-lockfile.mjs
 *
 * Exits non-zero if it changed anything, so it can gate a commit.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'package-lock.json'
const lock = JSON.parse(readFileSync(path, 'utf8'))

let fixed = 0
for (const [name, meta] of Object.entries(lock.packages ?? {})) {
  const platformScoped = (meta.os || meta.cpu) && !meta.optional
  if (name.includes('/@esbuild/') && platformScoped) {
    meta.optional = true
    fixed++
  }
}

if (fixed > 0) {
  writeFileSync(path, JSON.stringify(lock, null, 2) + '\n')
  console.error(`fixed ${fixed} optional flags in ${path}`)
  process.exit(1)
}

console.log('lockfile optional flags OK')
