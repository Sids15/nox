import {
  FocusRepository,
  FolderRepository,
  IdeaRepository,
  NoteRepository,
  ResourceRepository,
  SpaceRepository,
  TemplateRepository,
  TagRepository,
  TaskRepository,
  type IdeaStatus,
  type ToggleableStatus,
} from "@nox/api";
import type {
  FocusSessionInput,
  FolderInput,
  IdeaInput,
  NoteInput,
  ResourceInput,
  SpaceInput,
  TagInput,
  TaskInput,
  TemplateInput,
} from "@nox/types";
import type { MutationKey, QueryClient } from "@tanstack/react-query";

/**
 * Registers the network function for every write, keyed by `[entity, op]`. A mutation queued while
 * offline is persisted with only its `mutationKey` + variables (the inline closure can't be
 * serialized); on app restart TanStack rehydrates it and looks up the `mutationFn` here to resume.
 * Each hook's `useMutation` uses the matching `mutationKey` and omits its own `mutationFn`. Call once
 * at startup, before the first render. Repositories stay the sole Supabase touchpoint.
 */
export function registerMutationDefaults(qc: QueryClient): void {
  const def = <V>(key: MutationKey, mutationFn: (vars: V) => Promise<unknown>): void => {
    qc.setMutationDefaults(key, { mutationFn: mutationFn as (vars: unknown) => Promise<unknown> });
  };

  // Tasks
  def<{ input: TaskInput; id: string }>(["task", "create"], ({ input, id }) => TaskRepository.create(input, id));
  def<{ id: string; status: ToggleableStatus }>(["task", "status"], ({ id, status }) => TaskRepository.setStatus(id, status));
  def<{ id: string; patch: Partial<TaskInput> }>(["task", "update"], ({ id, patch }) => TaskRepository.update(id, patch));
  def<string>(["task", "delete"], (id) => TaskRepository.softDelete(id));
  def<string>(["task", "delete-series"], (templateId) => TaskRepository.softDeleteSeries(templateId));

  // Ideas
  def<{ input: IdeaInput; id: string }>(["idea", "create"], ({ input, id }) => IdeaRepository.create(input, id));
  def<{ id: string; patch: Partial<IdeaInput> }>(["idea", "update"], ({ id, patch }) => IdeaRepository.update(id, patch));
  def<{ id: string; status: IdeaStatus }>(["idea", "status"], ({ id, status }) => IdeaRepository.setStatus(id, status));
  def<{ id: string; isArchived: boolean }>(["idea", "archive"], ({ id, isArchived }) => IdeaRepository.setArchived(id, isArchived));
  def<string>(["idea", "delete"], (id) => IdeaRepository.softDelete(id));

  // Notes
  def<{ input: NoteInput; id: string }>(["note", "create"], ({ input, id }) => NoteRepository.create(input, id));
  def<{ id: string; patch: Partial<NoteInput> }>(["note", "update"], ({ id, patch }) => NoteRepository.update(id, patch));
  def<{ id: string; isPinned: boolean }>(["note", "pin"], ({ id, isPinned }) => NoteRepository.setPinned(id, isPinned));
  def<{ id: string; isArchived: boolean }>(["note", "archive"], ({ id, isArchived }) => NoteRepository.setArchived(id, isArchived));
  def<string>(["note", "delete"], (id) => NoteRepository.softDelete(id));

  // Folders
  def<{ input: FolderInput; id: string }>(["folder", "create"], ({ input, id }) => FolderRepository.create(input, id));
  def<{ id: string; name: string }>(["folder", "rename"], ({ id, name }) => FolderRepository.rename(id, name));
  def<string>(["folder", "delete"], (id) => FolderRepository.softDelete(id));

  // Resources
  def<{ input: ResourceInput; id: string }>(["resource", "create"], ({ input, id }) => ResourceRepository.create(input, id));
  def<{ id: string; patch: Partial<ResourceInput> }>(["resource", "update"], ({ id, patch }) => ResourceRepository.update(id, patch));
  def<{ id: string; isArchived: boolean }>(["resource", "archive"], ({ id, isArchived }) => ResourceRepository.setArchived(id, isArchived));
  def<string>(["resource", "delete"], (id) => ResourceRepository.softDelete(id));

  // Tags
  def<{ input: TagInput; id: string }>(["tag", "create"], ({ input, id }) => TagRepository.create(input, id));
  def<{ id: string; patch: Partial<TagInput> }>(["tag", "update"], ({ id, patch }) => TagRepository.update(id, patch));
  def<string>(["tag", "delete"], (id) => TagRepository.softDelete(id));

  // Spaces and templates
  def<{ input: SpaceInput; id: string }>(["space", "create"], ({ input, id }) => SpaceRepository.create(input, id));
  def<{ id: string; patch: Partial<SpaceInput> }>(["space", "update"], ({ id, patch }) => SpaceRepository.update(id, patch));
  def<string>(["space", "delete"], (id) => SpaceRepository.softDelete(id));
  def<{ input: TemplateInput; id: string }>(["template", "create"], ({ input, id }) => TemplateRepository.create(input, id));
  def<string>(["template", "delete"], (id) => TemplateRepository.softDelete(id));

  // Focus sessions
  def<{ input: FocusSessionInput; id: string }>(["focus", "create"], ({ input, id }) => FocusRepository.create(input, id));
  def<string>(["focus", "delete"], (id) => FocusRepository.softDelete(id));
}
