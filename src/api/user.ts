type LoginRequest = {
  mailbox: string;
  password: string;
};

type RegisterRequest = {
  nickname: string;
  mailbox: string;
  password: string;
  invitationUserId: number;
  productType?: string;
};

type LoginUser = {
  id?: string;
  mailbox?: string;
  [key: string]: unknown;
};

type LoginResponseData = {
  accessToken?: string;
  user?: LoginUser;
};

type ApiResponse<T> = {
  code?: number;
  data?: T;
  msg?: string;
};

type SavedAuth = {
  mailbox: string;
  password: string;
};

const AUTH_CACHE_KEY = "animaAuth";
const DEFAULT_API_BASE_URL = "https://sumi.sumeruai.com";

const getApiBaseUrl = () => {
  const runtimeBaseUrl = (window as any)?.BaseConfig?.apiBaseUrl as string | undefined;
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return runtimeBaseUrl || envBaseUrl || DEFAULT_API_BASE_URL;
};

const login = async (payload: LoginRequest): Promise<ApiResponse<LoginResponseData>> => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as ApiResponse<LoginResponseData>;
};

const register = async (payload: RegisterRequest): Promise<ApiResponse<LoginResponseData>> => {
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/user/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as ApiResponse<LoginResponseData>;
};

const isSuccessCode = (code?: number) => code === 200 || code === 0;

const persistUserSession = (data?: LoginResponseData) => {
  if (!data) return;
  localStorage.setItem(
    "userStore",
    JSON.stringify({
      userToken: data.accessToken ?? "",
      userData: data.user ?? {},
    }),
  );
};

const saveAuthCredentials = (payload: SavedAuth) => {
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
};

const getSavedAuthCredentials = (): SavedAuth | null => {
  const raw = localStorage.getItem(AUTH_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedAuth;
    if (!parsed?.mailbox || !parsed?.password) return null;
    return parsed;
  } catch {
    return null;
  }
};

const clearAuthCredentials = () => {
  localStorage.removeItem(AUTH_CACHE_KEY);
};

export {
  clearAuthCredentials,
  getSavedAuthCredentials,
  isSuccessCode,
  login,
  persistUserSession,
  register,
  saveAuthCredentials,
};
