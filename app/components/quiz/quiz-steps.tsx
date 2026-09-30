/** Inputs for the price-range and wrist steps, and the hidden form fields. */
import {
  CASE_DIAMETER_MM_MAX,
  CASE_DIAMETER_MM_MIN,
  caseDiameterForWrist,
  PRICE_RANGES,
  priceRangeLabel,
  WRIST_CM_MAX,
  WRIST_CM_MIN,
} from "../../domain/questionnaire-v4";
import { ChoiceGroup, NumberField } from "../quiz-fields";
import {
  draftDiameter,
  profileFormFields,
  wristCm,
  wristPatch,
  type QuizDraft,
} from "./quiz-draft";

export function ProfileFields({ draft }: { draft: QuizDraft }) {
  return (
    <>
      {profileFormFields(draft).map((field, index) => (
        <input
          key={`${field.name}-${index}`}
          name={field.name}
          type="hidden"
          value={field.value}
        />
      ))}
    </>
  );
}

const RANGE_TIERS = [
  { label: "Under 10k", test: (minimum: number) => minimum < 10_000 },
  {
    label: "10k to 100k",
    test: (minimum: number) => minimum >= 10_000 && minimum < 100_000,
  },
  { label: "100k and above", test: (minimum: number) => minimum >= 100_000 },
];

export function PriceRangePicker({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="quiz-fieldset">
      <legend>Price range</legend>
      {RANGE_TIERS.map((tier) => (
        <div className="range-tier" key={tier.label}>
          <span className="range-tier__label">{tier.label}</span>
          <div className="chip-list">
            {PRICE_RANGES.filter((range) => tier.test(range.minimum)).map(
              (range) => (
                <label
                  className={`chip chip--radio chip--range ${value === range.id ? "is-selected" : ""}`}
                  key={range.id}
                >
                  <input
                    checked={value === range.id}
                    className="chip__input"
                    name="priceRangeChoice"
                    onChange={() => onChange(range.id)}
                    type="radio"
                    value={range.id}
                  />
                  <span>{priceRangeLabel(range, currency)}</span>
                </label>
              ),
            )}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

const QUICK_WRISTS_CM = [15, 16, 17, 18, 19, 20];

export function WristStep({
  draft,
  update,
}: {
  draft: QuizDraft;
  update: (patch: Partial<QuizDraft>) => void;
}) {
  const cm = wristCm(draft);
  const valid = cm !== null && cm >= WRIST_CM_MIN && cm <= WRIST_CM_MAX;
  const edited = draftDiameter(draft);
  const diameter = !valid
    ? null
    : edited && edited !== "invalid"
      ? edited
      : caseDiameterForWrist(cm);
  return (
    <>
      <ChoiceGroup
        legend="Measure in"
        name="wristUnit"
        onChange={(unit) => {
          const current = wristCm(draft);
          update({
            wristUnit: unit,
            wristValue:
              current === null
                ? draft.wristValue
                : String(
                    unit === "in"
                      ? Math.round((current / 2.54) * 10) / 10
                      : current,
                  ),
          });
        }}
        options={["cm", "in"] as const}
        renderLabel={(unit) => (unit === "cm" ? "Centimetres" : "Inches")}
        value={draft.wristUnit}
      />
      <div className="field-row field-row--single">
        <NumberField
          label="Wrist circumference"
          max={draft.wristUnit === "in" ? 10 : WRIST_CM_MAX}
          min={draft.wristUnit === "in" ? 4.5 : WRIST_CM_MIN}
          onChange={(value) => update(wristPatch(draft, { wristValue: value }))}
          placeholder={draft.wristUnit === "in" ? "e.g. 6.9" : "e.g. 17.5"}
          step={0.1}
          unit={draft.wristUnit}
          value={draft.wristValue}
        />
      </div>
      <div className="chip-list quick-picks" aria-label="Common wrist sizes">
        {QUICK_WRISTS_CM.map((size) => (
          <button
            className="chip"
            key={size}
            onClick={() =>
              update(
                wristPatch(draft, {
                  wristValue:
                    draft.wristUnit === "in"
                      ? String(Math.round((size / 2.54) * 10) / 10)
                      : String(size),
                }),
              )
            }
            type="button"
          >
            {draft.wristUnit === "in"
              ? `${Math.round((size / 2.54) * 10) / 10} in`
              : `${size} cm`}
          </button>
        ))}
      </div>
      <p className="wrist-note" aria-live="polite">
        {diameter
          ? `We'll look for cases of ${diameter.minimumMm}–${diameter.maximumMm} mm, which sit well on a ${cm} cm wrist. Adjust the range below if you prefer.`
          : "Wrap a soft tape or a strip of paper around your wrist just above the bone."}
      </p>
      {valid ? (
        <fieldset className="quiz-fieldset">
          <legend>Case diameter range</legend>
          <p className="field-hint">
            Only watches inside this range are suggested.
          </p>
          <div className="field-row">
            <NumberField
              label="Smallest case"
              max={CASE_DIAMETER_MM_MAX}
              min={CASE_DIAMETER_MM_MIN}
              onChange={(value) => update({ diameterMin: value })}
              placeholder={String(caseDiameterForWrist(cm).minimumMm)}
              step={0.5}
              unit="mm"
              value={draft.diameterMin}
            />
            <NumberField
              label="Largest case"
              max={CASE_DIAMETER_MM_MAX}
              min={CASE_DIAMETER_MM_MIN}
              onChange={(value) => update({ diameterMax: value })}
              placeholder={String(caseDiameterForWrist(cm).maximumMm)}
              step={0.5}
              unit="mm"
              value={draft.diameterMax}
            />
          </div>
          {edited === "invalid" ? (
            <p className="field-hint field-hint--error" role="alert">
              Enter both sizes between {CASE_DIAMETER_MM_MIN} and{" "}
              {CASE_DIAMETER_MM_MAX} mm, the smallest first.
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </>
  );
}
