import { z } from 'zod';

// IMPORTANT: do NOT import `serverEnv` from any client module.
// Client bundles do not have access to non-NEXT_PUBLIC_ env vars and
// importing this object on the client will throw at access time.
//
// Both env objects are lazily validated: parsing is deferred until the
// first property read so that `next build` (which executes module code
// during page-data collection) does not require runtime secrets.

const publicSchema = z.object({
  CLOUD_NAME: z.string().min(1, 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is required'),
  UPLOAD_PRESET: z
    .string()
    .min(1, 'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET is required'),
  UPLOAD_PRESET_VIDEO: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  WEDDING_TAG: z.string().min(1).default('noa-2026'),
  MAX_UPLOADS_PER_USER: z.coerce.number().int().positive().default(15),
});

const serverSchema = z.object({
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z
    .string()
    .min(1, 'CLOUDINARY_API_SECRET is required'),
  ADMIN_KEY: z.string().min(1, 'ADMIN_KEY is required'),
});

type PublicEnv = z.infer<typeof publicSchema>;
type ServerEnv = z.infer<typeof serverSchema>;

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

function parsePublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;
  cachedPublicEnv = publicSchema.parse({
    CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    UPLOAD_PRESET_VIDEO: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_VIDEO,
    WEDDING_TAG: process.env.NEXT_PUBLIC_WEDDING_TAG,
    MAX_UPLOADS_PER_USER: process.env.NEXT_PUBLIC_MAX_UPLOADS_PER_USER,
  });
  return cachedPublicEnv;
}

function parseServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = serverSchema.parse({
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    ADMIN_KEY: process.env.ADMIN_KEY,
  });
  return cachedServerEnv;
}

export const publicEnv = new Proxy({} as PublicEnv, {
  get(_t, prop) {
    return parsePublicEnv()[prop as keyof PublicEnv];
  },
});

export const serverEnv = new Proxy({} as ServerEnv, {
  get(_t, prop) {
    return parseServerEnv()[prop as keyof ServerEnv];
  },
});
