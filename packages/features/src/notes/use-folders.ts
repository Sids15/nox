import { FolderRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { Folder, FolderInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { folderKeys } from "./note-keys";

function snapshot(qc: QueryClient): Folder[] {
  return qc.getQueryData<Folder[]>(folderKeys.all) ?? [];
}

export function useFolders() {
  return useQuery({ queryKey: folderKeys.all, queryFn: FolderRepository.list });
}

/** Create a folder optimistically; `create(input)` returns the new id. */
export function useCreateFolder() {
  const qc = useQueryClient();
  const mutation = useMutation<Folder, Error, { input: FolderInput; id: string }, { previous: Folder[] }>({
    mutationFn: ({ input, id }) => FolderRepository.create(input, id),
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: folderKeys.all });
      const previous = snapshot(qc);
      const now = new Date().toISOString();
      const optimistic: Folder = {
        id,
        user_id: "",
        created_at: now,
        updated_at: now,
        deleted: false,
        ...input,
      };
      qc.setQueryData<Folder[]>(folderKeys.all, [...previous, optimistic]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(folderKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });

  return {
    ...mutation,
    create: (input: FolderInput): string => {
      const id = newId();
      mutation.mutate({ input, id });
      return id;
    },
  };
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => FolderRepository.rename(id, name),
    onSettled: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FolderRepository.softDelete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: folderKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Folder[]>(
        folderKeys.all,
        previous.filter((f) => f.id !== id),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) qc.setQueryData(folderKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}
