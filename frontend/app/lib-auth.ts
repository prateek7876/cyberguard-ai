export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cyberguard_token");
}

export function getUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cyberguard_email");
}

export function saveSession(token: string, email: string) {
  localStorage.setItem("cyberguard_token", token);
  localStorage.setItem("cyberguard_email", email);
}

export function clearSession() {
  localStorage.removeItem("cyberguard_token");
  localStorage.removeItem("cyberguard_email");
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}
