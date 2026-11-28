import { IdeaRepository, type IdeaStatus } from "@nox/api";
import { newId } from "@nox/db";
import type { Idea, IdeaInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type MutationKey, type QueryClient } from "@tanstack/react-query";
import { ideaKeys } from "./idea-keys";
import { withInboxExit } from "../inbox/inbox";

function snapshot(qc: QueryClient): Idea[] {
  return qc.getQueryData<Idea[]>(ideaKeys.all) ?? [];
}

/** All live ideas for the current user (most-recently-updated first). */
export function useIdeas() {
  return useQuery({ queryKey: ideaKeys.all, queryFn: IdeaRepository.list });
}

/**
 * Create an idea optimistically. `mutate(input)` generates the id once and threads it through the
 * cache row and the insert so they share identity. New ideas go to the top (list is updated-desc).
 */
export function useCreateIdea() {
  const qc = useQueryClient();
  const mutation = useMutation<
    Idea,
    Error,
    { input: IdeaInput; id: string },
    { previous: Idea[] }
  >({
    mutationKey: ["idea", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: ideaKeys.all });
      const previous = snapshot(qc);
      const now = new Date().toISOString();
      const optimistic: Idea = {
        id,
        user_id: "",
        created_at: now,
        updated_at: now,
        deleted: false,
        is_archived: false,
        ...input,
        space_id: input.space_id ?? null,
        properties: input.properties ?? [],
        stage: input.stage ?? null,
        inbox: input.inbox ?? false,
      };
      qc.setQueryData<Idea[]>(ideaKeys.all, [optimistic, ...previous]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ideaKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ideaKeys.all }),
  });

  return {
    ...mutation,
    mutate: (input: IdeaInput) => mutation.mutate({ input, id: newId() }),
    mutateAsync: (input: IdeaInput) => mutation.mutateAsync({ input, id: newId() }),
    /** Fire an optimistic create and return the new id immediately (so the caller can navigate to
     *  the detail screen — the optimistic row is already in the cache). */
    create: (input: IdeaInput): string => {
      const id = newId();
      mutation.mutate({ input, id });
      return id;
    },
  };
}

/** Shared optimistic-patch mutation helper for the single-idea updates below. */
function useIdeaPatch<V>(mutationKey: MutationKey, patchFor: (v: V) => Partial<Idea>) {
  const qc = useQueryClient();
  return useMutation<Idea, Error, V, { previous: Idea[] }>({
    mutationKey,
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ideaKeys.all });
      const previous = snapshot(qc);
      const patch = patchFor(v);
      qc.setQueryData<Idea[]>(
        ideaKeys.all,
        previous.map((i) => (i.id === (v as { id: string }).id ? { ...i, ...patch } : i)),
      );
      return { previous };
    },
    onError: (_err, _v, ctx) => {
      if (ctx) qc.setQueryData(ideaKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ideaKeys.all }),
  });
}

/** Patch an idea's editable fields (title/description/priority/status/tags). */
export function useUpdateIdea() {
  const qc = useQueryClient();
  const m = useIdeaPatch<{ id: string; patch: Partial<IdeaInput> }>(["idea", "update"], ({ patch }) => patch);
  // Given a home, an Inbox item leaves the Inbox.
  const fix = (v: { id: string; patch: Partial<IdeaInput> }) => withInboxExit(qc.getQueryData<Idea[]>(ideaKeys.all)?.find((x) => x.id === v.id), v, ["space_id"]);
  return {
    ...m,
    mutate: (v: { id: string; patch: Partial<IdeaInput> }, o?: Parameters<typeof m.mutate>[1]) => m.mutate(fix(v), o),
    mutateAsync: (v: { id: string; patch: Partial<IdeaInput> }, o?: Parameters<typeof m.mutateAsync>[1]) => m.mutateAsync(fix(v), o),
  };
}

/** Advance an idea along the status pipeline (or drop it). */
export function useSetIdeaStatus() {
  return useIdeaPatch<{ id: string; status: IdeaStatus }>(["idea", "status"], ({ status }) => ({ status }));
}

/** Archive / unarchive (archived ideas drop out of the active list). */
export function useArchiveIdea() {
  return useIdeaPatch<{ id: string; isArchived: boolean }>(["idea", "archive"], ({ isArchived }) => ({
    is_archived: isArchived,
  }));
}

/** Soft-delete an idea, removing it from the cache immediately. */
export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Idea[] }>({
    mutationKey: ["idea", "delete"],
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ideaKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Idea[]>(
        ideaKeys.all,
        previous.filter((i) => i.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) qc.setQueryData(ideaKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ideaKeys.all }),
  });
}
