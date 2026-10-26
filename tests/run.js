/**
 * Chạy toàn bộ kiểm thử:
 *   node tests/run.js          -> logic + giao diện
 *   node tests/run.js logic    -> chỉ logic (đăng nhập, đơn hàng, admin, đánh giá, mã giảm giá...)
 *   node tests/run.js ui       -> chỉ giao diện (render từng màn hình và mô phỏng thao tác)
 *
 * Cần: npm i -D esbuild react-test-renderer@<đúng phiên bản của react>
 * MockAPI, AsyncStorage và các module native đều được giả lập, nên KHÔNG cần mạng
 * hay điện thoại. Kiểm thử không thay thế việc chạy thử trên máy thật.
 */
const path = require('path');
const { spawnSync } = require('child_process');

let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  console.error('Thiếu esbuild. Chạy: npm i -D esbuild react-test-renderer');
  process.exit(1);
}

const here = __dirname;
const stub = (name) => path.join(here, 'stubs', name);
const out = (name) => path.join(here, '.out', name);
const only = process.argv[2];

const base = { bundle: true, platform: 'node', logLevel: 'error', loader: { '.js': 'jsx' }, jsx: 'automatic' };

const logicAlias = {
  'expo-crypto': stub('expo-crypto.js'),
  '@react-native-async-storage/async-storage': stub('async-storage.js'),
  'expo-file-system': stub('filesystem.js'),
  'react-native': stub('react-native-logic.js'),
};

const uiAlias = {
  'expo-crypto': stub('expo-crypto.js'),
  '@react-native-async-storage/async-storage': stub('async-storage.js'),
  'expo-file-system': stub('filesystem.js'),
  'react-native': stub('ui-rn.js'),
  '@expo/vector-icons': stub('ui-icons.js'),
  '@react-navigation/native': stub('ui-nav.js'),
  'react-native-safe-area-context': stub('ui-safe.js'),
  'expo-image': stub('ui-expo-image.js'),
  'expo-haptics': stub('ui-haptics.js'),
  'expo-image-picker': stub('ui-picker.js'),
  'expo-linear-gradient': stub('ui-gradient.js'),
};

const results = [];
function run(label, file) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', timeout: 240000 });
  results.push({ label, ok: result.status === 0, ms: Date.now() - started });
}

async function main() {
  if (!only || only === 'logic') {
    for (const name of ['auth', 'shopping', 'admin', 'extras']) {
      await esbuild.build({
        ...base,
        entryPoints: [path.join(here, 'logic', `${name}.entry.js`)],
        outfile: out(`${name}.js`),
        format: 'cjs',
        alias: logicAlias,
      });
      console.log(`\n▶ logic/${name}`);
      run(`logic/${name}`, path.join(here, 'logic', `${name}.test.js`));
    }
  }

  if (!only || only === 'ui') {
    await esbuild.build({
      ...base,
      entryPoints: [path.join(here, 'ui', 'smoke.jsx')],
      outfile: out('ui-smoke.mjs'),
      format: 'esm',
      alias: uiAlias,
      banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    });
    console.log('\n▶ ui/smoke');
    run('ui/smoke', out('ui-smoke.mjs'));
  }

  console.log('\n──────── Kết quả ────────');
  results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.label} (${(r.ms / 1000).toFixed(1)}s)`));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
