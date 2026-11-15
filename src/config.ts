import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(8080),
  EVENTS_API_KEY: z.string().min(8),
  LINK_SECRET: z.string().min(8),
  PUBLIC_BASE_URL: z.string().url(),
  SITE_URL: z.string().url().default("https://leanprep.in"),
  SEND_MODE: z.enum(["dry_run", "live"]).default("dry_run"),
  RUN_WORKER: bool,
  TICK_SECONDS: z.coerce.number().min(10).default(120),

  TARGET_SALES: z.coerce.number().default(500),
  CAMPAIGN_START: z.string().default("2026-11-15"),
  CAMPAIGN_END: z.string().default("2026-12-15"),
  COURSE_START: z.string().default("2026-12-01"),
  OFFER_DEADLINE_TEXT: z.string().optional().default(""),

  ACS_CONNECTION_STRING: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("hello@leanprep.in"),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),

  WHATSAPP_ENABLED: bool,
  WHATSAPP_TOKEN: z.string().optional().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),

  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function config(): Config {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

/** For tests only. */
export function setConfigForTests(c: Partial<Config>): void {
  cached = { ...(cached ?? ({} as Config)), ...c } as Config;
}
