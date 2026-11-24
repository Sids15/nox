import type { RefKind } from "@nox/features";
import { Bookmark, FileText, Lightbulb, SquareCheckBig, type LucideIcon } from "lucide-react-native";

export const KIND_ICON: Record<RefKind, LucideIcon> = { note: FileText, idea: Lightbulb, task: SquareCheckBig, resource: Bookmark };

export function KindIcon({ kind, color, size = 15 }: { kind: RefKind; color: string; size?: number }) {
  const Icon = KIND_ICON[kind];
  return <Icon size={size} color={color} strokeWidth={2} />;
}
