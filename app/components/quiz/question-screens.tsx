/**
 * The inputs of each question screen. The page around it (title, progress,
 * Back/Next) lives in app/routes/quiz.tsx.
 */
import {
  ALLERGY_CONSTRAINTS_V3,
  CRYSTAL_CHOICES,
  MOVEMENT_CONSTRUCTIONS,
  MOVEMENT_TYPE_CHOICES,
  WATER_RESISTANCE_MINIMUMS,
} from "../../domain/questionnaire-v3";
import { BUDGET_CURRENCIES } from "../../domain/questionnaire-v4";
import { CASE_SHAPES } from "../../domain/sheet-intake";
import {
  ChoiceGroup,
  NumberField,
  OptionalChoice,
  OptionCheckboxGroup,
  type Option,
} from "../quiz-fields";
import { labelFor } from "./labels";
import type { QuizDraft } from "./quiz-draft";
import { PriceRangePicker, WristStep } from "./quiz-steps";

export function QuestionScreen({
  step,
  draft,
  update,
  scenarios,
  complications,
  onStart,
}: {
  step: number;
  draft: QuizDraft;
  update: (patch: Partial<QuizDraft>) => void;
  scenarios: Option[];
  complications: Option[];
  /** Called on the first answer, for the "quiz started" analytics event. */
  onStart: () => void;
}) {
  return (
    <>
      {step === 0 ? (
        <>
          <ChoiceGroup
            legend="Currency"
            name="budgetCurrencyChoice"
            onChange={(value) => {
              onStart();
              update({ budgetCurrency: value });
            }}
            options={BUDGET_CURRENCIES}
            renderLabel={(value) => value}
            value={draft.budgetCurrency}
          />
          <PriceRangePicker
            currency={draft.budgetCurrency}
            onChange={(id) => {
              onStart();
              update({ priceRange: id });
            }}
            value={draft.priceRange}
          />
        </>
      ) : null}

      {step === 1 ? <WristStep draft={draft} update={update} /> : null}

      {step === 2 ? (
        <>
          <OptionCheckboxGroup
            hint="Tap every one that applies."
            legend="Wearing scenarios"
            onChange={(values) => update({ wearingScenarios: values })}
            options={scenarios}
            values={draft.wearingScenarios}
          />
          <ChoiceGroup
            legend="Minimum water resistance"
            name="minimumWaterResistanceM"
            onChange={(value) => update({ minimumWaterResistanceM: value })}
            options={WATER_RESISTANCE_MINIMUMS.map(String)}
            renderLabel={(value) =>
              value === "0" ? "No requirement" : `${value} m+`
            }
            value={draft.minimumWaterResistanceM}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <OptionCheckboxGroup
            legend="Movement types"
            onChange={(values) =>
              update({
                movementTypes: MOVEMENT_TYPE_CHOICES.filter((option) =>
                  values.includes(option),
                ),
              })
            }
            options={MOVEMENT_TYPE_CHOICES.map((option) => ({
              slug: option,
              labelEn: labelFor(option),
            }))}
            values={draft.movementTypes}
          />
          <OptionalChoice
            label="Calibre"
            onChange={(value) => update({ movementConstruction: value })}
            options={MOVEMENT_CONSTRUCTIONS}
            renderLabel={labelFor}
            value={draft.movementConstruction}
          />
        </>
      ) : null}

      {step === 4 ? (
        <>
          <OptionalChoice
            label="Case shape"
            onChange={(value) => update({ caseShape: value })}
            options={CASE_SHAPES}
            renderLabel={labelFor}
            value={draft.caseShape}
          />
          <div className="field-row field-row--single">
            <NumberField
              label="Max thickness"
              max={30}
              min={3}
              onChange={(value) => update({ maxCaseThicknessMm: value })}
              placeholder="Any"
              unit="mm"
              value={draft.maxCaseThicknessMm}
            />
          </div>
          <OptionalChoice
            label="Case back"
            onChange={(value) => update({ displayCaseback: value })}
            options={["yes", "no"] as const}
            renderLabel={(value) => (value === "yes" ? "Display" : "Solid")}
            value={draft.displayCaseback}
          />
          <OptionalChoice
            label="Crystal"
            onChange={(value) => update({ crystal: value })}
            options={CRYSTAL_CHOICES}
            renderLabel={labelFor}
            value={draft.crystal}
          />
          <OptionalChoice
            label="Clasp micro-adjustment"
            onChange={(value) => update({ microAdjustmentRequired: value })}
            options={["yes", "no"] as const}
            renderLabel={(value) =>
              value === "yes" ? "Required" : "Not wanted"
            }
            value={draft.microAdjustmentRequired}
          />
        </>
      ) : null}

      {step === 5 ? (
        <>
          <OptionCheckboxGroup
            legend="Required functions"
            onChange={(values) => update({ requiredComplications: values })}
            options={complications}
            values={draft.requiredComplications}
          />
          <ChoiceGroup
            legend="Skin contact"
            name="allergyConstraint"
            onChange={(value) => update({ allergyConstraint: value })}
            options={ALLERGY_CONSTRAINTS_V3}
            renderLabel={labelFor}
            value={draft.allergyConstraint}
          />
        </>
      ) : null}
    </>
  );
}
