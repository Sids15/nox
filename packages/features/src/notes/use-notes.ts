import { NoteRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { Note, NoteInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient, type MutationKey, type QueryClient } from "@tanstack/react-query";
import { noteKeys } from "./note-keys";

function snapshot(qc: QueryClient): Note[] {
  return qc.getQueryData<Note[]>(noteKeys.all) ?? [];
}

/** All live notes for the current user (most-recently-updated first). */
export function useNotes() {
  return useQuery({ queryKey: noteKeys.all, queryFn: NoteRepository.list });
}

/** Create a note optimistically; `create(input)` returns the new id so the caller can open the editor. */
export function useCreateNote() {
  const qc = useQueryClient();
  const mutation = useMutation<Note, Error, { input: NoteInput; id: string }, { previous: Note[] }>({
    mutationKey: ["note", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: noteKeys.all });
      const previous = snapshot(qc);
      const now = new Date().toISOString();
      const optimistic: Note = {
        id,
        user_id: "",
        created_at: now,
        updated_at: now,
        deleted: false,
        is_pinned: false,
        is_archived: false,
        ...input,
        space_id: input.space_id ?? null,
        properties: input.properties ?? [],
        stage: input.stage ?? null,
      };
      qc.setQueryData<Note[]>(noteKeys.all, [optimistic, ...previous]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(noteKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });

  return {
    ...mutation,
    create: (input: NoteInput): string => {
      const id = newId();
      mutation.mutate({ input, id });
      return id;
    },
  };
}

/** Optimistic-patch helper shared by the single-note updates below. */
function useNotePatch<V>(mutationKey: MutationKey, patchFor: (v: V) => Partial<Note>) {
  const qc = useQueryClient();
  return useMutation<Note, Error, V, { previous: Note[] }>({
    mutationKey,
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: noteKeys.all });
      const previous = snapshot(qc);
      const patch = patchFor(v);
      const id = (v as { id: string }).id;
      qc.setQueryData<Note[]>(
        noteKeys.all,
        previous.map((n) =>
          n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(noteKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

/** Patch a note's editable fields (title/content/tags/folder) — the editor's debounced auto-save. */
export function useUpdateNote() {
  return useNotePatch<{ id: string; patch: Partial<NoteInput> }>(["note", "update"], ({ patch }) => patch);
}

export function useSetNotePinned() {
  return useNotePatch<{ id: string; isPinned: boolean }>(["note", "pin"], ({ isPinned }) => ({
    is_pinned: isPinned,
  }));
}

export function useArchiveNote() {
  return useNotePatch<{ id: string; isArchived: boolean }>(["note", "archive"], ({ isArchived }) => ({
    is_archived: isArchived,
  }));
}

/** Soft-delete a note, removing it from the cache immediately. */
export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Note[] }>({
    mutationKey: ["note", "delete"],
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: noteKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Note[]>(
        noteKeys.all,
        previous.filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx) qc.setQueryData(noteKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}
