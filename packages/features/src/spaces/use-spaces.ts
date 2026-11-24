import { SpaceRepository, TemplateRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { Space, SpaceInput, Template, TemplateInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

export const spaceKeys = { all: ["spaces"] as const };
export const templateKeys = { all: ["templates"] as const };

const spacesOf = (qc: QueryClient) => qc.getQueryData<Space[]>(spaceKeys.all) ?? [];
const templatesOf = (qc: QueryClient) => qc.getQueryData<Template[]>(templateKeys.all) ?? [];

/** The user's spaces, in sidebar order. Empty (not an error) on a database without migration 0012. */
export function useSpaces() {
  return useQuery({ queryKey: spaceKeys.all, queryFn: SpaceRepository.list });
}

/** Create a space optimistically; `create(input)` returns the new id so the caller can open it. */
export function useCreateSpace() {
  const qc = useQueryClient();
  const mutation = useMutation<Space, Error, { input: SpaceInput; id: string }, { previous: Space[] }>({
    mutationKey: ["space", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: spaceKeys.all });
      const previous = spacesOf(qc);
      const now = new Date().toISOString();
      const optimistic: Space = {
        id,
        user_id: "",
        created_at: now,
        updated_at: now,
        deleted: false,
        icon: "",
        color: "",
        description: null,
        stages: [],
        position: previous.length,
        ...input,
      };
      qc.setQueryData<Space[]>(spaceKeys.all, [...previous, optimistic]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(spaceKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: spaceKeys.all }),
  });
  return {
    ...mutation,
    create: (input: SpaceInput): string => {
      const id = newId();
      mutation.mutate({ input: { position: spacesOf(qc).length, ...input }, id });
      return id;
    },
  };
}

/** Rename a space, change its mark, or edit its pipeline stages. */
export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation<Space, Error, { id: string; patch: Partial<SpaceInput> }, { previous: Space[] }>({
    mutationKey: ["space", "update"],
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: spaceKeys.all });
      const previous = spacesOf(qc);
      qc.setQueryData<Space[]>(
        spaceKeys.all,
        previous.map((s) => (s.id === id ? { ...s, ...patch, updated_at: new Date().toISOString() } : s)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(spaceKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: spaceKeys.all }),
  });
}

/** Delete a space. Its pages stay, moved out of the space, on every device. */
export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Space[] }>({
    mutationKey: ["space", "delete"],
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: spaceKeys.all });
      const previous = spacesOf(qc);
      qc.setQueryData<Space[]>(spaceKeys.all, previous.filter((s) => s.id !== id));
      for (const key of ["notes", "ideas", "tasks", "resources"]) {
        qc.setQueryData<{ space_id: string | null }[]>([key], (rows) =>
          rows?.map((r) => (r.space_id === id ? { ...r, space_id: null } : r)),
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(spaceKeys.all, ctx.previous);
    },
    onSettled: () => {
      for (const key of ["spaces", "notes", "ideas", "tasks", "resources"]) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

/** The user's own templates (the built-in starters are added by the app). */
export function useTemplates() {
  return useQuery({ queryKey: templateKeys.all, queryFn: TemplateRepository.list });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation<Template, Error, { input: TemplateInput; id: string }, { previous: Template[] }>({
    mutationKey: ["template", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: templateKeys.all });
      const previous = templatesOf(qc);
      const now = new Date().toISOString();
      qc.setQueryData<Template[]>(templateKeys.all, [
        ...previous,
        { id, user_id: "", created_at: now, updated_at: now, deleted: false, ...input },
      ]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(templateKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  });
  return {
    ...mutation,
    create: (input: TemplateInput): string => {
      const id = newId();
      mutation.mutate({ input, id });
      return id;
    },
  };
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Template[] }>({
    mutationKey: ["template", "delete"],
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: templateKeys.all });
      const previous = templatesOf(qc);
      qc.setQueryData<Template[]>(templateKeys.all, previous.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(templateKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  });
}
