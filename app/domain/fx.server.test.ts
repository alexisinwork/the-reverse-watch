import { vi } from "vitest";

import { convert, loadFxTable, parseEcbDailyXml } from "./fx.server";

const XML = `<?xml version="1.0"?><gesmes:Envelope><Cube><Cube time='2026-09-29'>
<Cube currency='USD' rate='1.1355'/><Cube currency='GBP' rate='0.85718'/>
<Cube currency='CHF' rate='0.9461'/><Cube currency='JPY' rate='178.41'/>
<Cube currency='PLN' rate='4.3653'/><Cube currency='SEK' rate='11.3210'/>
<Cube currency='NOK' rate='10.8735'/><Cube currency='AUD' rate='1.6211'/>
<Cube currency='CAD' rate='1.6101'/><Cube currency='SGD' rate='1.4504'/>
</Cube></Cube></gesmes:Envelope>`;

describe("ECB reference rates", () => {
  it("parses the daily feed including EUR itself", () => {
    const table = parseEcbDailyXml(XML);
    expect(table.date).toBe("2026-09-29");
    expect(table.perEur).toMatchObject({ EUR: 1, USD: 1.1355, JPY: 178.41 });
  });

  it("converts through EUR between any two listed currencies", () => {
    const table = parseEcbDailyXml(XML);
    expect(convert(1_000, "EUR", "USD", table)).toBeCloseTo(1_135.5);
    expect(convert(1_135.5, "USD", "EUR", table)).toBeCloseTo(1_000);
    expect(convert(100, "GBP", "CHF", table)).toBeCloseTo(
      (100 / 0.85718) * 0.9461,
    );
    expect(convert(100, "XXX", "EUR", table)).toBeNull();
  });

  it("rejects a feed without a date or with too few rates", () => {
    expect(() => parseEcbDailyXml("<Cube></Cube>")).toThrow();
    expect(() =>
      parseEcbDailyXml(
        "<Cube time='2026-09-29'><Cube currency='USD' rate='1.1'/></Cube>",
      ),
    ).toThrow();
  });

  it("caches the table and falls back to it when the feed fails", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(XML))
      .mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const first = await loadFxTable(fetchImpl, () => now);
    now = 7 * 60 * 60 * 1000;
    const second = await loadFxTable(fetchImpl, () => now);

    expect(first?.perEur.USD).toBe(1.1355);
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
