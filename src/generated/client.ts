// @ts-nocheck
// Generated on 2026-07-19T00:07:50.848Z by @knowledgeislands/mcp-ki-kb-notion-mirror@1.0.0
// Server: hnr-mcp-ki-kb-notion-mirror
// Source: /Users/krisbrown/.mcporter/mcporter.json
// Transport: STDIO /Users/krisbrown/.local/share/mise/installs/node/lts/bin/node /Users/krisbrown/workspaces/kis/knowledgeislands/mcp-ki-kb-notion-mirror/dist/mcp-server/index.js

import { createRuntime, createServerProxy, wrapCallResult } from 'mcporter';
import type { HnrMcpKiKbNotionMirrorTools } from './types';

type RuntimeInstance = Awaited<ReturnType<typeof createRuntime>>;
export type HnrMcpKiKbNotionMirrorClient = HnrMcpKiKbNotionMirrorTools & { close(): Promise<void> };

export interface CreateClientOptions {
  runtime?: RuntimeInstance;
  configPath?: string;
  rootDir?: string;
}

export async function createHnrMcpKiKbNotionMirrorClient(options: CreateClientOptions = {}): Promise<HnrMcpKiKbNotionMirrorClient> {
  const runtime = options.runtime ?? (await createRuntime({
    configPath: options.configPath,
    rootDir: options.rootDir,
  }));
  const ownsRuntime = !options.runtime;
  const proxy = createServerProxy(runtime, "hnr-mcp-ki-kb-notion-mirror");
  const client: HnrMcpKiKbNotionMirrorClient = {
    async kb_notion_mirror_note_get(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_get"]>[0]) {
      const tool = proxy.kbNotionMirrorNoteGet as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_get"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_note_status(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_status"]>[0]) {
      const tool = proxy.kbNotionMirrorNoteStatus as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_status"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_note_preflight(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_preflight"]>[0]) {
      const tool = proxy.kbNotionMirrorNotePreflight as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_preflight"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_note_touch(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_touch"]>[0]) {
      const tool = proxy.kbNotionMirrorNoteTouch as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_touch"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_note_update(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_update"]>[0]) {
      const tool = proxy.kbNotionMirrorNoteUpdate as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_update"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_note_move(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_move"]>[0]) {
      const tool = proxy.kbNotionMirrorNoteMove as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_move"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_note_delete(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_delete"]>[0]) {
      const tool = proxy.kbNotionMirrorNoteDelete as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_note_delete"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_tree_status(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_status"]>[0]) {
      const tool = proxy.kbNotionMirrorTreeStatus as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_status"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_tree_preflight(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_preflight"]>[0]) {
      const tool = proxy.kbNotionMirrorTreePreflight as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_preflight"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_tree_touch(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_touch"]>[0]) {
      const tool = proxy.kbNotionMirrorTreeTouch as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_touch"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_tree_update(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_update"]>[0]) {
      const tool = proxy.kbNotionMirrorTreeUpdate as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_update"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_tree_delete(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_delete"]>[0]) {
      const tool = proxy.kbNotionMirrorTreeDelete as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_delete"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_tree_prune(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_prune"]>[0]) {
      const tool = proxy.kbNotionMirrorTreePrune as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_tree_prune"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notion_mirror_roots_list(params: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_roots_list"]>[0]) {
      const tool = proxy.kbNotionMirrorRootsList as (args: Parameters<HnrMcpKiKbNotionMirrorTools["kb_notion_mirror_roots_list"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async close() {
      if (ownsRuntime) {
        await runtime.close("hnr-mcp-ki-kb-notion-mirror").catch(() => {});
      }
    },
  };
  return client;
}

