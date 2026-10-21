'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', '..');
const finance = fs.readFileSync(path.join(root, 'landing/src/finance.js'), 'utf8');
const landing = fs.readFileSync(path.join(root, 'landing/landing.js'), 'utf8');
const compact = fs.readFileSync(path.join(root, 'dashboard/compact-home.js'), 'utf8');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.dataset = {};
    this.children = [];
    this.handlers = new Map();
    this.attributes = {};
    this.value = '';
  }
  append(...children) { this.children.push(...children); }
  appendChild(node) { this.append(node); }
  remove() { this.removed = true; }
  addEventListener(event, fn) { this.handlers.set(event, fn); }
  setAttribute(key, val) { this.attributes[key] = val; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() { this.focused = true; }
  querySelector(selector) {
    const predicate = node => {
      if (selector === 'input') return node.tag === 'input';
      if (selector.startsWith('#')) return node.id === selector.slice(1);
      const dataset = /^\[data-finance-(amount|cadence|monthly)="([^"]+)"\]$/.exec(selector);
      if (dataset) return node.dataset[`finance${dataset[1][0].toUpperCase()}${dataset[1].slice(1)}`] === dataset[2];
      return false;
    };
    const stack = [...this.children];
    while (stack.length) {
      const el = stack.shift();
      if (predicate(el)) return el;
      stack.unshift(...el.children);
    }
    return null;
  }
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('Wide bundle contains the original COBOL Finance module, Compact intentionally does not', () => {
  assert.ok(landing.includes(finance), 'shipped Landing bundle must include full Finance source');
  assert.ok(landing.includes('com.streamshell.finance'));
  assert.ok(!compact.includes('com.streamshell.finance'), 'Compact must remain finance-free');
  assert.ok(/"finance\.js"/.test(fs.readFileSync(path.join(root, 'landing/build-landing.ps1'), 'utf8')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).permissions.includes('nativeMessaging'), true);
});

test('five Subscriptions heading clicks open the Wide finance overlay and RECONCILE reaches native COBOL host', async () => {
  const title = new Element('div');
  const body = new Element('body');
  const head = new Element('head');
  let calls = 0;
  let lastHost = null;
  let lastPayload = null;
  const report = [
    'STATUS=OK', 'ACTIVE=0000', 'ENDING=0000', 'MONTHLY_CENTS=000000000000',
    'ANNUAL_CENTS=000000000000', 'DIRECT_CENTS=000000000000',
    'GOOGLE_CENTS=000000000000', 'OTHER_CENTS=000000000000',
    'PRINT_REPORT_BEGIN', 'STREAM SHELL FINANCE TEST', 'PRINT_REPORT_END'
  ].join('\n');
  let stylesheet = null;
  const consoleMessages = [];
  const document = {
    body, head: { append(node) { stylesheet = node; head.append(node); } },
    querySelector(selector) { return selector === '.subscription-panel-title' ? title : null; },
    createElement(tag) { return new Element(tag); },
    addEventListener() {}
  };
  const chrome = {
    runtime: {
      getURL: path => `chrome-extension://test/${path}`,
      async sendNativeMessage(host, payload) {
        calls++;
        lastHost = host;
        lastPayload = payload;
        return { ok: true, reportBase64: Buffer.from(report).toString('base64') };
      }
    },
    storage: { local: {
      async get() { return { streamShellSubscriptions: { items: {} } }; },
      async set() {}
    }}
  };
  const context = vm.createContext({
    document, chrome, TextEncoder, TextDecoder, Intl, atob,
    btoa, setTimeout: () => 1, clearTimeout() {},
    console: { error(...args) { consoleMessages.push(args); } },
    window: { print() {} }
  });
  vm.runInContext(finance, context, { filename: 'finance.js' });
  assert.ok(stylesheet?.href.endsWith('/landing/finance.css'));
  assert.equal(typeof title.handlers.get('click'), 'function');
  for (let index = 0; index < 4; index++) title.handlers.get('click')();
  await settle();
  assert.equal(body.children.length, 0, 'the report must remain hidden before the fifth click');
  title.handlers.get('click')();
  await settle();
  assert.equal(body.children.length, 1, 'finance overlay should appear after the fifth click');
  assert.equal(body.children[0].className, 'finance-operations-overlay');
  assert.equal(calls, 0, 'opening empty Finance UI should not need native bridge');
  const reconcile = body.children[0].querySelector('#finance-reconcile');
  assert.ok(reconcile, 'Reconcile action available');
  reconcile.handlers.get('click')();
  await settle();
  assert.equal(calls, 1, 'reconcile must invoke native bridge exactly once');
  assert.equal(lastHost, 'com.streamshell.finance');
  assert.equal(lastPayload.action, 'reconcile');
  assert.ok(typeof lastPayload.recordsBase64 === 'string' && lastPayload.recordsBase64.length > 0);
  assert.equal(consoleMessages.length, 0, 'no finance UI errors');
  const print = body.children[0].querySelector('#finance-print');
  assert.equal(print.disabled, false, 'COBOL-generated report becomes printable');
});
