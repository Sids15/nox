import { ResourceRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { Resource, ResourceInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type MutationKey, type QueryClient } from "@tanstack/react-query";
import { resourceKeys } from "./resource-keys";

function snapshot(qc: QueryClient): Resource[] {
  return qc.getQueryData<Resource[]>(resourceKeys.all) ?? [];
}

export function useResources() {
  return useQuery({ queryKey: resourceKeys.all, queryFn: ResourceRepository.list });
}

export function useCreateResource() {
  const qc = useQueryClient();
  const mutation = useMutation<Resource, Error, { input: ResourceInput; id: string }, { previous: Resource[] }>({
    mutationKey: ["resource", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: resourceKeys.all });
      const previous = snapshot(qc);
      const now = new Date().toISOString();
      const optimistic: Resource = {
        id,
        user_id: "",
        created_at: now,
        updated_at: now,
        deleted: false,
        is_archived: false,
        ...input,
      };
      qc.setQueryData<Resource[]>(resourceKeys.all, [optimistic, ...previous]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(resourceKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: resourceKeys.all }),
  });

  return {
    ...mutation,
    create: (input: ResourceInput): string => {
      const id = newId();
      mutation.mutate({ input, id });
      return id;
    },
  };
}

function useResourcePatch<V>(mutationKey: MutationKey, patchFor: (v: V) => Partial<Resource>) {
  const qc = useQueryClient();
  return useMutation<Resource, Error, V, { previous: Resource[] }>({
    mutationKey,
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: resourceKeys.all });
      const previous = snapshot(qc);
      const patch = patchFor(v);
      const id = (v as { id: string }).id;
      qc.setQueryData<Resource[]>(
        resourceKeys.all,
        previous.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(resourceKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: resourceKeys.all }),
  });
}

export function useUpdateResource() {
  return useResourcePatch<{ id: string; patch: Partial<ResourceInput> }>(["resource", "update"], ({ patch }) => patch);
}

export function useArchiveResource() {
  return useResourcePatch<{ id: string; isArchived: boolean }>(["resource", "archive"], ({ isArchived }) => ({
    is_archived: isArchived,
  }));
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Resource[] }>({
    mutationKey: ["resource", "delete"],
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: resourceKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Resource[]>(
        resourceKeys.all,
        previous.filter((r) => r.id !== id),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) qc.setQueryData(resourceKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: resourceKeys.all }),
  });
}
