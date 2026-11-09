// Offline only: never downloads, authenticates or publishes.
import { resolve } from 'node:path';
import { inspectArchive, prepareHistory, restoreHistory, snapshotHistory } from './history-lib.mjs';
import { repoRoot } from './lib.mjs';
try {
  const args = process.argv.slice(2), command = args.shift(), options = {};
  const flags = {
    snapshot: ['--root', '--output'],
    verify: ['--archive', '--sha256'],
    restore: ['--archive', '--sha256', '--root'],
    prepare: ['--archive', '--sha256', '--root', '--output', '--release']
  };
  if (!flags[command]) throw new Error('Invalid history command');
  while (args.length) {
    const key = args.shift(), value = args.shift();
    if (!flags[command].includes(key) || !value || value.startsWith('--') || options[key] !== undefined) throw new Error('Invalid history arguments');
    options[key] = value;
  }
  for (const flag of flags[command].filter(flag => flag !== '--root')) if (!options[flag]) throw new Error('Missing history argument');
  const root = resolve(options['--root'] || repoRoot());
  const archive = options['--archive'] && resolve(options['--archive']);
  const output = options['--output'] && resolve(options['--output']);
  let result;
  if (command === 'snapshot') result = snapshotHistory(root, output);
  if (command === 'verify') result = inspectArchive(archive, options['--sha256']);
  if (command === 'restore') result = restoreHistory(archive, options['--sha256'], root);
  if (command === 'prepare') result = prepareHistory({root, archive, pin: options['--sha256'], release: options['--release'], output});
  console.log(JSON.stringify({...result, records: Array.isArray(result.records) ? result.records.length : result.records}, null, 2));
  console.log('HISTORY ONLY: no upload, account access, pruning or production qualification. Pin the digest independently; retain older off-machine backups.');
} catch {
  // Do not print parser errors, source excerpts, credentials or archive contents.
  console.error('history FAIL: operation refused. Check pinned digest, archive/catalog integrity, retained history, paths, explicit selection and output ownership. Details withheld.');
  process.exitCode = 1;
}
