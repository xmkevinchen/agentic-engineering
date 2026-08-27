// See test-api-key-env-reaches-the-bridge.sh for what this establishes.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BRIDGE = join(ROOT, 'mcp-servers', 'openai-compat', 'dist', 'index.mjs');

const failures = [];
let checked = 0;
const check = (what, ok) => {
  checked += 1;
  if (!ok) failures.push(what);
};

// --- the link that spawns the seat ------------------------------------------
const selection = readFileSync(join(ROOT, 'skills', 'agent-selection', 'SKILL.md'), 'utf8');
const passThrough = selection.split('\n')
  .join(' ')
  .match(/When spawning an entry on the generic seat[^.]*\./);
check('the spawn rule exists to be checked', Boolean(passThrough));
check('the spawn rule passes api_key_env through',
  Boolean(passThrough) && passThrough[0].includes('api_key_env'));

// --- the link that calls the bridge -----------------------------------------
const proxy = readFileSync(join(ROOT, 'agents', 'workflow', 'openai-compat-proxy.md'), 'utf8');
const invocation = proxy.slice(proxy.indexOf('## Invocation'));
check('the invocation contract names api_key_env', invocation.includes('api_key_env'));
// Its companion: a key without the address it belongs to is not per-endpoint
// anything, and this template omitted the address too.
check('and names the endpoint the key belongs to', invocation.includes('endpoint:'));
// The name travels, not the secret — stated where whoever fills the template reads it.
check('and says the name travels, not the key',
  /variable's NAME, never the key/i.test(invocation));

// --- the bridge, asked rather than read -------------------------------------
const schemas = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [BRIDGE], { stdio: ['pipe', 'pipe', 'pipe'] });
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
        resolve(msg.result?.tools ?? []);
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
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
});

for (const name of ['chat', 'models']) {
  const tool = schemas.find((t) => t.name === name);
  check(`the built bundle offers ${name}`, Boolean(tool));
  check(`and ${name} accepts api_key_env`,
    Boolean(tool?.inputSchema?.properties?.api_key_env));
}

for (const f of failures) console.log('not ok:', f);
console.log(`AE-SUBJECTS: ${checked}`);
console.log(`${checked - failures.length}/${checked} links carry the credential`);
process.exit(failures.length === 0 ? 0 : 1);
