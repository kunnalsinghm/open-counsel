"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { ChoiceListItem } from "@/lib/types";

const BAND_STYLES: Record<string, string> = {
  DREAM: "bg-purple-50 text-purple-700 border-purple-200",
  TARGET: "bg-amber-50 text-amber-700 border-amber-200",
  SAFE: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function Row({ item, onRemove }: { item: ChoiceListItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${item.instituteId}-${item.branchId}-${item.quota}-${item.category}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card flex items-center gap-3 p-3 transition-shadow ${isDragging ? "shadow-lg ring-2 ring-brand-300" : "hover:border-brand-200"}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="w-9 shrink-0 text-center text-sm font-bold text-brand-700">
        #{item.preferenceNumber}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-900">
          {item.instituteName} — {item.branchShortCode}
        </p>
        <p className="text-xs text-slate-500">
          {item.instituteType} · {item.quota} · {item.category} · Closing rank{" "}
          {item.historicalClosingRank.toLocaleString("en-IN")}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${BAND_STYLES[item.riskBand]}`}
      >
        {item.riskBand}
      </span>
      <span className="hidden shrink-0 text-xs text-slate-500 sm:block">
        {item.confidence} confidence
      </span>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Remove choice"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ChoiceTable({
  items,
  setItems,
}: {
  items: ChoiceListItem[];
  setItems: (items: ChoiceListItem[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  function idOf(item: ChoiceListItem) {
    return `${item.instituteId}-${item.branchId}-${item.quota}-${item.category}`;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => idOf(i) === active.id);
    const newIndex = items.findIndex((i) => idOf(i) === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      preferenceNumber: idx + 1,
    }));
    setItems(reordered);
  }

  function handleRemove(idx: number) {
    const next = items.filter((_, i) => i !== idx).map((item, i) => ({
      ...item,
      preferenceNumber: i + 1,
    }));
    setItems(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(idOf)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <Row key={idOf(item)} item={item} onRemove={() => handleRemove(idx)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
