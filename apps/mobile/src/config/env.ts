const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export const API_BASE_URL = configuredApiUrl || (__DEV__ ? "http://10.0.2.2:3001" : null);
export const hasApiConfiguration = API_BASE_URL !== null;
