import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

test('GAS build creates a self-contained browser bundle and valid server entrypoint', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  await promisify(execFile)(process.execPath, ['scripts/build-gas.js'], { cwd: root });
  const folder = new URL('../dist/gas/', import.meta.url);
  assert.deepEqual((await readdir(folder)).sort(), ['Code.gs', 'Index.html', 'Script.html', 'Styles.html', 'appsscript.json']);
  const server = await readFile(new URL('Code.gs', folder), 'utf8');
  assert.doesNotThrow(() => new Script(server));
  assert.match(server, /addMetaTag\('viewport'/);
  const script = await readFile(new URL('Script.html', folder), 'utf8');
  assert.doesNotThrow(() => new Script(script.replace(/^<script>\n/, '').replace(/\n<\/script>\n$/, '')));
  assert.match(script, /data:image\/svg\+xml;base64/);
  const preview = await readFile(new URL('../dist/preview/index.html', import.meta.url), 'utf8');
  const index = await readFile(new URL('Index.html', folder), 'utf8');
  const styles = await readFile(new URL('Styles.html', folder), 'utf8');
  const parts = { Index: index, Styles: styles, Script: script };
  const output = {
    content: '', title: '', meta: [],
    setTitle(title) { this.title = title; return this; },
    addMetaTag(name, content) { this.meta.push({ name, content }); return this; }
  };
  const runtime = { HtmlService: {
    createTemplateFromFile(name) {
      assert.equal(name, 'Index');
      return { evaluate() {
        output.content = parts[name].replace(/<\?!= include\('([^']+)'\); \?>/g, (_, part) => runtime.include(part));
        return output;
      } };
    },
    createHtmlOutputFromFile(name) {
      assert.ok(Object.hasOwn(parts, name), `Missing HTML include: ${name}`);
      return { getContent() { return parts[name]; } };
    }
  } };
  new Script(server).runInNewContext(runtime);
  assert.equal(runtime.doGet(), output);
  assert.equal(output.content, preview, 'Server HTML composition must match the bundled preview');
  assert.equal(output.title, 'Workout Coach');
  assert.deepEqual(output.meta, [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }]);
  assert.match(index, /<base target="_top">/);
  const markup = preview.replace(/<script>[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(markup, /<\?!=|type="module"|src="\.\/src\/|href="\.\/src\/|\.\/assets\//);
  const manifest = JSON.parse(await readFile(new URL('appsscript.json', folder), 'utf8'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.timeZone, 'Asia/Seoul');
});
