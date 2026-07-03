export { AuthRepository } from "./auth-repository";
export { TaskRepository, type ToggleableStatus } from "./task-repository";
export { IdeaRepository, type IdeaStatus } from "./idea-repository";
// Remaining domain repositories (NoteRepository, FolderRepository) are added in their respective
// feature phases — each is the sole Supabase touchpoint for its module.
