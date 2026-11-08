import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const recipes = JSON.parse(readFileSync(new URL('../fixtures/scene-integration-edits.json', import.meta.url), 'utf8'));
export function restoreIntegration(source, file) {
  for (const edit of [...(recipes[file] || [])].reverse()) {
    assert.equal(source.split(edit.newText).length, 2, file + ': unique declared integration change');
    source = source.replace(edit.newText, edit.oldText);
  }
  return source;
}
