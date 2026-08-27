import type { Route } from "./+types/home";
import { BeehiivSignup } from "../components/beehiiv-signup";
import { GaugeMark } from "../components/gauge-mark";
import "../styles/home.css";

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "The Reserve · Documentary & Horological Forensics" },
    {
      name: "description",
      content:
        "How watch companies live, die, and get resurrected. And who actually owns the name on the dial.",
    },
  ];
}

export function headers(): ReturnType<Route.HeadersFunction> {
  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
  };
}

export default function Home() {
  return (
    <div className="site-shell">
      <main className="landing" id="main-content">
        <div className="mark-container">
          <GaugeMark />
        </div>
        <h1>The Reserve</h1>
        <p className="manifesto">
          The brand tells you a story about heritage. We investigate the
          filings, the balance sheets, and who actually owns the name on the
          dial.
        </p>
        <BeehiivSignup />
      </main>

      <footer className="site-footer">
        <span>thereserve.watch</span>
        <span>Archival Documentary</span>
      </footer>
    </div>
  );
}
