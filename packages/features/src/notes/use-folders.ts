import { FolderRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { Folder, FolderInput, Note } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { folderKeys, noteKeys } from "./note-keys";

// FolderRepository is still the sole Supabase touchpoint via useFolders' list query; the write
// functions now live in the mutation registry (keyed by ["folder", …]) for offline durability.

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
    mutationKey: ["folder", "create"],
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
  return useMutation<Folder, Error, { id: string; name: string }>({
    mutationKey: ["folder", "rename"],
    onSettled: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}

/** Delete a folder; its notes move to "no folder" (in the cache immediately, and on the server). */
export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Folder[]; previousNotes: Note[] | undefined }>({
    mutationKey: ["folder", "delete"],
    onMutate: async (id: string) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: folderKeys.all }),
        qc.cancelQueries({ queryKey: noteKeys.all }),
      ]);
      const previous = snapshot(qc);
      const previousNotes = qc.getQueryData<Note[]>(noteKeys.all);
      qc.setQueryData<Folder[]>(
        folderKeys.all,
        previous.filter((f) => f.id !== id),
      );
      if (previousNotes) {
        qc.setQueryData<Note[]>(
          noteKeys.all,
          previousNotes.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n)),
        );
      }
      return { previous, previousNotes };
    },
    onError: (_e, _id, ctx) => {
      if (!ctx) return;
      qc.setQueryData(folderKeys.all, ctx.previous);
      if (ctx.previousNotes) qc.setQueryData(noteKeys.all, ctx.previousNotes);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: folderKeys.all });
      void qc.invalidateQueries({ queryKey: noteKeys.all });
    },
  });
}
