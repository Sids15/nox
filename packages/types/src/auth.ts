import { z } from "zod";

/** Auth form schemas — used with react-hook-form + @hookform/resolvers/zod. */
export const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});
export type Credentials = z.infer<typeof credentials>;

export const magicLinkInput = z.object({
  email: z.string().email().max(320),
});
export type MagicLinkInput = z.infer<typeof magicLinkInput>;
