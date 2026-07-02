export { AuthRepository } from "./auth-repository";
export { TaskRepository, type ToggleableStatus } from "./task-repository";
// Remaining domain repositories (IdeaRepository, NoteRepository, FolderRepository) are added in
// their respective feature phases — each is the sole Supabase touchpoint for its module.
