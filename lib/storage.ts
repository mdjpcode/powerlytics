import { Credentials } from "@/lib/types";

const STORAGE_KEY = "powerlytics.credentials";

export function loadSavedCredentials(): Credentials | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Credentials;
    return parsed;
  } catch {
    return null;
  }
}

export function persistCredentials(credentials: Credentials) {
  if (typeof window === "undefined") return;
  if (!credentials.saveForNextTime) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}
