import { mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

mkdirSync('coverage', { recursive: true });
const tests = readdirSync('test').filter(name => name.endsWith('.test.mjs')).map(name => `test/${name}`);
const result = spawnSync(process.execPath, [
  '--test', '--experimental-test-coverage', '--test-coverage-include=dist/**/*.js',
  '--test-coverage-lines=90', '--test-coverage-branches=85', '--test-coverage-functions=90',
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info',
  ...tests,
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
