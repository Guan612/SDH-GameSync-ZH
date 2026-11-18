import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = '891f5b1';
const read = file => readFileSync(path.join(root, file), 'utf8');
const baseline = file => execFileSync('git', ['show', `${upstream}:${file}`], { cwd: root, encoding: 'utf8' });
const defaultConfig = JSON.parse(read('defaults/default_config.json'));
const jsx = (type, props) => ({ type, props: props ?? {} });
function nodes(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node?.props?.children)];
}
function text(node) {
  return nodes(node).filter(n => typeof n === 'string' || typeof n === 'number').join('');
}
function load(file, overrides = {}) {
  const modalCalls = [], configCalls = [], toastCalls = [];
  const config = { ...defaultConfig, ...overrides.config };
  const Config = {
    get: key => config[key],
    set: (key, value) => { configCalls.push([key, value]); config[key] = value; },
    on: () => ({ unregister() {} }),
  };
  class RoutePage { enter() {} }
  const mocks = {
    react: { useEffect() {}, useState: init => [init, () => {}], useRef: value => ({ current: value }) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@decky/ui': new Proxy({
      showModal: modal => modalCalls.push(modal),
      useParams: () => ({ appId: '42' }),
      sleep: () => Promise.resolve(),
    }, { get: (target, key) => target[key] ?? String(key) }),
    '../helpers/config': { default: Config },
    '../helpers/commonDefs': { GLOBAL_SYNC_APP_ID: 0, SHARED_FILTER_APP_ID: -1 },
    '../helpers/syncTaskQueue': { default: { busy: false } },
    '../helpers/syncFilters': { default: { has: () => true } },
    '../helpers/utils': { getAppName: () => '测试游戏', reduceSlashes: s => s.replace(/\/+/g, '/') },
    '../helpers/toaster': { toast: (...args) => toastCalls.push(args) },
    '../helpers/backend': overrides.backend ?? {},
  };
  const require = id => {
    if (mocks[id]) return mocks[id];
    if (id.endsWith('/routePage')) return { default: RoutePage };
    if (id.endsWith('/popups')) return { confirmPopup: (...args) => modalCalls.push(args) };
    return new Proxy({}, { get: (_, key) => key === 'default' ? id.split('/').at(-1) : String(key) });
  };
  const module = { exports: {} };
  const result = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  vm.runInNewContext(result.outputText, { require, module, exports: module.exports });
  return { exports: module.exports, modalCalls, configCalls, toastCalls };
}

test('Python backend, defaults and game lifecycle match upstream (ignoring checkout line endings)', () => {
  const files = [
    'main.py', 'defaults/default_config.json', 'defaults/exclude_all.filter', 'pnpm-lock.yaml',
    ...readdirSync(path.join(root, 'py_modules')).filter(f => f.endsWith('.py')).map(f => `py_modules/${f}`),
    'src/helpers/apiClient.ts', 'src/helpers/backend.ts', 'src/helpers/config.ts',
    'src/helpers/syncStateTracker.ts', 'src/helpers/syncFilters.ts', 'src/helpers/commonDefs.ts',
  ];
  for (const file of files) assert.equal(read(file).replaceAll('\r\n', '\n'), baseline(file).replaceAll('\r\n', '\n'), file);
});

test('plugin identity and package compatibility are retained', () => {
  const plugin = JSON.parse(read('plugin.json'));
  const old = JSON.parse(baseline('plugin.json'));
  for (const key of ['name', 'author', 'api_version', 'flags']) assert.deepEqual(plugin[key], old[key]);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '1.1.5-zh.1');
  assert.deepEqual(pkg.dependencies, JSON.parse(baseline('package.json')).dependencies);
  assert.match(read('src/index.tsx'), /name: `\$\{PLUGIN_NAME\}（中文）`/u);
});

function configBindings(source) {
  const ast = ts.createSourceFile('ui.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(ast) === 'Config') {
      result.push(node.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}
test('all UI Config get/set bindings remain unchanged', () => {
  for (const file of ['src/pages/quickAccessMenu.tsx', 'src/pages/syncTargetConfigPage.tsx', 'src/pages/configCloudPage.tsx', 'src/components/filtersView.tsx', 'src/components/filePickerButton.tsx']) {
    assert.deepEqual(configBindings(read(file)), configBindings(baseline(file)), file);
  }
});

test('Chinese quick panel and unchanged startup/exit toggle bindings', () => {
  const m = load('src/pages/quickAccessMenu.tsx');
  const tree = m.exports.default();
  assert.match(text(tree), /开始全局同步/);
  assert.match(text(tree), /全局同步规则/);
  const toggles = nodes(tree).filter(n => n?.type === 'ToggleField');
  for (const [label, key] of [['启动游戏时同步', 'sync_on_game_start'], ['退出游戏时同步', 'sync_on_game_stop']]) {
    const toggle = toggles.find(n => n.props.label === label);
    assert.ok(toggle, label);
    toggle.props.onChange(true);
    assert.deepEqual(m.configCalls.at(-1), [key, true]);
  }
});

test('advanced mode deletion warnings remain explicit in Chinese', () => {
  const m = load('src/pages/quickAccessMenu.tsx', { config: { advanced_mode: true } });
  const tree = m.exports.default();
  const toggle = nodes(tree).find(n => n?.props?.label === '严格游戏同步');
  assert.ok(toggle);
  toggle.props.onChange(true);
  const [title, description, confirm] = m.modalCalls.at(-1);
  assert.equal(title, '启用严格游戏同步');
  assert.match(text(description), /COPY.*SYNC/);
  assert.match(text(description), /删除目标端/);
  assert.equal(m.configCalls.length, 0);
  confirm();
  assert.deepEqual(m.configCalls.at(-1), ['strict_game_sync', true]);
});

test('default confirmation and cancel buttons are Chinese; draft writes only on confirmation', () => {
  const m = load('src/components/popups.tsx');
  let saved = '原值';
  m.exports.textInputPopup('测试', { value: saved, set: v => { saved = v; } });
  const modal = m.modalCalls.at(-1);
  assert.equal(modal.props.strOKButtonText, '确认');
  assert.equal(modal.props.strCancelButtonText, '取消');
  modal.props.children.props.onBlur({ target: { value: '新值' } });
  assert.equal(saved, '原值');
  modal.props.onOK();
  assert.equal(saved, '新值');
  m.exports.confirmPopup('标题', '说明');
  assert.equal(m.modalCalls.at(-1).props.strOKButtonText, '确认');
  m.exports.confirmPopup('标题', '说明', undefined, '立即上传', '跳过');
  assert.equal(m.modalCalls.at(-1).props.strOKButtonText, '立即上传');
  assert.equal(m.modalCalls.at(-1).props.strCancelButtonText, '跳过');
});

test('multiple input labels keep separate capture configuration fields', () => {
  const m = load('src/components/popups.tsx');
  const written = [];
  m.exports.multipleTextInputsPopup('上传位置', {
    截图: { value: '/screens', set: v => written.push(['capture_upload_destination', v]) },
    录像片段: { value: '/clips', set: v => written.push(['capture_upload_destination_video', v]) },
  });
  const modal = m.modalCalls.at(-1);
  modal.props.children[1].props.onBlur({ target: { value: '/new-clips' } });
  modal.props.onOK();
  assert.deepEqual(written, [['capture_upload_destination', '/screens'], ['capture_upload_destination_video', '/new-clips']]);
});

test('game page translates upload/download directions without mixing them', () => {
  const m = load('src/pages/syncTargetConfigPage.tsx');
  const page = m.exports.default.render();
  assert.deepEqual(Array.from(page.props.pages.filter(p => typeof p !== 'string'), p => p.title), ['同步日志', '专用同步规则', '共享同步规则']);
  const actions = nodes(page.props.pages[2].content);
  assert.ok(actions.some(n => n?.props?.onOKActionDescription === '立即上传到云端'));
  assert.ok(actions.some(n => n?.props?.onOKActionDescription === '立即下载到本地'));
});

test('WebDAV help is explicit about desktop setup and required remote name', () => {
  const m = load('src/pages/configCloudPage.tsx');
  const tree = m.exports.default.render();
  const button = nodes(tree).find(n => n?.props?.label === 'WebDAV / 其他服务（桌面配置）');
  assert.ok(button);
  button.props.onClick();
  const [title, description] = m.modalCalls.at(-1);
  assert.equal(title, '配置 WebDAV 或其他服务');
  assert.match(text(description), /桌面模式/);
  assert.match(text(description), /cloud/);
  assert.match(text(description), /不能在此处直接输入账号/);
});

test('no untranslated English JSX prose or common control labels remain', () => {
  const brand = /^(OneDrive|Dropbox|Google Drive)$/;
  const inspect = file => {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node) && !(ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(ast) === 'code')) {
        const value = node.text.trim();
        assert.ok(!/[A-Za-z]{2}/.test(value) || /[\u3400-\u9fff]/u.test(value) || brand.test(value), `${file}: ${value}`);
      }
      if (ts.isJsxAttribute(node) && ['title', 'label', 'onOKActionDescription'].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const value = node.initializer.text;
        assert.ok(!/[A-Za-z]/.test(value) || /[\u3400-\u9fff]/u.test(value) || brand.test(value), `${file}: ${value}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  };
  for (const dir of ['src/pages', 'src/components']) {
    for (const name of readdirSync(path.join(root, dir)).filter(n => n.endsWith('.tsx'))) inspect(`${dir}/${name}`);
  }
  assert.match(read('src/helpers/contextMenuPatch.ts'), /children: "同步日志与规则"/);
  assert.match(read('src/helpers/syncTaskQueue.ts'), /上次未完成上传，已跳过下载以保护本地存档/);
});
