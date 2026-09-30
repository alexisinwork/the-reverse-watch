import { createHash } from "node:crypto";

import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/admin-catalogue";
import {
  adminLogin,
  adminLogout,
  isAdmin,
  parseAdminConfiguration,
} from "../domain/admin-auth.server";
import {
  consumeRateLimit,
  type RateLimitPolicy,
} from "../domain/rate-limit.server";
import {
  CATALOGUE_STYLES,
  STYLE_LABELS,
  wristFitLabel,
  type CatalogueStyle,
  type CatalogueWatch,
} from "../domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  recordCataloguePrice,
  reviewCatalogueWatch,
  type ReviewPatch,
} from "../domain/watch-catalogue.server";
import "../styles/admin.css";

const PAGE_SIZE = 60;
const FILTERS = ["pending", "approved", "rejected", "price", "all"] as const;
type Filter = (typeof FILTERS)[number];

const LOGIN_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 10,
  windowMs: 15 * 60 * 1_000,
};

const NO_INDEX = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

function visitorKey(request: Request) {
  const address =
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `admin-login:${createHash("sha256").update(address).digest("hex")}`;
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "Catalogue review · The Reserve" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

type Row = Pick<
  CatalogueWatch,
  | "id"
  | "brand"
  | "model"
  | "referenceCode"
  | "referenceConfirmed"
  | "styles"
  | "caseDiameterMm"
  | "waterResistanceM"
  | "movement"
  | "caseMaterial"
  | "casebackMaterial"
  | "strapMaterial"
  | "priceAmount"
  | "priceCurrency"
  | "priceStatus"
  | "priceCheckedAt"
  | "priceChange"
  | "sourceUrl"
  | "sourceKind"
  | "imageUrl"
  | "rationale"
  | "reviewStatus"
> & { wristFit: string };

function matchesFilter(watch: CatalogueWatch, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "price") return watch.priceChange !== null;
  return watch.reviewStatus === filter;
}

export async function loader({ request }: Route.LoaderArgs) {
  const configured = parseAdminConfiguration().configured;
  if (!(await isAdmin(request))) {
    return data({ authed: false as const, configured }, { headers: NO_INDEX });
  }
  const client = catalogueClient();
  if (!client) {
    return data(
      {
        authed: true as const,
        error: "The catalogue store is not configured.",
        rows: [],
        counts: {},
        filter: "pending",
        query: "",
        page: 1,
        pages: 1,
      },
      { headers: NO_INDEX },
    );
  }
  const url = new URL(request.url);
  const filterParam = url.searchParams.get("status") ?? "pending";
  const filter: Filter = (FILTERS as readonly string[]).includes(filterParam)
    ? (filterParam as Filter)
    : "pending";
  const query = (url.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const all = await listCatalogue(client, true);
  const counts = Object.fromEntries(
    FILTERS.map((name) => [
      name,
      all.filter((watch) => matchesFilter(watch, name)).length,
    ]),
  );
  const filtered = all.filter(
    (watch) =>
      matchesFilter(watch, filter) &&
      (!query ||
        `${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}`
          .toLowerCase()
          .includes(query)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows: Row[] = filtered
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map((watch) => ({
      id: watch.id,
      brand: watch.brand,
      model: watch.model,
      referenceCode: watch.referenceCode,
      referenceConfirmed: watch.referenceConfirmed,
      styles: watch.styles,
      caseDiameterMm: watch.caseDiameterMm,
      waterResistanceM: watch.waterResistanceM,
      movement: watch.movement,
      caseMaterial: watch.caseMaterial,
      casebackMaterial: watch.casebackMaterial,
      strapMaterial: watch.strapMaterial,
      priceAmount: watch.priceAmount,
      priceCurrency: watch.priceCurrency,
      priceStatus: watch.priceStatus,
      priceCheckedAt: watch.priceCheckedAt,
      priceChange: watch.priceChange,
      sourceUrl: watch.sourceUrl,
      sourceKind: watch.sourceKind,
      imageUrl: watch.imageUrl,
      rationale: watch.rationale,
      reviewStatus: watch.reviewStatus,
      wristFit: wristFitLabel(watch.caseDiameterMm),
    }));
  return data(
    {
      authed: true as const,
      error: null,
      rows,
      counts,
      filter,
      query,
      page: Math.min(page, pages),
      pages,
    },
    { headers: NO_INDEX },
  );
}

const EDIT_FIELDS = [
  "brand",
  "model",
  "referenceCode",
  "caseDiameterMm",
  "waterResistanceM",
  "movement",
  "caseMaterial",
  "casebackMaterial",
  "strapMaterial",
  "priceAmount",
  "priceCurrency",
  "sourceUrl",
  "imageUrl",
  "rationale",
] as const;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function editPatch(formData: FormData): ReviewPatch | string {
  const patch: Record<string, unknown> = {};
  for (const field of EDIT_FIELDS) {
    const value = formData.get(field);
    const original = formData.get(`original_${field}`);
    if (
      typeof value !== "string" ||
      value.trim() === (typeof original === "string" ? original : "")
    )
      continue;
    patch[field] = value.trim().slice(0, 500);
  }
  for (const field of [
    "caseDiameterMm",
    "waterResistanceM",
    "priceAmount",
  ] as const) {
    const value = patch[field];
    if (
      typeof value === "string" &&
      value !== "" &&
      !Number.isFinite(Number(value))
    ) {
      return `${field} must be a number.`;
    }
  }
  for (const field of ["sourceUrl", "imageUrl"] as const) {
    const value = patch[field];
    if (
      typeof value === "string" &&
      value !== "" &&
      !/^https?:\/\//.test(value)
    ) {
      return `${field} must start with http:// or https://.`;
    }
  }
  if (typeof patch.priceCurrency === "string" && patch.priceCurrency !== "") {
    patch.priceCurrency = patch.priceCurrency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(patch.priceCurrency as string))
      return "priceCurrency must be a 3-letter code.";
    // A currency change alone still has to go through the price field.
    if (!("priceAmount" in patch))
      patch.priceAmount = field(formData, "original_priceAmount");
  }
  if (
    typeof patch.movement === "string" &&
    patch.movement !== "" &&
    ![
      "automatic",
      "manual",
      "quartz",
      "solar",
      "spring_drive",
      "hybrid",
    ].includes(patch.movement)
  ) {
    return "movement must be automatic, manual, quartz, solar, spring_drive or hybrid.";
  }
  const styles = formData
    .getAll("styles")
    .filter(
      (value): value is CatalogueStyle =>
        typeof value === "string" &&
        (CATALOGUE_STYLES as readonly string[]).includes(value),
    );
  const originalStyles = field(formData, "original_styles");
  if (styles.join(",") !== originalStyles) patch.styles = styles;
  const confirmed = formData.get("referenceConfirmed") === "yes";
  if (String(confirmed) !== formData.get("original_referenceConfirmed"))
    patch.referenceConfirmed = confirmed;
  return patch;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = field(formData, "intent");
  const back = new URL(request.url);

  if (intent === "login") {
    if (!consumeRateLimit(visitorKey(request), LOGIN_POLICY).allowed) {
      return data(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429, headers: NO_INDEX },
      );
    }
    const cookie = await adminLogin(field(formData, "password"));
    if (!cookie)
      return data(
        { error: "Wrong password." },
        { status: 401, headers: NO_INDEX },
      );
    return redirect(back.pathname + back.search, {
      headers: { "Set-Cookie": cookie },
    });
  }
  if (!(await isAdmin(request)))
    return data(
      { error: "Sign in first." },
      { status: 401, headers: NO_INDEX },
    );
  if (intent === "logout") {
    const cookie = await adminLogout();
    return redirect(
      "/admin/catalogue",
      cookie ? { headers: { "Set-Cookie": cookie } } : undefined,
    );
  }

  const client = catalogueClient();
  const id = field(formData, "id");
  if (!client || !/^[0-9a-f-]{36}$/.test(id)) {
    return data(
      { error: "Unknown watch or store not configured." },
      { status: 400, headers: NO_INDEX },
    );
  }
  if (intent === "approve" || intent === "reject" || intent === "pending") {
    await reviewCatalogueWatch(
      client,
      id,
      intent === "approve"
        ? "approved"
        : intent === "reject"
          ? "rejected"
          : "pending",
    );
  } else if (intent === "edit" || intent === "edit_approve") {
    const patch = editPatch(formData);
    if (typeof patch === "string")
      return data({ error: patch }, { status: 400, headers: NO_INDEX });
    await reviewCatalogueWatch(
      client,
      id,
      intent === "edit_approve" ? "approved" : null,
      patch,
    );
  } else if (intent === "accept_price" || intent === "dismiss_price") {
    await recordCataloguePrice(client, id, {
      kind: intent === "accept_price" ? "accept" : "dismiss",
    });
  } else {
    return data(
      { error: "Unknown action." },
      { status: 400, headers: NO_INDEX },
    );
  }
  return redirect(back.pathname + back.search);
}

function money(amount: number | null, currency: string | null) {
  if (amount === null || !currency) return "—";
  return `${currency} ${Math.round(amount).toLocaleString("en")}`;
}

function ActionError() {
  const result = useActionData<typeof action>();
  return result && "error" in result ? (
    <p className="warn" role="alert">
      {result.error}
    </p>
  ) : null;
}

function Login({ configured }: { configured: boolean }) {
  const navigation = useNavigation();
  return (
    <main className="admin-shell admin-shell--narrow">
      <h1>Catalogue review</h1>
      <ActionError />
      {configured ? (
        <Form className="admin-login" method="post">
          <input name="intent" type="hidden" value="login" />
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="button button--primary"
            disabled={navigation.state !== "idle"}
            type="submit"
          >
            Sign in
          </button>
        </Form>
      ) : (
        <p>
          The review page is not configured (ADMIN_PASSWORD and SESSION_SECRET).
        </p>
      )}
    </main>
  );
}

function hidden(name: string, value: string | number | null | undefined) {
  return (
    <input
      name={`original_${name}`}
      type="hidden"
      value={value === null || value === undefined ? "" : String(value)}
    />
  );
}

function EditForm({ row }: { row: Row }) {
  const text = (
    name: (typeof EDIT_FIELDS)[number],
    label: string,
    value: string | number | null,
  ) => (
    <label key={name}>
      <span>{label}</span>
      <input defaultValue={value ?? ""} name={name} />
      {hidden(name, value)}
    </label>
  );
  return (
    <details className="admin-edit">
      <summary>Edit</summary>
      <Form method="post">
        <input name="id" type="hidden" value={row.id} />
        <div className="admin-edit__grid">
          {text("brand", "Brand", row.brand)}
          {text("model", "Model", row.model)}
          {text("referenceCode", "Reference", row.referenceCode)}
          {text("caseDiameterMm", "Diameter (mm)", row.caseDiameterMm)}
          {text(
            "waterResistanceM",
            "Water resistance (m)",
            row.waterResistanceM,
          )}
          {text("movement", "Movement", row.movement)}
          {text("caseMaterial", "Case material", row.caseMaterial)}
          {text("casebackMaterial", "Case-back material", row.casebackMaterial)}
          {text("strapMaterial", "Strap / bracelet", row.strapMaterial)}
          {text("priceAmount", "Price", row.priceAmount)}
          {text("priceCurrency", "Currency", row.priceCurrency)}
          {text("sourceUrl", "Source URL", row.sourceUrl)}
          {text("imageUrl", "Image URL", row.imageUrl)}
          {text("rationale", "Why", row.rationale)}
        </div>
        <fieldset className="admin-edit__styles">
          <legend>Styles</legend>
          {CATALOGUE_STYLES.map((style) => (
            <label key={style}>
              <input
                defaultChecked={row.styles.includes(style)}
                name="styles"
                type="checkbox"
                value={style}
              />
              {STYLE_LABELS[style]}
            </label>
          ))}
          <input
            name="original_styles"
            type="hidden"
            value={CATALOGUE_STYLES.filter((style) =>
              row.styles.includes(style),
            ).join(",")}
          />
        </fieldset>
        <label className="admin-edit__check">
          <input
            defaultChecked={row.referenceConfirmed}
            name="referenceConfirmed"
            type="checkbox"
            value="yes"
          />
          Reference confirmed on a maker&apos;s or authorised retailer&apos;s
          page
          <input
            name="original_referenceConfirmed"
            type="hidden"
            value={String(row.referenceConfirmed)}
          />
        </label>
        <p className="admin-note">
          A price you type here is stored as confirmed by you.
        </p>
        <div className="admin-actions">
          <button
            className="button button--quiet"
            name="intent"
            type="submit"
            value="edit"
          >
            Save
          </button>
          <button
            className="button button--primary"
            name="intent"
            type="submit"
            value="edit_approve"
          >
            Save and approve
          </button>
        </div>
      </Form>
    </details>
  );
}

function WatchRow({ row }: { row: Row }) {
  return (
    <article className={`admin-row admin-row--${row.reviewStatus}`}>
      {row.imageUrl ? (
        <img
          alt=""
          className="admin-row__image"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={row.imageUrl}
        />
      ) : (
        <div className="admin-row__image admin-row__image--empty">No photo</div>
      )}
      <div className="admin-row__body">
        <h2>
          {row.brand} {row.model}
        </h2>
        <p className="admin-row__meta">
          <span>Ref. {row.referenceCode ?? "—"}</span>
          <span className={row.referenceConfirmed ? "ok" : "warn"}>
            {row.referenceConfirmed
              ? `confirmed (${row.sourceKind ?? "source"})`
              : "reference not confirmed"}
          </span>
          <span className={`status status--${row.reviewStatus}`}>
            {row.reviewStatus}
          </span>
        </p>
        <p className="admin-row__facts">
          {money(row.priceAmount, row.priceCurrency)}{" "}
          <em>
            {row.priceStatus === "confirmed"
              ? "price confirmed"
              : "price not confirmed"}
          </em>
          {row.priceCheckedAt
            ? ` · checked ${row.priceCheckedAt.slice(0, 10)}`
            : ""}{" "}
          · {row.caseDiameterMm ?? "?"} mm (wrist {row.wristFit}) ·{" "}
          {row.waterResistanceM ?? "?"} m · {row.movement ?? "?"} ·{" "}
          {row.styles.map((style) => STYLE_LABELS[style]).join(", ") ||
            "no style"}
        </p>
        <p className="admin-row__facts">
          Case {row.caseMaterial ?? "?"} · back {row.casebackMaterial ?? "?"} ·
          strap {row.strapMaterial ?? "?"}
        </p>
        {row.rationale ? (
          <p className="admin-row__why">{row.rationale}</p>
        ) : null}
        {row.sourceUrl ? (
          <a href={row.sourceUrl} rel="noreferrer nofollow" target="_blank">
            {row.sourceUrl}
          </a>
        ) : (
          <span className="warn">No source page</span>
        )}
        {row.priceChange ? (
          <Form className="admin-price-change" method="post">
            <input name="id" type="hidden" value={row.id} />
            <span>
              Price recheck found{" "}
              {money(row.priceChange.amount, row.priceChange.currency)} (stored{" "}
              {money(row.priceAmount, row.priceCurrency)}).
            </span>
            <button
              className="button button--primary"
              name="intent"
              type="submit"
              value="accept_price"
            >
              Accept new price
            </button>
            <button
              className="button button--quiet"
              name="intent"
              type="submit"
              value="dismiss_price"
            >
              Keep old price
            </button>
          </Form>
        ) : null}
        <Form className="admin-actions" method="post">
          <input name="id" type="hidden" value={row.id} />
          {row.reviewStatus !== "approved" ? (
            <button
              className="button button--primary"
              name="intent"
              type="submit"
              value="approve"
            >
              Approve
            </button>
          ) : null}
          {row.reviewStatus !== "rejected" ? (
            <button
              className="button button--quiet"
              name="intent"
              type="submit"
              value="reject"
            >
              Reject
            </button>
          ) : null}
          {row.reviewStatus !== "pending" ? (
            <button
              className="button button--quiet"
              name="intent"
              type="submit"
              value="pending"
            >
              Back to pending
            </button>
          ) : null}
        </Form>
        <EditForm row={row} />
      </div>
    </article>
  );
}

export default function AdminCatalogue() {
  const loaded = useLoaderData<typeof loader>();
  if (!loaded.authed) return <Login configured={loaded.configured} />;
  const { rows, counts, filter, query, page, pages, error } = loaded;
  const link = (params: Record<string, string | number>) => {
    const search = new URLSearchParams({
      status: filter,
      ...(query ? { q: query } : {}),
      ...Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ),
    });
    return `/admin/catalogue?${search.toString()}`;
  };
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link to="/">The Reserve</Link>
          <h1>Catalogue review</h1>
        </div>
        <Form method="post">
          <button
            className="button button--quiet"
            name="intent"
            type="submit"
            value="logout"
          >
            Sign out
          </button>
        </Form>
      </header>
      {error ? <p className="warn">{error}</p> : null}
      <ActionError />
      <nav className="admin-filters" aria-label="Filter">
        {FILTERS.map((name) => (
          <Link
            className={`chip ${filter === name ? "is-selected" : ""}`}
            key={name}
            to={`/admin/catalogue?status=${name}`}
          >
            {name === "price"
              ? "Price changes"
              : name[0]!.toUpperCase() + name.slice(1)}{" "}
            ({(counts as Record<string, number>)[name] ?? 0})
          </Link>
        ))}
        <Form className="admin-search" method="get">
          <input name="status" type="hidden" value={filter} />
          <input
            defaultValue={query}
            name="q"
            placeholder="Brand, model or reference"
            type="search"
          />
        </Form>
      </nav>
      {rows.length === 0 ? (
        <p>Nothing here.</p>
      ) : (
        rows.map((row) => <WatchRow key={row.id} row={row} />)
      )}
      {pages > 1 ? (
        <nav className="admin-pages" aria-label="Pages">
          {page > 1 ? (
            <Link to={link({ page: page - 1 })}>Previous</Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link to={link({ page: page + 1 })}>Next</Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
