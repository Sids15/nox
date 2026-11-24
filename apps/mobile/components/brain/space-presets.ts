/** Ready-made spaces: a name, a mark and a pipeline for the board. Everything is editable after. */
export interface SpacePreset {
  key: string;
  label: string;
  /** A key of SPACE_ICONS. */
  icon: string;
  stages: string[];
  hint: string;
}

export const SPACE_PRESETS: SpacePreset[] = [
  { key: "youtube", label: "YouTube channel", icon: "clapperboard", stages: ["Idea", "Script", "Film", "Edit", "Scheduled", "Published"], hint: "Video ideas through to published" },
  { key: "project", label: "Project", icon: "rocket", stages: ["Backlog", "In progress", "Review", "Done"], hint: "Briefs, PRDs, tasks and links" },
  { key: "docs", label: "Docs & PRDs", icon: "file-text", stages: ["Draft", "In review", "Approved", "Shipped"], hint: "Specs moving to sign-off" },
  { key: "blank", label: "Blank", icon: "layers", stages: [], hint: "No pipeline; add stages later" },
];

