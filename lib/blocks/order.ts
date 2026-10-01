import { movableBlockIds, type MovableBlockId } from "../site-document.ts";
import type { BlockId, BlockLayoutItem, BlockLook } from "./catalog.ts";

type OrderDraft = { sectionOrder?: readonly MovableBlockId[] };

function unitsFor(look: BlockLook): readonly BlockLayoutItem[] {
  return look.layout.main;
}

/**
 * Resolve a partial draft order against one look's default main-column order. Paired blocks are
 * one movable unit; when both members are named, their requested order controls the order inside
 * that unit while the unit itself stays together.
 */
export function effectiveBlockOrder(draft: OrderDraft, look: BlockLook): BlockId[] {
  const requested = draft.sectionOrder ?? [];
  const units = unitsFor(look);
  const defaultBlocks = units.flatMap((item) => typeof item === "string" ? [item] : [...item]);
  const movable = new Set<string>(movableBlockIds);
  if (!requested.length) return defaultBlocks;
  const rank = new Map<MovableBlockId, number>(requested.map((block, index) => [block, index]));
  const movableUnits = units.filter((item) => (typeof item === "string" ? movable.has(item) : item.some((block) => movable.has(block))));
  const sortedUnits = movableUnits.map((item, index) => {
    const members = typeof item === "string" ? [item] : [...item];
    const requestedRanks = members
      .map((member) => rank.get(member as MovableBlockId))
      .filter((value): value is number => value !== undefined);
    return { members, index, rank: requestedRanks.length ? Math.min(...requestedRanks) : requested.length + index };
  });
  sortedUnits.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const sorted = sortedUnits.flatMap(({ members }) => {
    if (members.length < 2) return members;
    return [...members].sort((a, b) => (rank.get(a as MovableBlockId) ?? requested.length) - (rank.get(b as MovableBlockId) ?? requested.length));
  });
  return defaultBlocks.map((block) => (movable.has(block) ? sorted.shift()! : block));
}
