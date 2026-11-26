import { describe, expect, it } from "vitest";

import { resolveNamedWatch } from "./alternatives.server";
import type { NameFacts } from "./watch-catalogue";

let next = 0;
/** A catalogue record; `complete` gives it the facts the finder compares. */
function row(
  brand: string,
  model: string,
  referenceCode: string,
  complete: boolean,
): NameFacts {
  next += 1;
  return {
    id: `00000000-0000-0000-0000-${String(next).padStart(12, "0")}`,
    brand,
    model,
    referenceCode,
    referenceConfirmed: true,
    reviewStatus: "approved",
    styles: complete ? ["sport"] : [],
    caseShape: "round",
    caseDiameterMm: complete ? 40 : null,
    movement: complete ? "automatic" : null,
    waterResistanceM: complete ? 100 : null,
    designTraits: null,
  };
}

const found = (result: ReturnType<typeof resolveNamedWatch<NameFacts>>) =>
  result.status === "found" ? result.watch.model : result.status;

describe("resolveNamedWatch: typed words", () => {
  it("matches a short word only as a whole word", () => {
    const catalogue = [
      row("Cartier", "Santos de Cartier Large", "WSSA0018", true),
      row("Cartier", "Santos Demoiselle", "W25064Z5", true),
    ];
    expect(
      found(resolveNamedWatch(catalogue, "Cartier Santos de Cartier", null)),
    ).toBe("Santos de Cartier Large");
  });

  it("still matches whole short words and the start of longer ones", () => {
    const catalogue = [
      row("Rolex", "Explorer II", "226570", true),
      row(
        "Omega",
        "Speedmaster Moonwatch Professional",
        "310.30.42.50.01.001",
        true,
      ),
    ];
    expect(found(resolveNamedWatch(catalogue, "Rolex Explorer II", null))).toBe(
      "Explorer II",
    );
    expect(
      found(resolveNamedWatch(catalogue, "Omega Speedmaster Moon", null)),
    ).toBe("Speedmaster Moonwatch Professional");
  });
});

describe("resolveNamedWatch: records the finder can compare", () => {
  it("settles on the fuller name when the name typed has no comparison facts", () => {
    const catalogue = [
      row("Rolex", "Daytona", "16519NG", false),
      row("Rolex", "Cosmograph Daytona", "126500LN", true),
      row("Rolex", "Cosmograph Daytona Yellow Gold", "126508", true),
    ];
    expect(found(resolveNamedWatch(catalogue, "Rolex Daytona", null))).toBe(
      "Cosmograph Daytona",
    );
  });

  it("asks which one, comparable models first, when several fit", () => {
    const catalogue = [
      row("Rolex", "Datejust", "69000A", false),
      row("Rolex", "Datejust 36", "126200", true),
      row("Rolex", "Datejust 41", "126300", true),
    ];
    const result = resolveNamedWatch(catalogue, "Rolex Datejust", null);
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.options.map((watch) => watch.model)).toEqual([
      "Datejust 36",
      "Datejust 41",
      "Datejust",
    ]);
  });

  it("keeps the record named when no record of that watch is complete", () => {
    const catalogue = [
      row("Patek Philippe", "Nautilus", "3800", false),
      row("Patek Philippe", "Nautilus Travel Time", "5990/1A", false),
    ];
    expect(
      found(resolveNamedWatch(catalogue, "Patek Philippe Nautilus", null)),
    ).toBe("Nautilus");
  });

  it("does not pick silently when the name itself does not settle", () => {
    const catalogue = [
      row("Omega", "Speedmaster 57", "332.10.41.51.01.001", false),
      row("Omega", "Speedmaster Racing", "329.30.44.51.01.001", false),
      row("Omega", "Speedmaster Moonwatch", "310.30.42.50.01.002", true),
    ];
    const result = resolveNamedWatch(catalogue, "Omega Speedmaster", null);
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.options[0]!.model).toBe("Speedmaster Moonwatch");
  });
});
