import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';

const diff = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
});

if (diff.status !== 0) {
  process.exit(diff.status ?? 1);
}

const changedFiles = diff.stdout
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const relevantFiles = changedFiles.filter(
  (file) =>
    file.startsWith('src/') ||
    file.startsWith('test/') ||
    file.startsWith('apps/tester/') ||
    file === 'package.json' ||
    file === 'tsconfig.json',
);

if (relevantFiles.length === 0) {
  console.log('No staged source or test files changed; skipping tests.');
  process.exit(0);
}

const targetedTests = new Set();
for (const file of relevantFiles) {
  if (file.startsWith('test/') && file.endsWith('.test.mjs')) {
    targetedTests.add(file);
    continue;
  }

  if (file.startsWith('src/')) {
    const stem = basename(file).replace(/\.[^.]+$/, '');
    for (const candidate of [
      `test/${stem}.test.mjs`,
      `test/${stem.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}.test.mjs`,
    ]) {
      targetedTests.add(candidate);
    }
  }
}

const build = spawnSync('npm', ['run', 'build:lib'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const existingTests = [...targetedTests].filter((file) => existsSync(file));
const args = existingTests.length > 0 ? existingTests : ['test/*.test.mjs'];
const libraryTests = spawnSync('node', ['--test', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (libraryTests.status !== 0) {
  process.exit(libraryTests.status ?? 1);
}

if (relevantFiles.some((file) => file.startsWith('apps/tester/'))) {
  const testerTests = spawnSync('npm', ['run', 'test', '--workspace', '@mininic-nt/lexical-freemarker-tester'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(testerTests.status ?? 1);
}
