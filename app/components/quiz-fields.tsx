import { useId } from "react";

export function humanize(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type Option = { slug: string; labelEn: string };

/**
 * One-tap pills. Form state lives in React and is posted through hidden
 * fields, so these radio names only group the pills and are never posted.
 */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  renderLabel = humanize,
  hint,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T) => void;
  renderLabel?: (value: T) => string;
  hint?: string;
}) {
  return (
    <fieldset className="quiz-fieldset">
      <legend>{legend}</legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      <div className="chip-list">
        {options.map((option) => (
          <label
            className={`chip chip--radio ${value === option ? "is-selected" : ""}`}
            key={option}
          >
            <input
              checked={value === option}
              className="chip__input"
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            <span>{renderLabel(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function OptionCheckboxGroup({
  legend,
  hint,
  options,
  values,
  onChange,
}: {
  legend: string;
  hint?: string;
  options: readonly Option[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (slug: string) =>
    onChange(
      values.includes(slug)
        ? values.filter((value) => value !== slug)
        : [...values, slug],
    );

  return (
    <fieldset className="quiz-fieldset">
      <legend>
        {legend}
        {values.length > 0 ? (
          <span className="legend-count"> · {values.length} selected</span>
        ) : null}
      </legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      <div className="chip-list">
        {options.map((option) => (
          <label
            className={`chip ${values.includes(option.slug) ? "is-selected" : ""}`}
            key={option.slug}
          >
            <input
              checked={values.includes(option.slug)}
              className="chip__input"
              onChange={() => toggle(option.slug)}
              type="checkbox"
              value={option.slug}
            />
            <span aria-hidden="true" className="chip__mark" />
            <span>{option.labelEn}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function OptionalChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLabel = humanize,
}: {
  label: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T | "") => void;
  renderLabel?: (value: T) => string;
}) {
  const name = useId();
  return (
    <ChoiceGroup<T | "none-selected">
      legend={label}
      name={name}
      onChange={(next) => onChange(next === "none-selected" ? "" : next)}
      options={["none-selected", ...options]}
      renderLabel={(option) =>
        option === "none-selected" ? "No preference" : renderLabel(option)
      }
      value={value === "" ? "none-selected" : value}
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  unit?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        {prefix ? <span className="field__affix">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          step={step}
          type="number"
          value={value}
        />
        {unit ? <span className="field__affix">{unit}</span> : null}
      </div>
    </div>
  );
}
