// See test-openai-compat-per-endpoint-key.sh for what this establishes.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, '..', '..', 'mcp-servers', 'openai-compat', 'dist', 'index.mjs');

// The endpoint. It records what arrived and answers enough for the bridge to
// finish the call, so a case that fails does so on the header and not on a
// malformed reply.
function endpoint() {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(req.headers.authorization ?? null);
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'resp-1',
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ seen, server, url: `http://127.0.0.1:${server.address().port}/v1` });
    });
  });
}

// One MCP conversation over stdio: initialize, then one tools/call. The bridge is
// spawned per case so each starts from the environment that case is about.
function callBridge({ env, args }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BRIDGE], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`bridge did not answer in time; stderr: ${stderr}`));
    }, 20000);
    child.stderr.on('data', (c) => { stderr += c; });
    child.stdout.on('data', (c) => {
      out += c;
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(msg);
        }
      }
    });
    child.on('error', reject);
    const send = (o) => child.stdin.write(`${JSON.stringify(o)}\n`);
    send({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2024-11-05', capabilities: {},
        clientInfo: { name: 'ae-test', version: '0' },
      },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'chat', arguments: args } });
  });
}

const failures = [];
const eq = (what, actual, expected) => {
  if (actual === expected) return;
  failures.push(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const { seen, server, url } = await endpoint();

// Each case is one spawn of the bridge against one endpoint, so `seen` holds
// exactly what that case sent.
const cases = [
  {
    what: 'a named variable that is set carries that key',
    env: { KEY_A: 'key-for-A', AE_OPENAI_COMPAT_API_KEY: 'the-process-wide-key' },
    args: { prompt: 'hi', model: 'm', endpoint: url, api_key_env: 'KEY_A' },
    expect: 'Bearer key-for-A',
  },
  {
    what: 'a second backend carries its own key, not the first one',
    env: { KEY_B: 'key-for-B', AE_OPENAI_COMPAT_API_KEY: 'the-process-wide-key' },
    args: { prompt: 'hi', model: 'm', endpoint: url, api_key_env: 'KEY_B' },
    expect: 'Bearer key-for-B',
  },
  {
    what: 'a named variable that is unset sends no credential at all',
    env: { AE_OPENAI_COMPAT_API_KEY: 'the-process-wide-key' },
    args: { prompt: 'hi', model: 'm', endpoint: url, api_key_env: 'KEY_MISSING' },
    expect: undefined,
  },
  {
    what: 'no name at all keeps the process-wide key working',
    env: { AE_OPENAI_COMPAT_API_KEY: 'the-process-wide-key' },
    args: { prompt: 'hi', model: 'm', endpoint: url },
    expect: 'Bearer the-process-wide-key',
  },
  {
    what: 'no name and no process-wide key sends no credential',
    env: { AE_OPENAI_COMPAT_API_KEY: '' },
    args: { prompt: 'hi', model: 'm', endpoint: url },
    expect: undefined,
  },
];

for (const c of cases) {
  const before = seen.length;
  const reply = await callBridge({ env: c.env, args: c.args });
  if (reply.result?.isError) {
    failures.push(`${c.what}: the bridge reported an error: ${JSON.stringify(reply.result.content)}`);
    continue;
  }
  if (seen.length !== before + 1) {
    failures.push(`${c.what}: the endpoint saw ${seen.length - before} requests, not 1`);
    continue;
  }
  // The header the endpoint received. `null` when none arrived, which is the
  // claim in the two cases that expect no credential.
  const got = seen[seen.length - 1] ?? undefined;
  eq(c.what, got, c.expect);
}

server.close();

for (const f of failures) console.log('not ok:', f);
// The count the Contract's E1 asks for: a test that asserts nothing must not be
// able to pass by exercising nothing.
console.log(`AE-SUBJECTS: ${cases.length}`);
console.log(`${cases.length - failures.length}/${cases.length} credential cases passed`);
process.exit(failures.length === 0 ? 0 : 1);
