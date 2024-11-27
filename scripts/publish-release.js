import * as cp from 'node:child_process';

import { createRelease } from './utils/github-releases.js';
import { getPackageDir, hasJsrJson, readJsrJson, readPackageJson } from './utils/packages.js';
import { logAndExec } from './utils/process.js';
import { isValidVersion } from './utils/semver.js';

let packageName = process.argv[2];
let version = process.argv[3];

if (packageName === undefined || (!packageName.includes('@') && version === undefined)) {
  console.error(`Usage:
    node publish-release.js <packageName> <version>
    node publish-release.js <tag>`);
  process.exit(1);
}

if (packageName.startsWith('@mjackson/')) {
  packageName = packageName.slice('@mjackson/'.length);
}

if (packageName.includes('@')) {
  let split = packageName.split('@');
  packageName = split[0];
  version = split[1];
}

let tag = `${packageName}@${version}`;

if (packageName === '' || !isValidVersion(version)) {
  console.error(`Invalid tag: ${tag}`);
  process.exit(1);
}

// 1) Ensure git staging area is clean
let status = cp.execSync('git status --porcelain').toString();
if (status !== '') {
  console.error('Git staging area is not clean');
  process.exit(1);
}

// 2) Ensure we are on the right tag
let currentTags = cp.execSync('git tag --points-at HEAD').toString().trim().split('\n');
if (!currentTags.includes(tag)) {
  console.error(`Tag "${tag}" does not point to HEAD`);
  process.exit(1);
}

console.log(`Publishing release ${tag} ...`);
console.log();

// 3) Publish to npm
let packageJson = readPackageJson(packageName);
if (packageJson.version !== version) {
  console.error(
    `Tag does not match package.json version: ${version} !== ${packageJson.version} (${tag})`,
  );
  process.exit(1);
}

logAndExec(`npm publish --access public`, {
  cwd: getPackageDir(packageName),
  env: process.env,
});
console.log();

// 4) Publish to jsr (if applicable)
if (hasJsrJson(packageName)) {
  let jsrJson = readJsrJson(packageName);
  if (jsrJson.version !== version) {
    console.error(
      `Tag does not match jsr.json version: ${version} !== ${jsrJson.version} (${tag})`,
    );
    process.exit(1);
  }

  logAndExec(`pnpm dlx jsr publish`, {
    cwd: getPackageDir(packageName),
    env: process.env,
  });
  console.log();
}

// 5) Publish to GitHub Releases
console.log(`Publishing ${tag} on GitHub Releases ...`);
let releaseUrl = await createRelease(packageName, version);
console.log(`Published at: ${releaseUrl}`);

console.log();