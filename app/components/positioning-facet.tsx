export type PositioningGroupOption = {
  slug: string;
  labelEn: string;
};

export function PositioningFacet({
  groups,
  selected,
  onSelect,
}: {
  groups: readonly PositioningGroupOption[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="positioning-facet" role="group" aria-label="Positioning">
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {groups.map((group) => (
        <button
          key={group.slug}
          type="button"
          aria-pressed={selected === group.slug}
          onClick={() => onSelect(group.slug)}
        >
          {group.labelEn}
        </button>
      ))}
    </div>
  );
}
