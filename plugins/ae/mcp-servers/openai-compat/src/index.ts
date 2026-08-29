#!/usr/bin/env node
// ae-openai-compat — one MCP bridge for every OpenAI-compatible backend.
//
// Endpoint and model are chosen per call, so adding a backend is configuration rather
// than a new server: oMLX, Ollama, LM Studio, vLLM, DeepSeek and Google's compat layer
// all speak this shape. The three properties AE conflated into one name are kept apart
// here — `family` is the weight lineage that makes a second opinion worth having,
// `endpoint` is how it is reached, and where it runs is a property of the endpoint.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { FINDINGS_CONTRACT, checkFindings } from "../../shared/findings-contract.js";

type Msg = { role: "system" | "user" | "assistant"; content: string };

interface Session {
  id: string;
  family: string;
  endpoint: string;
  model: string;
  /** The variable this session's credential is read from, if the caller named one.
   *  A session belongs to one endpoint, so the credential belongs to the session:
   *  without this, the first turn is authenticated per endpoint and every later
   *  turn falls back to the process-wide key. */
  apiKeyEnv?: string;
  history: Msg[];
  lastUsed: number;
}

/** A plugin option the user never set arrives as the literal `${CLAUDE_PLUGIN_OPTION_…}`
 *  rather than as an empty string, so a naive `|| default` keeps the placeholder and an
 *  unset API key reads as configured. Treat any surviving `${…}` as unset. */
function env(name: string): string {
  const v = process.env[name];
  if (!v || /^\$\{.*\}$/.test(v.trim())) return "";
  return v;
}

/** Read a plugin option here rather than through the manifest's `env` block. A
 *  `${CLAUDE_PLUGIN_OPTION_…}` written into a manifest is validated when the plugin is
 *  installed, and an unresolved one rejects the whole server — so an option that exists only
 *  as a declared default takes the bridge down instead of supplying its default. Read from
 *  this process it degrades to the default, which is how the bundled Gemini bridge reads its
 *  model options. `AE_*` wins so the bridge stays drivable outside a plugin host, where no
 *  plugin option exists at all. */
function setting(aeVar: string, optionVar: string): string {
  return env(aeVar) || env(optionVar);
}

const DEFAULT_ENDPOINT =
  setting("AE_OPENAI_COMPAT_ENDPOINT", "CLAUDE_PLUGIN_OPTION_OPENAI_COMPAT_ENDPOINT") ||
  "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = setting("AE_OPENAI_COMPAT_MODEL", "CLAUDE_PLUGIN_OPTION_OPENAI_COMPAT_MODEL");
const DEFAULT_FAMILY =
  setting("AE_OPENAI_COMPAT_FAMILY", "CLAUDE_PLUGIN_OPTION_OPENAI_COMPAT_FAMILY") || "unknown";

/** Deliberately not a plugin option: one key here is sent to every endpoint the caller names,
 *  including local ones that never asked for credentials (`BL-214`). Promoting it to a
 *  configurable field would advertise that shape as supported. A per-endpoint key belongs to
 *  the per-entry `api_key_env` the `cross_family` table declares — which is what a caller
 *  naming `api_key_env` reaches. This one remains the fallback for a caller that names none,
 *  so no existing configuration changes behaviour. */
const API_KEY = env("AE_OPENAI_COMPAT_API_KEY");
const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = Number(env("AE_OPENAI_COMPAT_TIMEOUT_MS") || 120_000);

const sessions = new Map<string, Session>();

/** The credential for one call, chosen by the variable the caller named.
 *
 *  Naming a variable that is unset sends **no** authorization header — it does not
 *  fall back to the process-wide key. Falling back would be the defect this exists
 *  to remove wearing another name: the caller has said which credential this
 *  endpoint takes, and the answer to "that one is not configured" is to send none,
 *  not to send a different backend's. */
function headers(apiKeyEnv?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const key = apiKeyEnv ? env(apiKeyEnv) : API_KEY;
  if (key) h["authorization"] = `Bearer ${key}`;
  return h;
}

/** Reasoning effort is passed through when asked for and never silently dropped:
 *  the caller is told what was sent, because whether a backend applied it is not
 *  observable from the response. Claiming more than that would be the same
 *  overstatement this bridge exists to avoid. */
type ReasoningReport = {
  requested: string | null;
  sent: boolean;
  note: string;
};

async function callChat(
  endpoint: string,
  model: string,
  messages: Msg[],
  reasoningEffort?: string,
  apiKeyEnv?: string,
): Promise<{ content: string; reasoning: ReasoningReport; raw_id: string | null }> {
  const body: Record<string, unknown> = { model, messages };
  let sent = false;
  if (reasoningEffort) {
    body.reasoning_effort = reasoningEffort;
    sent = true;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: headers(apiKeyEnv),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "connection";
    throw new Error(`${reason}: ${endpoint} — ${err instanceof Error ? err.message : String(err)}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // A rejected reasoning_effort is a real outcome, not a detail to swallow: retrying
    // without it would silently downgrade the request the caller asked for.
    throw new Error(
      `http ${res.status} from ${endpoint} (model=${model}${sent ? ", reasoning_effort sent" : ""}): ${text.slice(0, 400)}`,
    );
  }

  const data = (await res.json()) as any;
  const choice = data?.choices?.[0];
  const content: string | undefined = choice?.message?.content;
  if (typeof content !== "string" || content === "") {
    throw new Error(
      `empty completion from ${endpoint} (model=${model}); finish_reason=${choice?.finish_reason ?? "?"}`,
    );
  }

  // DeepSeek-R1-class backends put chain-of-thought in a side-channel field outside the
  // OpenAI schema. Surface its presence without inlining it into the answer.
  const sideChannel = typeof choice?.message?.reasoning_content === "string";

  return {
    content,
    reasoning: {
      requested: reasoningEffort ?? null,
      sent,
      note: sent
        ? `reasoning_effort=${reasoningEffort} was sent; whether the backend applied it is not observable from the response`
        : sideChannel
          ? "no reasoning_effort requested; backend returned reasoning_content (reasons unconditionally)"
          : "no reasoning_effort requested",
    },
    raw_id: typeof data?.id === "string" ? data.id : null,
  };
}

function cleanup(): void {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.lastUsed > SESSION_TTL_MS) sessions.delete(id);
}

const server = new McpServer({ name: "ae-openai-compat", version: "0.1.0" });

server.tool(
  "chat",
  "Start a conversation with an OpenAI-compatible backend. Endpoint and model are per call, so one server reaches any number of backends.",
  {
    prompt: z.string().describe("The prompt to send"),
    model: z.string().optional().describe("Model id; defaults to AE_OPENAI_COMPAT_MODEL"),
    endpoint: z.string().optional().describe("OpenAI-compatible base URL ending in /v1"),
    family: z
      .string()
      .optional()
      .describe("Weight lineage of this model (e.g. qwen, deepseek, llama) — NOT the host it runs on"),
    api_key_env: z.string().optional().describe(
      "Name of the environment variable holding this backend's API key — the `api_key_env` its `cross_family` entry declares. The name travels, never the secret. Named and unset means no credential is sent, not the process-wide one.",
    ),
    system: z.string().optional().describe("System instruction"),
    reasoning_effort: z
      .enum(["minimal", "low", "medium", "high"])
      .optional()
      .describe("Passed through as reasoning_effort; rejected by backends that do not support it"),
    expect: z
      .enum(["findings"])
      .optional()
      .describe(
        "Output contract to state to the backend and validate the reply against. 'findings' = AE's review findings shape. A non-compliant reply is reported as such and returned unchanged — never reshaped.",
      ),
  },
  async ({ prompt, model, endpoint, family, system, reasoning_effort, expect, api_key_env }) => {
    const ep = endpoint || DEFAULT_ENDPOINT;
    const mdl = model || DEFAULT_MODEL;
    if (!mdl) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "no model: pass `model` or set AE_OPENAI_COMPAT_MODEL" }],
      };
    }
    const history: Msg[] = [];
    // The contract goes in the system role, appended to whatever role line the caller set. A
    // contract buried at the end of a long user prompt competes with the task for attention.
    const sys = expect === "findings" ? [system, FINDINGS_CONTRACT].filter(Boolean).join("\n\n") : system;
    if (sys) history.push({ role: "system", content: sys });
    history.push({ role: "user", content: prompt });

    try {
      const { content, reasoning, raw_id } = await callChat(ep, mdl, history, reasoning_effort, api_key_env);
      history.push({ role: "assistant", content });
      const id = randomUUID();
      sessions.set(id, {
        id,
        family: family || DEFAULT_FAMILY,
        endpoint: ep,
        model: mdl,
        apiKeyEnv: api_key_env,
        history,
        lastUsed: Date.now(),
      });

      // `content` is returned verbatim in every branch. On non-compliance the caller gets the
      // reason AND the untouched reply, so it can report the gap and quote what was actually
      // said — the two things the relay rule asks for.
      const compliance = expect === "findings" ? checkFindings(content) : undefined;
      return {
        isError: compliance ? !compliance.compliant : false,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                session_id: id,
                family: family || DEFAULT_FAMILY,
                endpoint: ep,
                model: mdl,
                response_id: raw_id,
                reasoning,
                ...(compliance
                  ? compliance.compliant
                    ? { contract: "findings", compliant: true, findings: compliance.findings }
                    : { contract: "findings", compliant: false, violations: compliance.violations }
                  : {}),
                content,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
      };
    }
  },
);

server.tool(
  "reply",
  "Continue an existing conversation by session id.",
  {
    session_id: z.string().describe("session_id returned by chat"),
    prompt: z.string().describe("Next prompt"),
    model: z.string().optional().describe("Override the model for this turn"),
    reasoning_effort: z.enum(["minimal", "low", "medium", "high"]).optional(),
  },
  async ({ session_id, prompt, model, reasoning_effort }) => {
    const s = sessions.get(session_id);
    if (!s) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `session not found: ${session_id}` }],
      };
    }
    const mdl = model || s.model;
    s.history.push({ role: "user", content: prompt });
    try {
      const { content, reasoning, raw_id } = await callChat(s.endpoint, mdl, s.history, reasoning_effort, s.apiKeyEnv);
      s.history.push({ role: "assistant", content });
      s.lastUsed = Date.now();
      if (model) s.model = model;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { session_id, family: s.family, endpoint: s.endpoint, model: mdl, response_id: raw_id, turns: s.history.length, reasoning, content },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      s.history.pop(); // a failed turn must not poison the transcript
      return {
        isError: true,
        content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
      };
    }
  },
);

server.tool(
  "models",
  "List models an OpenAI-compatible endpoint currently serves.",
  {
    endpoint: z.string().optional(),
    api_key_env: z.string().optional().describe(
      "Name of the environment variable holding this backend's API key — the `api_key_env` its `cross_family` entry declares. The name travels, never the secret. Named and unset means no credential is sent, not the process-wide one.",
    ),
  },
  async ({ endpoint, api_key_env }) => {
    const ep = endpoint || DEFAULT_ENDPOINT;
    try {
      const res = await fetch(`${ep.replace(/\/$/, "")}/models`, { headers: headers(api_key_env) });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = (await res.json()) as any;
      const list = (data?.data ?? []).map((m: any) => ({
        id: m.id,
        owned_by: m.owned_by,
        max_model_len: m.max_model_len,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify({ endpoint: ep, models: list }, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `models failed at ${ep}: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.tool("info", "Report this bridge's defaults and live sessions.", {}, async () => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          server: "ae-openai-compat",
          default_endpoint: DEFAULT_ENDPOINT,
          default_model: DEFAULT_MODEL || null,
          default_family: DEFAULT_FAMILY,
          api_key_configured: Boolean(API_KEY),
          request_timeout_ms: REQUEST_TIMEOUT_MS,
          live_sessions: sessions.size,
          note: "family is the weight lineage; endpoint is where it is reached. They are separate on purpose.",
        },
        null,
        2,
      ),
    },
  ],
}));

async function main(): Promise<void> {
  const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  timer.unref?.();
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Failed to start ae-openai-compat MCP server:", err);
  process.exit(1);
});
