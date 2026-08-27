import React, { useState } from 'react';

export type QuestionnaireState = {
  priceBracket: 'under_300' | '300_500' | '500_1000' | '1000_2000' | '2000_5000' | '5000_10000' | '10000_15000' | '15000_plus' | null;
  wristCircumference: 'under_6_0' | '6_0_to_6_5' | '6_5_to_7_25' | '7_25_to_8_0' | 'above_8_0' | null;
  maintenanceTolerance: 'zero_maintenance' | 'workhorse' | 'in_house' | null;
  deploymentEnvironment: 'field_abuse' | 'studio_desk' | 'formal_dress' | null;
  socialSignal: 'discreet_competence' | 'quiet_continuity' | 'unapologetic_success' | 'anti_luxury' | null;
  aestheticDna: 'structural_tool' | 'mid_century' | 'integrated_geometry' | 'extravagant_creative' | 'high_art' | null;
  provenancePreference: 'sovereign_independent' | 'industrial_reality' | 'modern_transparent' | null;
  emotionalObjective: 'dependability' | 'custody' | 'differentiation' | 'milestone' | null;
  email?: string;
};

export const INITIAL_STATE: QuestionnaireState = {
  priceBracket: null,
  wristCircumference: null,
  maintenanceTolerance: null,
  deploymentEnvironment: null,
  socialSignal: null,
  aestheticDna: null,
  provenancePreference: null,
  emotionalObjective: null,
  email: '',
};

interface QuestionOption {
  label: string;
  sublabel?: string;
  value: string;
}

interface QuestionConfig {
  id: keyof QuestionnaireState;
  title: string;
  subtitle?: string;
  tip?: string;
  options: QuestionOption[];
}

export const QUESTIONS: QuestionConfig[] = [
  {
    id: 'priceBracket',
    title: 'Acquisition Constraint',
    subtitle: 'Select the upper capital ceiling for this reference.',
    options: [
      { label: 'Under $300', sublabel: 'Tool / Utilitarian / Grab-and-go', value: 'under_300' },
      { label: '$300 – $500', sublabel: 'Value Mechanical / Tactical Beater', value: '300_500' },
      { label: '$500 – $1,000', sublabel: 'Entry Swiss / Enthusiast Mechanical', value: '500_1000' },
      { label: '$1,000 – $2,000', sublabel: 'Established Mid-Tier / Heritage Entry', value: '1000_2000' },
      { label: '$2,000 – $5,000', sublabel: 'Core Workhorse / Luxury Entry', value: '2000_5000' },
      { label: '$5,000 – $10,000', sublabel: 'Luxury Benchmark / Institutional Standard', value: '5000_10000' },
      { label: '$10,000 – $15,000', sublabel: 'High Manufacture / Core Independent', value: '10000_15000' },
      { label: '$15,000+', sublabel: 'High Horology / Sovereign Custody', value: '15000_plus' },
    ],
  },
  {
    id: 'wristCircumference',
    title: 'Wrist Circumference',
    subtitle: 'Physical case dimension is bound to effective lug-to-lug span.',
    tip: 'Measurement Guide: Wrap a flexible tape flush above your wrist bone without slack.',
    options: [
      { label: 'Under 6.0 in (< 152 mm)', sublabel: 'Target: Sub-36mm (Lug-to-lug < 43mm)', value: 'under_6_0' },
      { label: '6.0 – 6.5 in (152 – 165 mm)', sublabel: 'Target: 36mm – 39mm (Lug-to-lug 43–46mm)', value: '6_0_to_6_5' },
      { label: '6.5 – 7.25 in (165 – 184 mm)', sublabel: 'Target: 38mm – 42mm (Lug-to-lug 45–49mm)', value: '6_5_to_7_25' },
      { label: '7.25 – 8.0 in (184 – 203 mm)', sublabel: 'Target: 41mm – 45mm (Lug-to-lug 48–53mm)', value: '7_25_to_8_0' },
      { label: 'Above 8.0 in (> 203 mm)', sublabel: 'Target: 44mm+ (Lug-to-lug > 52mm)', value: 'above_8_0' },
    ],
  },
  {
    id: 'maintenanceTolerance',
    title: 'Operational Friction',
    subtitle: 'How do you view servicing and accuracy tolerance?',
    options: [
      { label: 'Zero Maintenance', sublabel: 'Grab-and-go precision (Quartz, Solar, Digital)', value: 'zero_maintenance' },
      { label: 'Workhorse Mechanical', sublabel: 'Standard 5–7 yr service with non-proprietary calibres', value: 'workhorse' },
      { label: 'In-House Manufacture', sublabel: 'Specialist maintenance intervals, accepting brand lock-in', value: 'in_house' },
    ],
  },
  {
    id: 'deploymentEnvironment',
    title: 'Deployment Environment',
    subtitle: 'Where does the piece spend 80% of its operational life?',
    options: [
      { label: 'Field / Water / Abuse', sublabel: 'Shock-proofed, minimum 100m water resistance', value: 'field_abuse' },
      { label: 'Studio / Desk / Daily', sublabel: 'Versatile, low-profile under-cuff clearance', value: 'studio_desk' },
      { label: 'Formal / Architectural', sublabel: 'Dress profile, pure dial balance over durability', value: 'formal_dress' },
    ],
  },
  {
    id: 'socialSignal',
    title: 'Social Signal',
    subtitle: 'What does the watch project when entering an environment?',
    options: [
      { label: 'Discreet Competence', sublabel: 'Legible only to collectors; invisible to the mainstream', value: 'discreet_competence' },
      { label: 'Quiet Continuity', sublabel: 'Lineage and understated design over recognition', value: 'quiet_continuity' },
      { label: 'Unapologetic Benchmark', sublabel: 'Maximum institutional awareness and liquidity', value: 'unapologetic_success' },
      { label: 'Counter-Signal / Tool', sublabel: 'Total indifference to luxury; pure utility', value: 'anti_luxury' },
    ],
  },
  {
    id: 'aestheticDna',
    title: 'Aesthetic DNA',
    subtitle: 'Select the design philosophy you align with.',
    options: [
      { label: 'Structural Tool', sublabel: 'Form driven by seals, screws, and shock absorption', value: 'structural_tool' },
      { label: 'Mid-Century Industrial', sublabel: 'Round utilitarian instrumentation (Pilot, Field, Diver)', value: 'mid_century' },
      { label: 'Integrated Geometry', sublabel: 'Architectural case angles with integrated links', value: 'integrated_geometry' },
      { label: 'Extravagant / Creative', sublabel: 'Asymmetrical forms, avant-garde and sculptural displays', value: 'extravagant_creative' },
      { label: 'High Art & Finishing', sublabel: 'Glashütte 3/4 plates, internal anglage, and hand-beveling', value: 'high_art' },
    ],
  },
  {
    id: 'provenancePreference',
    title: 'Corporate Provenance',
    subtitle: 'How do you view corporate ownership versus brand heritage?',
    options: [
      { label: 'Pure Sovereignty', sublabel: 'Independent or foundation-backed ownership only', value: 'sovereign_independent' },
      { label: 'Industrial Pragmatism', sublabel: 'Shared conglomerate infrastructure is acceptable for better execution', value: 'industrial_reality' },
      { label: 'Modern Transparency', sublabel: 'Direct microbrand transparency over manufactured heritage claims', value: 'modern_transparent' },
    ],
  },
  {
    id: 'emotionalObjective',
    title: 'Emotional Objective',
    subtitle: 'What primary role is this reference solving for you?',
    options: [
      { label: 'Dependable Armor', sublabel: 'An unyielding object that reduces daily friction', value: 'dependability' },
      { label: 'Generational Custody', sublabel: 'An heirloom reference to outlive its owner', value: 'custody' },
      { label: 'Creative Differentiation', sublabel: 'An intellectual choice reflecting individual taste', value: 'differentiation' },
      { label: 'Milestone Marker', sublabel: 'A record of personal accomplishment and career stability', value: 'milestone' },
    ],
  },
];

export function useWatchDiagnostic() {
  const [step, setStep] = useState<number>(0);
  const [answers, setAnswers] = useState<QuestionnaireState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [recommendations, setRecommendations] = useState<any | null>(null);

  const currentQuestion = QUESTIONS[step];
  const isFinalStep = step === QUESTIONS.length;

  const handleSelectOption = (value: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (step < QUESTIONS.length) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  };

  const submitToRunPod = async (email?: string) => {
    setIsSubmitting(true);
    const payload = {
      ...answers,
      email: email || answers.email,
    };

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error('Classification error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    step,
    currentQuestion,
    totalSteps: QUESTIONS.length,
    answers,
    isFinalStep,
    isSubmitting,
    recommendations,
    handleSelectOption,
    handleNext,
    handleBack,
    submitToRunPod,
  };
}
