import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().default("Curly"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://curly:curly@127.0.0.1:5432/curly?schema=public"),
  SESSION_COOKIE_NAME: z.string().default("curly_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).default(14),
  JELLYFIN_URL: z.string().url().optional(),
  JELLYFIN_INTERNAL_URL: z.string().url().optional(),
  JELLYFIN_API_KEY: z.string().optional(),
  JELLYFIN_USER_ID: z.string().optional(),
  JELLYFIN_SERVER_NAME: z.string().default("Curly Media"),
  FILEBROWSER_URL: z.string().url().optional(),
  FILEBROWSER_INTERNAL_URL: z.string().url().optional(),
  FILEBROWSER_PROXY_PATH: z.string().default("/api/files"),
  MEDIA_ROOT: z.string().default("/srv/curly/media"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  jellyfinBaseUrl: parsed.data.JELLYFIN_INTERNAL_URL ?? parsed.data.JELLYFIN_URL,
  filebrowserBaseUrl:
    parsed.data.FILEBROWSER_INTERNAL_URL ?? parsed.data.FILEBROWSER_URL,
};
