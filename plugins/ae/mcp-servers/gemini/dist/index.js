#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
// --- Config ---
const FALLBACK_MODEL = "gemini-2.5-flash";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
// --- State ---
const sessions = new Map();
let sdkClient = null;
let cachedModels = [];
// --- Auth ---
async function initAuth() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    sdkClient = new GoogleGenAI({ apiKey });
}
// --- Model Discovery ---
async function discoverModels() {
    try {
        const pager = await sdkClient.models.list();
        const models = [];
        for await (const model of pager) {
            if (model.name) {
                models.push({
                    name: model.name.replace(/^models\//, ""),
                    displayName: model.displayName ?? model.name,
                    inputTokenLimit: model.inputTokenLimit,
                    outputTokenLimit: model.outputTokenLimit,
                });
            }
        }
        cachedModels = models;
    }
    catch {
        // Non-fatal: if model listing fails, we still work with user-specified models
        cachedModels = [];
    }
}
// --- Gemini API ---
async function callGemini(model, history, systemPrompt) {
    return callGeminiSDK(model, history, systemPrompt);
}
async function callGeminiSDK(model, history, systemPrompt) {
    const contents = history.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
    }));
    const response = await sdkClient.models.generateContent({
        model,
        contents,
        ...(systemPrompt ? { config: { systemInstruction: systemPrompt } } : {}),
    });
    return response.text ?? "(empty response)";
}
// --- Session Management ---
function cleanupSessions() {
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
server.registerTool("chat", {
    title: "Gemini Chat",
    description: "Start a new Gemini conversation. Returns a sessionId for multi-turn follow-ups via `reply`. Call `models` first to see available models. Used for cross-family code review, analysis, and second opinions.",
    inputSchema: z.object({
        prompt: z.string().describe("The prompt to send to Gemini"),
        model: z
            .string()
            .default(FALLBACK_MODEL)
            .describe("Gemini model (e.g., gemini-2.5-flash, gemini-2.5-pro)"),
        systemPrompt: z
            .string()
            .optional()
            .describe("System instruction that persists across the entire conversation"),
    }),
}, async ({ prompt, model, systemPrompt }) => {
    try {
        const history = [{ role: "user", text: prompt }];
        const responseText = await callGemini(model, history, systemPrompt);
        history.push({ role: "model", text: responseText });
        const session = {
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
                    type: "text",
                    text: `[sessionId: ${session.id}]\n[model: ${model}]\n\n${responseText}`,
                },
            ],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Tool 2: reply — continue an existing conversation (like codex's `codex-reply`)
server.registerTool("reply", {
    title: "Gemini Reply",
    description: "Continue an existing Gemini conversation. Requires a sessionId from a prior `chat` call. Supports switching models mid-conversation.",
    inputSchema: z.object({
        sessionId: z.string().describe("Session ID from a prior `chat` call"),
        prompt: z.string().describe("The next message in the conversation"),
        model: z
            .string()
            .optional()
            .describe("Override model for this turn (e.g., switch to gemini-2.5-pro for deeper analysis)"),
    }),
}, async ({ sessionId, prompt, model }) => {
    try {
        const session = sessions.get(sessionId);
        if (!session) {
            return {
                content: [
                    {
                        type: "text",
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
        const responseText = await callGemini(useModel, session.history, session.systemPrompt);
        session.history.push({ role: "model", text: responseText });
        session.lastAccessedAt = Date.now();
        return {
            content: [
                {
                    type: "text",
                    text: `[sessionId: ${session.id}]\n[model: ${useModel}]\n[turn: ${Math.floor(session.history.length / 2)}]\n\n${responseText}`,
                },
            ],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Tool 3: models — list available models
server.registerTool("models", {
    title: "List Models",
    description: "List all available Gemini models with their capabilities. Use this to discover which models are available before calling chat/reply.",
    inputSchema: z.object({
        refresh: z
            .boolean()
            .default(false)
            .describe("Re-fetch models from API instead of using cache"),
    }),
}, async ({ refresh }) => {
    if (refresh || cachedModels.length === 0) {
        await discoverModels();
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    defaultModel: FALLBACK_MODEL,
                    availableModels: cachedModels.map((m) => ({
                        name: m.name,
                        displayName: m.displayName,
                        inputTokenLimit: m.inputTokenLimit,
                        outputTokenLimit: m.outputTokenLimit,
                    })),
                }, null, 2),
            },
        ],
    };
});
// Tool 4: info — server status + active sessions
server.registerTool("info", {
    title: "Server Info",
    description: "Show Gemini MCP server status: auth mode, active sessions, and configuration.",
    inputSchema: z.object({}),
}, async () => {
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
                type: "text",
                text: JSON.stringify({
                    version: "0.2.0",
                    authMode: "api_key",
                    defaultModel: FALLBACK_MODEL,
                    availableModels: cachedModels.length,
                    activeSessions: sessions.size,
                    sessionTTL: "30m",
                    sessions: sessionList,
                }, null, 2),
            },
        ],
    };
});
// --- Main ---
let cleanupTimer = null;
async function shutdown() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    sessions.clear();
    await server.close();
    process.exit(0);
}
async function main() {
    await initAuth();
    await discoverModels();
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
//# sourceMappingURL=index.js.map