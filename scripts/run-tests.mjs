import { spawnSync } from 'node:child_process';

const build = spawnSync('npm', ['run', 'build:lib'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const args = ['--test'];
const forwarded = process.argv.slice(2);
if (forwarded.length > 0) {
  args.push(...forwarded);
} else {
  args.push('test/*.test.mjs');
}

const testRun = spawnSync('node', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(testRun.status ?? 1);
