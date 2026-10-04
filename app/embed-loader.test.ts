/**
 * public/embed.js, the script partners paste on their pages: it turns
 * data-reserve elements into widget frames and relays the widget's
 * messages. Run here in jsdom.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.resolve("public/embed.js"), "utf8");
const KEY = "pk_live_abcdefghijklmnopqrstuvwx";

type Loader = { version: string; scan: () => void };

function loadScript(attributes: Record<string, string>) {
  const script = document.createElement("script");
  script.src = "https://thereserve.watch/embed.js";
  for (const [name, value] of Object.entries(attributes))
    script.setAttribute(name, value);
  document.body.append(script);
  // jsdom doesn't fetch scripts: run the source with this tag as current.
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: script,
  });
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the shipped loader as a browser would
  (new Function(source) as () => void)();
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: null,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  delete (window as Window & { TheReserve?: Loader }).TheReserve;
});

describe("embed.js", () => {
  it("turns each data-reserve element into a themed widget frame", () => {
    document.body.innerHTML = `
      <div id="quiz" data-reserve="quiz"></div>
      <div id="find" data-reserve="find" data-scheme="dark" data-params="type=actor&q=Heat"></div>`;
    loadScript({
      "data-key": KEY,
      "data-scheme": "light",
      "data-accent": "#0A7CFF",
    });

    const quiz = document.querySelector<HTMLIFrameElement>("#quiz iframe")!;
    expect(quiz.src).toBe(
      `https://thereserve.watch/embed/${KEY}/quiz?scheme=light&accent=0A7CFF`,
    );
    expect(quiz.title).toBe("Watch finder by The Reserve");
    const find = document.querySelector<HTMLIFrameElement>("#find iframe")!;
    expect(find.src).toBe(
      `https://thereserve.watch/embed/${KEY}/find?type=actor&q=Heat&scheme=dark&accent=0A7CFF`,
    );
  });

  it("skips unknown features and missing keys with a console warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.body.innerHTML = `<div id="bad" data-reserve="casino"></div>`;
    loadScript({ "data-key": KEY });
    expect(document.querySelector("#bad iframe")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("resizes the frame and re-sends the widget's messages as events", () => {
    document.body.innerHTML = `<div id="quiz" data-reserve="quiz"></div>`;
    loadScript({ "data-key": KEY });
    const host = document.querySelector<HTMLElement>("#quiz")!;
    const iframe = host.querySelector("iframe")!;
    const seen: unknown[] = [];
    host.addEventListener("reserve:results", (event) =>
      seen.push((event as CustomEvent).detail),
    );

    const post = (data: unknown, origin = "https://thereserve.watch") =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data,
          origin,
          source: iframe.contentWindow,
        }),
      );
    post({ type: "reserve:resize", height: 812.4 });
    expect(iframe.style.height).toBe("813px");
    post({ type: "reserve:results", feature: "quiz", count: 5 });
    expect(seen).toEqual([
      { type: "reserve:results", feature: "quiz", count: 5 },
    ]);

    // Messages from any other website are ignored.
    post({ type: "reserve:resize", height: 10 }, "https://evil.example");
    expect(iframe.style.height).toBe("813px");
  });

  it("mounts widgets added later when the page calls scan()", () => {
    loadScript({ "data-key": KEY });
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="later" data-reserve="stories"></div>`,
    );
    (window as Window & { TheReserve?: Loader }).TheReserve!.scan();
    expect(document.querySelector("#later iframe")).not.toBeNull();
  });
});
