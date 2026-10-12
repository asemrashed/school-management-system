import { loadEnv, createMessagingProviders, createStorageProvider } from "@packages/config";

export const env = loadEnv();
export const messaging = createMessagingProviders(env);
export const storage = createStorageProvider(env);
