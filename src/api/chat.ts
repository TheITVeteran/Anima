type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenClawChatOptions = {
  messages: ChatMessage[];
  agentId?: string;
  stream?: boolean;
  onChunk?: (text: string) => void;
  onDone?: (fullText: string) => void | Promise<void>;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
};

const getChatApiUrl = (): string => {
  const runtime = (window as any)?.BaseConfig?.chatApiUrl as string | undefined;
  if (runtime) return runtime;
  return "/api/chat";
};

const openclawChat = async (options: OpenClawChatOptions): Promise<string> => {
  const { messages, agentId, stream = true, onChunk, onDone, onError, signal } = options;
  const url = getChatApiUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, agentId, stream }),
    signal,
  });

  if (!response.ok) {
    const err = new Error(`Chat API error: ${response.status}`);
    onError?.(err);
    throw err;
  }

  if (!stream) {
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    onChunk?.(text);
    await onDone?.(text);
    return text;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const err = new Error("No readable stream");
    onError?.(err);
    throw err;
  }

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onChunk?.(fullText);
        }
      } catch {
        // skip non-JSON lines
      }
    }
  }

  await onDone?.(fullText);
  return fullText;
};

type OpenClawAgent = {
  id: string;
  name: string;
  identityName?: string;
  identityEmoji?: string;
  owned_by?: string;
  isDefault?: boolean;
};

const fetchOpenClawAgents = async (): Promise<OpenClawAgent[]> => {
  try {
    const res = await fetch("/api/agents");
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      id: String(item?.id ?? ""),
      name: String(item?.name || item?.identityName || item?.id || ""),
      identityName: item?.identityName ? String(item.identityName) : undefined,
      identityEmoji: item?.identityEmoji ? String(item.identityEmoji) : undefined,
      owned_by: String(item?.model || item?.owned_by || ""),
      isDefault: Boolean(item?.isDefault),
    }));
  } catch {
    return [];
  }
};

type CreateAgentParams = {
  id: string;
  identityName?: string;
  identityEmoji?: string;
  persona?: string;
  systemPrompt?: string;
};

type CreateAgentResult = {
  code: number;
  msg: string;
  data?: { id: string; steps: { step: string; status: string }[]; agents: any[] };
};

const createOpenClawAgent = async (params: CreateAgentParams): Promise<CreateAgentResult> => {
  try {
    const res = await fetch("/api/agents/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await res.json()) as CreateAgentResult;
  } catch (err: any) {
    return { code: 500, msg: err?.message || "Network error" };
  }
};

const deleteOpenClawAgent = async (agentId: string): Promise<{ code: number; msg: string }> => {
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" });
    return await res.json();
  } catch (err: any) {
    return { code: 500, msg: err?.message || "Network error" };
  }
};

const syncOpenClawAgents = async (): Promise<OpenClawAgent[]> => {
  try {
    const res = await fetch("/api/agents/sync", { method: "POST" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      id: String(item?.id ?? ""),
      name: String(item?.name || item?.identityName || item?.id || ""),
      identityName: item?.identityName ? String(item.identityName) : undefined,
      identityEmoji: item?.identityEmoji ? String(item.identityEmoji) : undefined,
      owned_by: String(item?.model || item?.owned_by || ""),
      isDefault: Boolean(item?.isDefault),
    }));
  } catch {
    return [];
  }
};

export { openclawChat, getChatApiUrl, fetchOpenClawAgents, createOpenClawAgent, deleteOpenClawAgent, syncOpenClawAgents };
export type { ChatMessage, OpenClawChatOptions, OpenClawAgent, CreateAgentParams, CreateAgentResult };
