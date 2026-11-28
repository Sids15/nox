import { useSpaces, useThemeColors } from "@nox/features";
import { propertyTypes, type Property, type PropertyType } from "@nox/types";
import {
  Calendar,
  ChevronDown,
  CircleDot,
  Hash,
  Layers,
  Link2,
  ListChecks,
  Plus,
  SquareCheck,
  Square,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { MenuDivider, MenuLabel, MenuRow, pressScale } from "../menu";
import { Popover } from "../popover";
import { openExternal } from "../../lib/open-external";
import { SpaceMark } from "./space-mark";

export interface PageFieldsPatch {
  space_id?: string | null;
  stage?: string | null;
  properties?: Property[];
}

const TYPE_META: Record<PropertyType, { label: string; Icon: LucideIcon }> = {
  text: { label: "Text", Icon: Type },
  number: { label: "Number", Icon: Hash },
  date: { label: "Date", Icon: Calendar },
  select: { label: "Choice", Icon: ListChecks },
  url: { label: "Link", Icon: Link2 },
  checkbox: { label: "Checkbox", Icon: SquareCheck },
};

const newFieldId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** One line of the fields list: a fixed label column, then the value (the editors' existing shape). */
function Row({ label, labelWidth, children, onLabel }: { label: ReactNode; labelWidth: number; children: ReactNode; onLabel?: () => void }) {
  return (
    <View className="min-h-[36px] flex-row items-center">
      {onLabel ? (
        <Pressable onPress={onLabel} accessibilityRole="button" className="hover:bg-chip -ml-1 rounded-[6px] px-1 py-1" style={{ width: labelWidth }}>
          {label}
        </Pressable>
      ) : (
        <View style={{ width: labelWidth }}>{label}</View>
      )}
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">{children}</View>
    </View>
  );
}

function Anchor({ anchor, onPress, open, label, children }: { anchor: React.RefObject<View | null>; onPress: () => void; open: boolean; label: string; children: ReactNode }) {
  const c = useThemeColors();
  return (
    <View ref={anchor} collapsable={false}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={pressScale}
        className={`-ml-2 h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${open ? "bg-chip" : "hover:bg-chip"}`}
      >
        {children}
        <ChevronDown size={13} color={c.ink3} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/**
 * Space, stage and custom fields for a note or idea — the "properties" block under the title, like
 * Obsidian's. Space and stage drive the space's board; custom fields (publish date, owner, status,
 * links…) are free-form and travel with the page.
 */
export function PageFields({
  spaceId,
  stage,
  properties,
  onPatch,
  labelWidth = 72,
}: {
  spaceId: string | null;
  stage: string | null;
  properties: Property[];
  onPatch: (patch: PageFieldsPatch) => void;
  labelWidth?: number;
}) {
  const c = useThemeColors();
  const { data: spaces = [] } = useSpaces();
  const space = spaces.find((s) => s.id === spaceId);
  const [open, setOpen] = useState<"space" | "stage" | "add" | null>(null);
  const spaceRef = useRef<View>(null);
  const stageRef = useRef<View>(null);
  const addRef = useRef<View>(null);
  const label = (t: string) => <Text className="text-ink-3 text-[14px]">{t}</Text>;

  const setProps = (next: Property[]) => onPatch({ properties: next });
  const addField = (type: PropertyType) => {
    setOpen(null);
    setProps([...properties, { id: newFieldId(), name: TYPE_META[type].label, type, value: type === "checkbox" ? false : null, ...(type === "select" ? { options: [] } : {}) }]);
  };

  return (
    <View>
      <Row label={label("Space")} labelWidth={labelWidth}>
        <Anchor anchor={spaceRef} onPress={() => setOpen("space")} open={open === "space"} label={`Space: ${space?.name ?? "None"}`}>
          {space ? <SpaceMark space={space} size={18} /> : <Layers size={14} color={c.ink3} strokeWidth={2} />}
          <Text className={`text-[14px] ${space ? "text-ink font-medium" : "text-ink-3"}`}>{space?.name ?? "No space"}</Text>
        </Anchor>
      </Row>
      {space && space.stages.length > 0 ? (
        <Row label={label("Stage")} labelWidth={labelWidth}>
          <Anchor anchor={stageRef} onPress={() => setOpen("stage")} open={open === "stage"} label={`Stage: ${stage ?? "None"}`}>
            <CircleDot size={14} color={stage ? c.accent : c.ink3} strokeWidth={2} />
            <Text className={`text-[14px] ${stage ? "text-ink font-medium" : "text-ink-3"}`}>{stage ?? "Not started"}</Text>
          </Anchor>
        </Row>
      ) : null}

      {properties.map((p) => (
        <FieldRow
          key={p.id}
          field={p}
          labelWidth={labelWidth}
          onChange={(next) => setProps(properties.map((x) => (x.id === p.id ? next : x)))}
          onRemove={() => setProps(properties.filter((x) => x.id !== p.id))}
        />
      ))}

      <View ref={addRef} collapsable={false} className="self-start">
        <Pressable
          onPress={() => setOpen("add")}
          accessibilityRole="button"
          className="hover:bg-chip -ml-1 mt-0.5 h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-1.5"
        >
          <Plus size={14} color={c.ink3} strokeWidth={2.2} />
          <Text className="text-ink-3 text-[13px] font-medium">Add field</Text>
        </Pressable>
      </View>

      <Popover anchorRef={spaceRef} open={open === "space"} onClose={() => setOpen(null)} width={240} accessibilityLabel="Space">
        <View className="p-1.5">
          <MenuRow
            label="No space"
            selected={!spaceId}
            icon={<Layers size={15} color={c.ink2} strokeWidth={2} />}
            onPress={() => {
              setOpen(null);
              if (spaceId) onPatch({ space_id: null, stage: null });
            }}
          />
          {spaces.filter((s) => !s.archived || s.id === spaceId).map((s) => (
            <MenuRow
              key={s.id}
              label={s.name}
              selected={s.id === spaceId}
              icon={<SpaceMark space={s} size={18} />}
              onPress={() => {
                setOpen(null);
                // A page entering a space with a pipeline starts at its first stage.
                if (s.id !== spaceId) onPatch({ space_id: s.id, stage: s.stages[0] ?? null });
              }}
            />
          ))}
          {spaces.length === 0 ? <Text className="text-ink-3 px-2.5 py-2 text-[13px]">No spaces yet — make one in Spaces.</Text> : null}
        </View>
      </Popover>
      <Popover anchorRef={stageRef} open={open === "stage"} onClose={() => setOpen(null)} width={220} accessibilityLabel="Stage">
        <View className="p-1.5">
          {(space?.stages ?? []).map((st) => (
            <MenuRow
              key={st}
              label={st}
              selected={st === stage}
              onPress={() => {
                setOpen(null);
                onPatch({ stage: st });
              }}
            />
          ))}
        </View>
      </Popover>
      <Popover anchorRef={addRef} open={open === "add"} onClose={() => setOpen(null)} width={200} accessibilityLabel="Add a field">
        <View className="p-1.5">
          <MenuLabel>Add a field</MenuLabel>
          {propertyTypes.map((t) => {
            const { label: l, Icon } = TYPE_META[t];
            return <MenuRow key={t} label={l} icon={<Icon size={15} color={c.ink2} strokeWidth={2} />} onPress={() => addField(t)} />;
          })}
        </View>
      </Popover>
    </View>
  );
}

/** One custom field: tap the name to rename or remove it; the value edits in place. */
function FieldRow({ field, labelWidth, onChange, onRemove }: { field: Property; labelWidth: number; onChange: (p: Property) => void; onRemove: () => void }) {
  const c = useThemeColors();
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState(field.name);
  const [draft, setDraft] = useState(field.value === null || typeof field.value === "boolean" ? "" : String(field.value));
  const [newOption, setNewOption] = useState("");
  const [choiceOpen, setChoiceOpen] = useState(false);
  const nameRef = useRef<View>(null);
  const choiceRef = useRef<View>(null);
  const { Icon } = TYPE_META[field.type];

  const commit = () => {
    const t = draft.trim();
    if (field.type === "number") {
      const n = Number(t);
      onChange({ ...field, value: t === "" || !Number.isFinite(n) ? null : n });
      if (t !== "" && !Number.isFinite(n)) setDraft("");
    } else if (field.type === "date") {
      onChange({ ...field, value: DATE.test(t) ? t : null });
      if (t !== "" && !DATE.test(t)) setDraft("");
    } else {
      onChange({ ...field, value: t === "" ? null : t.slice(0, 2000) });
    }
  };

  const labelNode = (
    <View ref={nameRef} collapsable={false} className="flex-row items-center gap-1.5">
      <Icon size={13} color={c.ink3} strokeWidth={2} />
      <Text numberOfLines={1} className="text-ink-3 flex-shrink text-[14px]">
        {field.name || "Field"}
      </Text>
    </View>
  );

  let value: ReactNode;
  if (field.type === "checkbox") {
    value = (
      <Pressable
        onPress={() => onChange({ ...field, value: !field.value })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!field.value }}
        accessibilityLabel={field.name}
        hitSlop={6}
        className="-ml-1 p-1"
      >
        {field.value ? <SquareCheck size={18} color={c.accent} strokeWidth={2} /> : <Square size={18} color={c.ink3} strokeWidth={2} />}
      </Pressable>
    );
  } else if (field.type === "select") {
    const current = typeof field.value === "string" ? field.value : null;
    value = (
      <Anchor anchor={choiceRef} onPress={() => setChoiceOpen(true)} open={choiceOpen} label={`${field.name}: ${current ?? "Empty"}`}>
        {current ? (
          <View className="bg-accent/[0.12] rounded-[6px] px-1.5 py-0.5">
            <Text className="text-accent text-[13px] font-medium">{current}</Text>
          </View>
        ) : (
          <Text className="text-ink-3 text-[14px]">Empty</Text>
        )}
      </Anchor>
    );
  } else {
    value = (
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder={field.type === "date" ? "YYYY-MM-DD" : field.type === "url" ? "https://…" : "Empty"}
          placeholderTextColor={c.ink3}
          keyboardType={field.type === "number" ? "decimal-pad" : field.type === "url" ? "url" : "default"}
          autoCapitalize={field.type === "url" ? "none" : "sentences"}
          accessibilityLabel={field.name}
          className="text-ink min-w-0 flex-1 text-[14px]"
          style={{ paddingVertical: 4 }}
        />
        {field.type === "url" && typeof field.value === "string" && field.value ? (
          <Pressable onPress={() => void openExternal(String(field.value))} hitSlop={6} accessibilityRole="link" accessibilityLabel="Open link">
            <Link2 size={14} color={c.accent} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Row label={labelNode} labelWidth={labelWidth} onLabel={() => setMenu(true)}>
        {value}
      </Row>
      <Popover anchorRef={nameRef} open={menu} onClose={() => {
        setMenu(false);
        if (name.trim() !== field.name) onChange({ ...field, name: name.trim().slice(0, 60) });
      }} width={240} accessibilityLabel="Field">
        <View className="p-2">
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => {
              setMenu(false);
              onChange({ ...field, name: name.trim().slice(0, 60) });
            }}
            placeholder="Field name"
            placeholderTextColor={c.ink3}
            className="bg-chip rounded-input text-ink mb-1.5 h-9 px-2.5 text-[14px]"
            style={{ paddingVertical: 0 }}
          />
          <MenuDivider />
          <MenuRow
            label="Remove field"
            danger
            icon={<Trash2 size={15} color={c.high} strokeWidth={2} />}
            onPress={() => {
              setMenu(false);
              onRemove();
            }}
          />
        </View>
      </Popover>
      {field.type === "select" ? (
        <Popover anchorRef={choiceRef} open={choiceOpen} onClose={() => setChoiceOpen(false)} width={220} accessibilityLabel={field.name}>
          <View className="p-1.5">
            <MenuRow label="Empty" selected={field.value === null} onPress={() => { setChoiceOpen(false); onChange({ ...field, value: null }); }} />
            {(field.options ?? []).map((o) => (
              <MenuRow key={o} label={o} selected={field.value === o} onPress={() => { setChoiceOpen(false); onChange({ ...field, value: o }); }} />
            ))}
            <TextInput
              value={newOption}
              onChangeText={setNewOption}
              onSubmitEditing={() => {
                const o = newOption.trim().slice(0, 60);
                setNewOption("");
                if (!o) return;
                const options = (field.options ?? []).includes(o) ? field.options ?? [] : [...(field.options ?? []), o].slice(0, 30);
                setChoiceOpen(false);
                onChange({ ...field, options, value: o });
              }}
              placeholder="New choice…"
              placeholderTextColor={c.ink3}
              className="bg-chip rounded-input text-ink mt-1 h-9 px-2.5 text-[14px]"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </Popover>
      ) : null}
    </>
  );
}
