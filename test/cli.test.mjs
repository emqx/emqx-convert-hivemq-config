import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const run = (args, input) =>
  spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8' });
const xml =
  '<hivemq><mqtt><topic-alias><max-per-client>17</max-per-client></topic-alias></mqtt></hivemq>';

test('CLI handles file paths with spaces, stdin, JSON and output files', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'hivemq-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = join(directory, 'input config.xml');
  const output = join(directory, 'out.hocon');
  writeFileSync(input, xml);
  const stdin = run(['-'], xml);
  assert.equal(stdin.status, 0, stdin.stderr);
  assert.match(stdin.stdout, /max_topic_alias = 17/);
  assert.equal(run([input]).stdout, stdin.stdout);
  const file = run([input, '-o', output]);
  assert.equal(file.status, 0, file.stderr);
  assert.equal(file.stdout, '');
  assert.equal(readFileSync(output, 'utf8'), stdin.stdout);
  assert.equal(
    JSON.parse(run(['-', '--json'], xml).stdout).config.mqtt.max_topic_alias,
    17
  );
});

test('CLI reports errors without HOCON and rejects missing output paths', () => {
  for (const args of [
    [],
    ['--unknown'],
    ['-', '-o'],
    ['-', '-o', '--json'],
    ['-', 'second.xml'],
    ['/no-such-hivemq-config.xml'],
  ]) {
    const result = run(args, xml);
    assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stdout, '');
  }
  const malformed = run(['-'], '<hivemq>');
  assert.equal(malformed.status, 1);
  assert.equal(malformed.stdout, '');
  assert.equal(run(['--help']).status, 0);
});

test('strict conversion reports warnings and preserves an existing output file', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'hivemq-strict-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'out.hocon');
  writeFileSync(output, 'original');
  const result = run(
    ['-', '--strict', '-o', output],
    '<hivemq><rest-api/></hivemq>'
  );
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /Warning:/);
  assert.equal(result.stdout, '');
  assert.equal(readFileSync(output, 'utf8'), 'original');
});
