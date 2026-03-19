#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// --- Types ---

interface Message {
  role: "user" | "model";
  text: string;
}

interface Session {
  id: string;
  model: string;
  systemPrompt?: string;
  history: Message[];
  createdAt: number;
  lastAccessedAt: number;
}

interface OAuthCreds {
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  access_token?: string;
  expiry_date?: number;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// --- Config ---

const DEFAULT_MODEL = "gemini-2.5-flash";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

// --- State ---

const sessions = new Map<string, Session>();
let oauthCreds: OAuthCreds | null = null;
let tokenCache: TokenCache | null = null;
let authMode: "api_key" | "oauth" | "none" = "none";
let sdkClient: GoogleGenAI | null = null;

// --- Auth ---

async function loadOAuthCreds(): Promise<OAuthCreds | null> {
  try {
    const raw = await readFile(
      join(homedir(), ".gemini", "oauth_creds.json"),
      "utf-8"
    );
    const parsed = JSON.parse(raw);
    // Support both formats: gemini CLI (access_token + refresh_token) and full OAuth (client_id + client_secret + refresh_token)
    if (parsed.access_token || (parsed.client_id && parsed.client_secret && parsed.refresh_token)) {
      return parsed as OAuthCreds;
    }
    return null;
  } catch {
    return null;
  }
}

async function getAccessToken(creds: OAuthCreds): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  // If we have client_id/secret, we can refresh the token
  if (creds.client_id && creds.client_secret && creds.refresh_token) {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!resp.ok) {
      throw new Error(
        `OAuth token refresh failed: ${resp.status} ${await resp.text()}`
      );
    }

    const data = (await resp.json()) as {
      access_token: string;
      expires_in: number;
    };
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return tokenCache.accessToken;
  }

  // Gemini CLI format: use access_token directly (no refresh capability)
  if (creds.access_token) {
    const expiresAt = creds.expiry_date ?? Date.now() + 3600_000;
    tokenCache = {
      accessToken: creds.access_token,
      expiresAt,
    };
    return tokenCache.accessToken;
  }

  throw new Error("No valid token or refresh credentials found");
}

async function initAuth(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    sdkClient = new GoogleGenAI({ apiKey });
    authMode = "api_key";
    return;
  }

  oauthCreds = await loadOAuthCreds();
  if (oauthCreds) {
    const token = await getAccessToken(oauthCreds);
    sdkClient = new GoogleGenAI({
      apiKey: "OAUTH_PLACEHOLDER",
      httpOptions: { headers: { Authorization: `Bearer ${token}` } },
    });
    authMode = "oauth";
    return;
  }

  throw new Error(
    "No Gemini credentials found. Set GEMINI_API_KEY env var or run `gemini auth`."
  );
}

// --- Gemini API ---

async function callGemini(
  model: string,
  history: Message[],
  systemPrompt?: string
): Promise<string> {
  if (authMode === "api_key" && sdkClient) {
    return callGeminiSDK(model, history, systemPrompt);
  }
  return callGeminiREST(model, history, systemPrompt);
}

async function callGeminiSDK(
  model: string,
  history: Message[],
  systemPrompt?: string
): Promise<string> {
  const contents = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const response = await sdkClient!.models.generateContent({
    model,
    contents,
    ...(systemPrompt
      ? { config: { systemInstruction: systemPrompt } }
      : {}),
  });

  return response.text ?? "(empty response)";
}

async function callGeminiREST(
  model: string,
  history: Message[],
  systemPrompt?: string
): Promise<string> {
  const token = await getAccessToken(oauthCreds!);

  const body: Record<string, unknown> = {
    contents: history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    throw new Error(`Gemini API error: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";
}

// --- Session Management ---

function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// --- MCP Server ---

const server = new McpServer({
  name: "ae-gemini",
  version: "0.2.0",
});

// Tool 1: chat — start a new conversation (like codex's `codex` tool)
server.registerTool(
  "chat",
  {
    title: "Gemini Chat",
    description:
      "Start a new Gemini conversation. Returns a sessionId for multi-turn follow-ups via `reply`. Used for cross-family code review, analysis, and second opinions.",
    inputSchema: z.object({
      prompt: z.string().describe("The prompt to send to Gemini"),
      model: z
        .string()
        .default(DEFAULT_MODEL)
        .describe("Gemini model (e.g., gemini-2.5-flash, gemini-2.5-pro)"),
      systemPrompt: z
        .string()
        .optional()
        .describe(
          "System instruction that persists across the entire conversation"
        ),
    }),
  },
  async ({ prompt, model, systemPrompt }) => {
    try {
      const history: Message[] = [{ role: "user", text: prompt }];
      const responseText = await callGemini(model, history, systemPrompt);

      history.push({ role: "model", text: responseText });

      const session: Session = {
        id: randomUUID(),
        model,
        systemPrompt,
        history,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      sessions.set(session.id, session);

      return {
        content: [
          {
            type: "text" as const,
            text: `[sessionId: ${session.id}]\n[model: ${model}]\n\n${responseText}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: reply — continue an existing conversation (like codex's `codex-reply`)
server.registerTool(
  "reply",
  {
    title: "Gemini Reply",
    description:
      "Continue an existing Gemini conversation. Requires a sessionId from a prior `chat` call. Supports switching models mid-conversation.",
    inputSchema: z.object({
      sessionId: z.string().describe("Session ID from a prior `chat` call"),
      prompt: z.string().describe("The next message in the conversation"),
      model: z
        .string()
        .optional()
        .describe(
          "Override model for this turn (e.g., switch to gemini-2.5-pro for deeper analysis)"
        ),
    }),
  },
  async ({ sessionId, prompt, model }) => {
    try {
      const session = sessions.get(sessionId);
      if (!session) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Session ${sessionId} not found. It may have expired (TTL: 30 min). Start a new conversation with \`chat\`.`,
            },
          ],
          isError: true,
        };
      }

      const useModel = model ?? session.model;
      if (model) {
        session.model = model; // persist model switch
      }

      session.history.push({ role: "user", text: prompt });
      const responseText = await callGemini(
        useModel,
        session.history,
        session.systemPrompt
      );
      session.history.push({ role: "model", text: responseText });
      session.lastAccessedAt = Date.now();

      return {
        content: [
          {
            type: "text" as const,
            text: `[sessionId: ${session.id}]\n[model: ${useModel}]\n[turn: ${Math.floor(session.history.length / 2)}]\n\n${responseText}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// Tool 3: info — server status + active sessions
server.registerTool(
  "info",
  {
    title: "Server Info",
    description:
      "Show Gemini MCP server status: auth mode, active sessions, and configuration.",
    inputSchema: z.object({}),
  },
  async () => {
    cleanupSessions();
    const sessionList = [...sessions.values()].map((s) => ({
      id: s.id,
      model: s.model,
      turns: Math.floor(s.history.length / 2),
      age: `${Math.round((Date.now() - s.createdAt) / 1000)}s`,
      idle: `${Math.round((Date.now() - s.lastAccessedAt) / 1000)}s`,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              version: "0.2.0",
              authMode,
              defaultModel: DEFAULT_MODEL,
              activeSessions: sessions.size,
              sessionTTL: "30m",
              sessions: sessionList,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- Main ---

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

async function shutdown(): Promise<void> {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  sessions.clear();
  await server.close();
  process.exit(0);
}

async function main(): Promise<void> {
  await initAuth();

  cleanupTimer = setInterval(cleanupSessions, CLEANUP_INTERVAL_MS);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start ae-gemini MCP server:", err);
  process.exit(1);
});
