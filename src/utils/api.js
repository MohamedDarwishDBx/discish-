export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://127.0.0.1:8000");
export const WS_URL = API_URL.replace(/^http/, "ws");
export const TOKEN_KEY = "discord_clone_token";

export async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = detail?.detail || "Request failed";
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
