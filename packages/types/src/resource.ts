import { z } from "zod";
import { syncedRow } from "./common";

export const resourceTypes = ["link", "image", "video", "text"] as const;

export const resource = syncedRow.extend({
  type: z.enum(resourceTypes).default("link"),
  url: z.string().max(2000).nullable().default(null),
  title: z.string().max(300).nullable().default(null),
  domain: z.string().max(200).nullable().default(null),
  thumbnail_url: z.string().max(2000).nullable().default(null),
  duration: z.string().max(20).nullable().default(null),
  body: z.string().max(10_000).nullable().default(null),
  tag_ids: z.array(z.string().uuid()).default([]),
  is_archived: z.boolean().default(false),
});
export type Resource = z.infer<typeof resource>;

export const resourceInput = resource.pick({
  type: true,
  url: true,
  title: true,
  domain: true,
  thumbnail_url: true,
  duration: true,
  body: true,
  tag_ids: true,
});
export type ResourceInput = z.infer<typeof resourceInput>;

export const tag = syncedRow.extend({
  name: z.string().min(1).max(40),
  color: z.string().min(1).max(20),
});
export type Tag = z.infer<typeof tag>;

export const tagInput = tag.pick({ name: true, color: true });
export type TagInput = z.infer<typeof tagInput>;
