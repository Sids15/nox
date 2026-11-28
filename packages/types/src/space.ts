import { z } from "zod";
import { contentBlock } from "./block";
import { syncedRow } from "./common";

/** Kinds of field a page can carry (shown under its title, like Obsidian properties). */
export const propertyTypes = ["text", "number", "date", "select", "url", "checkbox"] as const;
export type PropertyType = (typeof propertyTypes)[number];

/**
 * One field on a note or idea. Self-describing (name + type travel with the value), so a page keeps
 * its fields whatever template or space it came from. Dates are `YYYY-MM-DD`.
 */
export const property = z.object({
  id: z.string().min(1).max(40),
  name: z.string().max(60).default(""),
  type: z.enum(propertyTypes).catch("text"),
  value: z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]).catch(null),
  /** Choices for a `select` field. */
  options: z.array(z.string().max(60)).max(30).optional(),
});
export type Property = z.infer<typeof property>;

/** A page's fields. Lenient: one malformed field is dropped instead of failing the whole page. */
export const properties = z
  .array(z.unknown())
  .catch([])
  .transform((items) => items.flatMap((p) => {
    const r = property.safeParse(p);
    return r.success ? [r.data] : [];
  }));

/** Optional fields the second-brain migration (0012) adds to notes and ideas. */
export const pageExtras = {
  space_id: z.string().uuid().nullable().default(null),
  properties: properties.default([]),
  /** The page's place in its space's pipeline (one of `space.stages`), or null. */
  stage: z.string().max(60).nullable().default(null),
};

/** The same fields on create/edit input: optional, so a database without 0012 never sees them. */
export const pageExtrasInput = {
  space_id: z.string().uuid().nullable().optional(),
  properties: z.array(property).max(40).optional(),
  stage: z.string().max(60).nullable().optional(),
};

/** An area of work or life: its own notes, ideas, tasks and resources, and its own pipeline. */
export const space = syncedRow.extend({
  name: z.string().min(1).max(80),
  /** An emoji, or "" for the default mark. */
  icon: z.string().max(16).default(""),
  color: z.string().max(20).default(""),
  description: z.string().max(2000).nullable().default(null),
  /** Pipeline stages for the space's board, in order (e.g. Idea → Script → Film → Edit → Published). */
  stages: z.array(z.string().min(1).max(60)).max(20).default([]),
  position: z.number().int().default(0),
  /** Finished: kept, but listed apart on the Spaces page (migration 0013). */
  archived: z.boolean().default(false),
});
export type Space = z.infer<typeof space>;

export const spaceInput = space.pick({ name: true, icon: true, color: true, description: true, stages: true, position: true, archived: true }).partial({
  archived: true,
  icon: true,
  color: true,
  description: true,
  stages: true,
  position: true,
});
export type SpaceInput = z.infer<typeof spaceInput>;

export const templateKinds = ["note", "idea"] as const;

/** A reusable starting point for a note or idea: its title, body and fields. */
export const template = syncedRow.extend({
  name: z.string().min(1).max(80),
  kind: z.enum(templateKinds).catch("note"),
  title: z.string().max(200).nullable().default(null),
  content: z.array(contentBlock).catch([]).default([]),
  properties: properties.default([]),
});
export type Template = z.infer<typeof template>;

export const templateInput = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(templateKinds),
  title: z.string().max(200).nullable(),
  content: z.array(contentBlock),
  properties: z.array(property).max(40),
});
export type TemplateInput = z.infer<typeof templateInput>;
