import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { APP_CONFIG } from '../apps/web/src/data/exercises.js';

const output = new URL('../dist/gas/', import.meta.url);
const preview = new URL('../dist/preview/', import.meta.url);
const embedSvg = async name => `data:image/svg+xml;base64,${(await readFile(new URL(`../apps/web/public/${name}.svg`, import.meta.url))).toString('base64')}`;
const assets = { icon: await embedSvg('icon'), exercise: await embedSvg('exercise') };
const bundle = await build({
  absWorkingDir: fileURLToPath(new URL('../apps/web/', import.meta.url)), entryPoints: ['src/main.js'], bundle: true, write: false,
  format: 'iife', platform: 'browser', target: 'es2022', minify: true, charset: 'utf8',
  define: { __WORKOUT_ASSETS__: JSON.stringify(assets) },
  legalComments: 'none'
});
const javascript = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = (await readFile(new URL('../apps/web/src/ui/styles.css', import.meta.url), 'utf8')).replace(/<\/style/gi, '<\\/style');
const styles = `<style>\n${css}\n</style>\n`;
const script = `<script>\n${javascript}\n</script>\n`;
let html = await readFile(new URL('../apps/web/index.html', import.meta.url), 'utf8');
html = html.replace('<head>', '<head>\n    <base target="_top">')
  .replace('./public/icon.svg', assets.icon)
  .replace('    <link rel="stylesheet" href="./src/ui/styles.css">', "    <?!= include('Styles'); ?>")
  .replace('    <script type="module" src="./src/main.js"></script>', "    <?!= include('Script'); ?>");
const server = `// Generated from local sources. Rebuild instead of editing this file.\nfunction doGet() {\n  return HtmlService.createTemplateFromFile('Index')\n    .evaluate()\n    .setTitle(${JSON.stringify(APP_CONFIG.name)})\n    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');\n}\n\nfunction include(filename) {\n  return HtmlService.createHtmlOutputFromFile(filename).getContent();\n}\n`;
await mkdir(output, { recursive: true });
await mkdir(preview, { recursive: true });
await writeFile(new URL('Code.gs', output), server);
await writeFile(new URL('Index.html', output), html);
await writeFile(new URL('Styles.html', output), styles);
await writeFile(new URL('Script.html', output), script);
await writeFile(new URL('appsscript.json', output), JSON.stringify({ timeZone: 'Asia/Seoul', exceptionLogging: 'STACKDRIVER', runtimeVersion: 'V8' }, null, 2) + '\n');
await writeFile(new URL('index.html', preview), html.replace("<?!= include('Styles'); ?>", () => styles).replace("<?!= include('Script'); ?>", () => script));
console.log(`GAS files: ${fileURLToPath(output)}`);
console.log(`Bundled preview: ${fileURLToPath(preview)}`);
console.log('Build completed. No Apps Script upload or deployment was performed.');
