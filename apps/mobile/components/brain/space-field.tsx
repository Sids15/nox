import { useSpaces, useThemeColors } from "@nox/features";
import { ChevronDown, Layers } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MenuRow, pressScale } from "../menu";
import { Popover } from "../popover";
import { SpaceMark } from "./space-mark";

/** A compact "which space" control for pages without the full fields block (tasks, resources). */
export function SpaceField({ spaceId, onChange }: { spaceId: string | null; onChange: (id: string | null) => void }) {
  const c = useThemeColors();
  const { data: spaces = [] } = useSpaces();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const space = spaces.find((s) => s.id === spaceId);
  if (spaces.length === 0 && !space) return null;

  return (
    <>
      <View ref={ref} collapsable={false} className="self-start">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Space: ${space?.name ?? "None"}`}
          style={pressScale}
          className={`-ml-2 h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${open ? "bg-chip" : "hover:bg-chip"}`}
        >
          {space ? <SpaceMark space={space} size={18} /> : <Layers size={14} color={c.ink3} strokeWidth={2} />}
          <Text className={`text-[14px] ${space ? "text-ink font-medium" : "text-ink-3"}`}>{space?.name ?? "No space"}</Text>
          <ChevronDown size={13} color={c.ink3} strokeWidth={2.2} />
        </Pressable>
      </View>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240} accessibilityLabel="Space">
        <View className="p-1.5">
          <MenuRow
            label="No space"
            selected={!spaceId}
            icon={<Layers size={15} color={c.ink2} strokeWidth={2} />}
            onPress={() => {
              setOpen(false);
              if (spaceId) onChange(null);
            }}
          />
          {spaces.map((s) => (
            <MenuRow
              key={s.id}
              label={s.name}
              selected={s.id === spaceId}
              icon={<SpaceMark space={s} size={18} />}
              onPress={() => {
                setOpen(false);
                if (s.id !== spaceId) onChange(s.id);
              }}
            />
          ))}
        </View>
      </Popover>
    </>
  );
}
