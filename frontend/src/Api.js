export const API_URL = "http://127.0.0.1:8000";

const TOKEN_KEY = "spendwise_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Turns FastAPI error bodies (string detail or 422 validation list)
// into a single readable message.
export async function readError(response, fallback = "Something went wrong") {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      const field = first.loc?.[first.loc.length - 1];
      const msg = (first.msg || "").replace(/^Value error, /, "");
      return field ? `${capitalize(String(field))}: ${msg}` : msg;
    }
  } catch {
    // body was not JSON
  }
  return fallback;
}

// fetch() that automatically attaches the login token.
// On a 401 it clears the token and tells the app to show the login page.
export async function authFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("auth:logout"));
    throw new Error("Session expired. Please log in again.");
  }

  return response;
}

// Public call to /auth/login or /auth/register
export async function authRequest(mode, body) {
  let response;
  try {
    response = await fetch(`${API_URL}/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  if (!response.ok) {
    throw new Error(await readError(response, "Authentication failed"));
  }
  return response.json(); // { access_token, token_type, user }
}