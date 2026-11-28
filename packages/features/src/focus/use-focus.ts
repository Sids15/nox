import { FocusRepository } from "@nox/api";
import { newId } from "@nox/db";
import type { FocusSession, FocusSessionInput } from "@nox/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Also the realtime table name, so other devices' sessions show up. */
export const focusKeys = { all: ["focus_sessions"] as const };

/** The last ~year of focus sessions, newest first. Empty on a database without migration 0016. */
export function useFocusSessions() {
  return useQuery({ queryKey: focusKeys.all, queryFn: FocusRepository.list });
}

/** Save a finished focus session (optimistic, queued while offline). */
export function useLogFocus() {
  const qc = useQueryClient();
  const mutation = useMutation<FocusSession, Error, { input: FocusSessionInput; id: string }, { previous: FocusSession[] }>({
    mutationKey: ["focus", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: focusKeys.all });
      const previous = qc.getQueryData<FocusSession[]>(focusKeys.all) ?? [];
      const now = new Date().toISOString();
      const optimistic: FocusSession = { id, user_id: "", created_at: now, updated_at: now, deleted: false, ...input };
      qc.setQueryData<FocusSession[]>(focusKeys.all, [optimistic, ...previous]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(focusKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: focusKeys.all }),
  });
  return { ...mutation, log: (input: FocusSessionInput) => mutation.mutate({ input, id: newId() }) };
}
