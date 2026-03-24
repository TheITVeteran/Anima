type ApiResponse<T> = {
  code?: number;
  data?: T;
  msg?: string;
};

const DEFAULT_API_BASE_URL = "https://sumi.sumeruai.com";

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

const modelGenerate = async (formData: FormData) => {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}/web-api/portrait/model/generate`, {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: formData,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ApiResponse<unknown>;
};

export { modelGenerate };
