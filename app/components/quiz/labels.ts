/** Human labels for the quiz's stored option values. */
const LABELS: Record<string, string> = {
  automatic: "Automatic",
  manual: "Hand-wound",
  quartz: "Quartz",
  solar: "Solar",
  spring_drive: "Spring Drive",
  hybrid: "Hybrid",
  mass_produced: "Widely produced calibre",
  manufacture: "In-house calibre",
  sapphire: "Sapphire",
  mineral: "Mineral",
  acrylic: "Acrylic",
  other: "Other",
  round: "Round",
  tonneau: "Tonneau",
  rectangular: "Rectangular",
  cushion: "Cushion",
  square: "Square",
  oval: "Oval",
  none: "No allergy",
  nickel_contact: "Nickel allergy: no steel on skin",
};

export function labelFor(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
}
