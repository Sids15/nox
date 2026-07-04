import { TagRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { Tag, TagInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { tagKeys } from "./resource-keys";

function snapshot(qc: QueryClient): Tag[] {
  return qc.getQueryData<Tag[]>(tagKeys.all) ?? [];
}

export function useTags() {
  return useQuery({ queryKey: tagKeys.all, queryFn: TagRepository.list });
}

/** Create a tag optimistically; `create(input)` returns the full (optimistic) Tag so the caller can
 *  immediately attach it to a resource and render its colored pill. */
export function useCreateTag() {
  const qc = useQueryClient();
  const mutation = useMutation<Tag, Error, { input: TagInput; id: string }, { previous: Tag[] }>({
    mutationFn: ({ input, id }) => TagRepository.create(input, id),
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: tagKeys.all });
      const previous = snapshot(qc);
      const now = new Date().toISOString();
      const optimistic: Tag = { id, user_id: "", created_at: now, updated_at: now, deleted: false, ...input };
      qc.setQueryData<Tag[]>(tagKeys.all, [...previous, optimistic]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(tagKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });

  return {
    ...mutation,
    create: (input: TagInput): Tag => {
      const id = newId();
      const now = new Date().toISOString();
      mutation.mutate({ input, id });
      return { id, user_id: "", created_at: now, updated_at: now, deleted: false, ...input };
    },
  };
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TagRepository.softDelete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: tagKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Tag[]>(
        tagKeys.all,
        previous.filter((t) => t.id !== id),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) qc.setQueryData(tagKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });
}
