An updated, end-to-end plan built **100% in TypeScript / JavaScript** using **Remix (React Router v7 / Remix Vite)**, **Mastra AI framework**, and **Ollama** (locally or hosted on RunPod).

No Python dependencies.

```
┌────────────────────────────────────────────────────────┐
│                   REMIX FRONTEND / SSR                 │
│  Landing + Diagnostic State Machine + Beehiiv Action  │
└───────────────────────────┬────────────────────────────┘
                            │ Form Action / Loader
                            ▼
┌────────────────────────────────────────────────────────┐
│             MASTRA AI TS AGENT (Server-Side)           │
│  Mastra Workflow ──> Vector Store RAG ──> Zod Schema   │
└───────────────────────────┬────────────────────────────┘
                            │ OpenAI-compatible Provider API
                            ▼
┌────────────────────────────────────────────────────────┐
│               LOCAL OLLAMA INFERENCE                   │
│   Llama 3 / Mistral via RunPod or Local Ollama instance │
└────────────────────────────────────────────────────────┘

```

---

### Step 1: Scaffold the Pure TypeScript Stack

Initialize a Remix project and install Mastra, Ollama client providers, and UI primitives:

```bash
# Initialize Remix with Vite
npx create-remix@latest thereserve-watch --template remix-run/remix/templates/vite
cd thereserve-watch

# Install Mastra and AI tools
npm install @mastra/core @mastra/rag zod tailwindcss postcss autoprefixer lucide-react

```

Update `app/tailwind.css` and configure the branding tokens (`#08090B`, `#EDEDE8`, `#C8892F`, `#5B6B78`, `#1A1E24`).

---

### Step 2: Configure Mastra with Ollama & Model Provider

Create `app/mastra/index.ts` to configure your Mastra agent, point it to Ollama running locally or on RunPod (`http://localhost:11434` or your RunPod proxy), and define the structured output schema.

```typescript
// app/mastra/index.ts
import { Mastra, Agent } from '@mastra/core';
import { z } from 'zod';

// Output schema for the classification dossier
export const WatchDossierSchema = z.object({
  reference_title: z.string().describe('Brand name and exact reference model'),
  corporate_status: z.string().describe('Corporate ownership, foundation status, or conglomerate reality'),
  mechanical_verdict: z.string().describe('Calibre specs, servicing intervals, and true dimensional fit'),
  psychological_alignment: z.string().describe('Why this specific piece resolves the user emotional and social intent'),
  historical_context: z.string().describe('Primary-source verified heritage vs marketing claims')
});

export type WatchDossier = z.infer<typeof WatchDossierSchema>;

// Initialize Mastra Agent pointing to Ollama via OpenAI-compatible endpoint
export const classificationAgent = new Agent({
  name: 'the-reserve-archivist',
  instructions: `
    You are the lead archivist at The Reserve (thereserve.watch).
    Tone: Precise, dry, skeptical of marketing mythology, respectful of true engineering.
    Do not use marketing buzzwords like "timeless", "iconic", "grail", or "legendary".
    Synthesize user diagnostic parameters against corporate filings and mechanical realities.
  `,
  model: {
    provider: 'OLLAMA',
    name: 'llama3:8b', // or mistral / qwen2.5
    // Connects to local daemon or RunPod Ollama HTTP port
    url: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/api',
  },
});

export const mastra = new Mastra({
  agents: { classificationAgent },
});

```

---

### Step 3: TypeScript Vector DB & Knowledge Ingestion

Create a native TypeScript vector index for your brand dossiers using Mastra's built-in RAG / Vector store tooling (`app/mastra/knowledge.ts`):

```typescript
// app/mastra/knowledge.ts
import { MDocument } from '@mastra/rag';
import fs from 'node:fs';
import path from 'node:path';

export interface WatchKnowledgeItem {
  brand: string;
  reference: string;
  price_bracket: string;
  wrist_min_in: number;
  wrist_max_in: number;
  social_signal: string;
  aesthetic_dna: string;
  content: string;
}

// Ingest markdown files into Mastra Documents
export async function loadWatchDossiers(): Promise<MDocument[]> {
  const dataDir = path.join(process.cwd(), 'data', 'brands');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.md'));

  const docs = files.map(file => {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    return MDocument.fromText(raw, { source: file });
  });

  return docs;
}

```

---

### Step 4: Remix Server Route & Action (`app/routes/diagnostic.tsx`)

Remix combines UI and backend execution in a single file. The user answers the 8 questions, submits the form, and Remix executes the Mastra classification server-side without an external Python microservice.

```tsx
// app/routes/diagnostic.tsx
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useNavigation, Form } from '@remix-run/react';
import { useState } from 'react';
import { mastra, WatchDossierSchema } from '~/mastra';
import { QUESTIONS, INITIAL_STATE, type QuestionnaireState } from '~/lib/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rawPayload = Object.fromEntries(formData);
  
  const userProfile = {
    priceBracket: rawPayload.priceBracket,
    wristCircumference: rawPayload.wristCircumference,
    maintenanceTolerance: rawPayload.maintenanceTolerance,
    deploymentEnvironment: rawPayload.deploymentEnvironment,
    socialSignal: rawPayload.socialSignal,
    aestheticDna: rawPayload.aestheticDna,
    provenancePreference: rawPayload.provenancePreference,
    emotionalObjective: rawPayload.emotionalObjective,
  };

  const agent = mastra.getAgent('classificationAgent');
  
  // Structured synthesis through Mastra and Ollama
  const response = await agent.generate(
    `Evaluate this collector profile and classify their reference:
     ${JSON.stringify(userProfile, null, 2)}`,
    {
      output: WatchDossierSchema,
    }
  );

  // Opt-in Beehiiv subscription if email provided
  const email = formData.get('email')?.toString();
  if (email && process.env.BEEHIIV_API_KEY) {
    try {
      await fetch(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          send_welcome_email: true,
          utm_source: 'remix_diagnostic_app',
        }),
      });
    } catch (e) {
      console.error('Beehiiv subscription failed:', e);
    }
  }

  return json({ dossier: response.object });
}

export default function DiagnosticRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireState>(INITIAL_STATE);

  const currentQ = QUESTIONS[step];

  if (actionData?.dossier) {
    const d = actionData.dossier;
    return (
      <main className="min-h-screen bg-[#08090B] text-[#EDEDE8] p-6 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full border border-[#1A1E24] bg-[#0D0F13] p-8">
          <span className="text-xs uppercase tracking-widest text-[#C8892F]">Classification Dossier</span>
          <h1 className="text-2xl font-bold uppercase mt-2 mb-6">{d.reference_title}</h1>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-xs uppercase text-[#5B6B78]">Corporate Status</h3>
              <p className="mt-1 leading-relaxed">{d.corporate_status}</p>
            </div>
            <div>
              <h3 className="text-xs uppercase text-[#5B6B78]">Mechanical Specs</h3>
              <p className="mt-1 leading-relaxed">{d.mechanical_verdict}</p>
            </div>
            <div>
              <h3 className="text-xs uppercase text-[#5B6B78]">Psychological Alignment</h3>
              <p className="mt-1 leading-relaxed">{d.psychological_alignment}</p>
            </div>
          </div>
          <a href="/diagnostic" className="mt-8 inline-block text-xs uppercase tracking-widest text-[#5B6B78] hover:text-[#EDEDE8]">
            Run Another Diagnosis
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090B] text-[#EDEDE8] p-6 flex flex-col justify-between max-w-xl mx-auto">
      <div className="w-full bg-[#1A1E24] h-1 mb-8">
        <div 
          className="bg-[#C8892F] h-1 transition-all"
          style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1">
        <span className="text-xs uppercase tracking-widest text-[#5B6B78]">Parameter 0{step + 1} / 0{QUESTIONS.length}</span>
        <h2 className="text-xl font-bold mt-2 mb-4">{currentQ.title}</h2>
        {currentQ.tip && <p className="text-xs text-[#5B6B78] mb-4 bg-[#0D0F13] p-3 border border-[#1A1E24]">{currentQ.tip}</p>}

        <div className="space-y-2">
          {currentQ.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnswers({ ...answers, [currentQ.id]: opt.value })}
              className={`w-full text-left p-4 border transition-colors ${
                answers[currentQ.id] === opt.value
                  ? 'border-[#C8892F] bg-[#0D0F13]'
                  : 'border-[#1A1E24] hover:border-[#3A424B]'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-[#5B6B78] mt-1">{opt.sublabel}</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-[#1A1E24] flex justify-between items-center mt-6">
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="text-xs uppercase tracking-wider text-[#5B6B78] disabled:opacity-30"
        >
          Back
        </button>

        {step < QUESTIONS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!answers[currentQ.id]}
            className="px-6 py-3 bg-[#C8892F] text-[#08090B] text-xs font-bold uppercase tracking-widest disabled:opacity-30"
          >
            Next
          </button>
        ) : (
          <Form method="post" className="flex gap-2">
            {Object.entries(answers).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v || ''} />
            ))}
            <input 
              type="email" 
              name="email" 
              placeholder="Optional email for dossier" 
              className="bg-[#0D0F13] border border-[#1A1E24] px-3 py-2 text-xs text-[#EDEDE8] outline-none"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-[#C8892F] text-[#08090B] text-xs font-bold uppercase tracking-widest disabled:opacity-30"
            >
              {isSubmitting ? 'Evaluating...' : 'Synthesize'}
            </button>
          </Form>
        )}
      </div>
    </main>
  );
}

```

---

### Step 5: Environment & RunPod Ollama Setup

1. **Start Ollama with Llama 3:**
* Run locally: `ollama run llama3:8b`
* Or on RunPod: Start an Ollama GPU Pod and map port `11434`.


2. **Set Environment Variables (`.env`):**
```env
OLLAMA_BASE_URL="http://localhost:11434/api"
BEEHIIV_PUBLICATION_ID="pub_xxxx"
BEEHIIV_API_KEY="your_api_key"

```


3. **Run Dev Server:**
```bash
npm run dev

```
