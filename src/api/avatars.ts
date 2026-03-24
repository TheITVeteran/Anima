type ApiResponse<T> = {
  code?: number;
  data?: T;
  msg?: string;
};

type AvatarsListPayload = {
  orderByColumn?: string;
  isAsc?: "asc" | "desc";
  nickname?: string;
};

type TtsUpdatePayload = {
  avatarsId: string;
  languageId: string | number;
  ttsId?: string | number | null;
  action: "add" | "remove";
};

type AudioListPayload = {
  languageId?: string | number;
};

const DEFAULT_API_BASE_URL = "https://sumi-test.sumeruai.com";

const getApiBaseUrl = () => {
  const runtimeBaseUrl = (window as any)?.BaseConfig?.apiBaseUrl as string | undefined;
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return runtimeBaseUrl || envBaseUrl || DEFAULT_API_BASE_URL;
};

const getToken = () => {
  try {
    const raw = localStorage.getItem("userStore");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { userToken?: string };
    return parsed.userToken || "";
  } catch {
    return "";
  }
};

const withAuthHeaders = (headers?: Record<string, string>) => {
  const token = getToken();
  return {
    ...(headers || {}),
    ...(token ? { Authorization: token } : {}),
  };
};

const preGeneration = async (payload: { nickname: string }) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/pre/generation`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<string>;
};

const preCustomizeGeneration = async (payload: { nickname: string }) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/pre/customize/generation`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<string>;
};

const avatarsUpdate = async (payload: Record<string, unknown>) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/update`, {
    method: "PUT",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<unknown>;
};

const ttsUpdate = async (payload: TtsUpdatePayload) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/tts/update`, {
    method: "PUT",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<unknown>;
};

const avatarsLookUpload = async (formData: FormData) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/upload`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<string>;
};

const validateImage = async (formData: FormData) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/validate/image`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<boolean>;
};

const getAvatarById = async (id: string) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/get/${id}`, {
    method: "GET",
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<Record<string, unknown>>;
};

const avatarsList = async (payload: AvatarsListPayload = {}) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/list`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<{
    userAvatarsList?: Array<Record<string, unknown>>;
    list?: Array<Record<string, unknown>>;
  }>;
};

const avatarsDelete = async (id: string) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/avatars/delete/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<unknown>;
};

const audioLanguageList = async () => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/audio/language/list`, {
    method: "GET",
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<
    Array<{
      id?: string | number;
      code?: string;
      name?: string;
      defaultVoiceId?: string | number;
    }>
  >;
};

const audioList = async (payload: AudioListPayload = {}) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/audio/list`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<Array<Record<string, unknown>>>;
};

type TtsTransformPayload = {
  content: string;
  voiceId: number;
};

type TtsTransformResult = {
  id?: number;
  status?: string;
  audioLen?: number;
  audioUrl?: string;
  audioBase64?: string;
};

const ttsTransform = async (payload: TtsTransformPayload) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/tts/transform`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<TtsTransformResult>;
};

type AtfDtPayload = {
  status: "start" | "middle" | "end";
  dialogueBase64: string;
  lastDialogueBase64: string;
  modelId: string;
  traceId: string;
};

type AtfDtResult = {
  ABI?: string;
  AK?: string;
  API?: string;
  ATI?: string;
  arkit_use_postprocess?: boolean;
  fps?: number;
  modelId?: string;
  num_frames?: number;
  audio?: string;
  content?: string;
};

const atfDt = async (payload: AtfDtPayload) => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/atf/dt`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<AtfDtResult>;
};

type AsrResult = {
  id?: number;
  text?: string;
  audio?: string;
};

const asrBase64 = async (audioBase64: string): Promise<ApiResponse<AsrResult>> => {
  const token = JSON.parse(localStorage.getItem("userStore") || "{}").userToken || "";
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/asr/base64`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ audioBase64 }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<AsrResult>;
};

export {
  asrBase64,
  atfDt,
  avatarsUpdate,
  ttsUpdate,
  ttsTransform,
  avatarsList,
  avatarsDelete,
  audioLanguageList,
  audioList,
  avatarsLookUpload,
  getApiBaseUrl,
  getAvatarById,
  preGeneration,
  preCustomizeGeneration,
  validateImage,
};
