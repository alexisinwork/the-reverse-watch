# Exclusive Watch Selection: how the paid selection will work

Owner decisions, 2026-11-27: "мы будем делать платный подбор часов" after the
launch of 2026-12-06; price approved ("2 - утверждено"): **$79 a selection, $49
for the first 25 founding orders** (`docs/business-plan.md`, "Paid watch
selection"). Today only the "Coming soon" panel is live
(`app/components/exclusive-selection.tsx`); nothing below is built yet. This
is the plan the owner asked for ("интересен весь процесс платный").

## What the customer gets

- A personal shortlist for one brief: ten options that meet every hard
  requirement, three of them recommended, each with the trade-offs explained.
- Every fact checked on the maker's or an authorised retailer's page that our
  server opened (size, water resistance, movement, reference), the way the
  catalogue repair checks them.
- Prices: the authorised retail price (two sources within ±5%) and, where it
  helps, the pre-owned range from established dealers, labelled as such.
- Where to buy (authorised dealers; what to check when buying pre-owned).
- Delivered within 48 hours as a private page and a PDF; one round of
  follow-up questions by email within 14 days.
- Full refund when ten options that meet the hard requirements cannot be
  found.

## The questionnaire: reuse the diagnostic, add a short brief

**Recommendation: no new questionnaire from scratch.** Step 1 is the existing
diagnostic (`/quiz`), which already asks the hard requirements and is tested:
budget, wrist size and case range, where the watch is worn, movement,
allergies, functions, style. A visitor who has just finished it starts the
order with those answers already filled in; one who comes from the archetype
or film search starts the diagnostic with the preferences those tools already
hand over (the existing handoff).

Step 2 is a short paid-only brief, five to seven questions the free tools do
not ask:

1. The watches you own, and the ones you love or dislike, and why.
2. The one to three watches you are considering now, if any.
3. Must-haves and deal-breakers, in your own words.
4. New, pre-owned or either; the country you buy in (prices, availability).
5. When and for what you need it (a gift, an occasion, everyday).
6. Anything in the free shortlist that felt wrong.

Why: asking the hard requirements twice wastes the customer's time and risks
two answers that disagree; the brief adds what the catalogue cannot infer,
taste and context, which is what the customer pays a person for.

## The process

1. **Entry.** The panel under every result screen becomes "Get my Exclusive
   Selection" and leads to `/exclusive`: what is included, the price, the
   delivery time, a sample report, the refund rule, questions and answers.
2. **Brief.** Diagnostic answers plus the short brief, kept on our server
   with the order.
3. **Payment.** A merchant of record (Lemon Squeezy or Paddle) runs the
   checkout, takes the payment, handles EU VAT for a seller in Poland and
   sends the receipt; the site never sees card data. The customer's email
   comes from the checkout, for delivery only; the newsletter stays a
   separate, explicit opt-in.
4. **Research, automatic (minutes).** The catalogue's hard filters in
   PostgreSQL and, above $10,000 or on a shortfall, the live search, wider
   than the free tools (about 30 candidates). Each candidate's exact
   reference is checked on the maker's or a retailer's page our server opens;
   prices get the two-source check. Only search constraints reach Muse Spark
   and Perplexity, never the email or other personal data (the site's rule).
5. **The judge.** The judge (Opus) reads the draft against the brief, flags
   any fact or fit it doubts; a flagged fact changes only from a page our
   server opened. Failures drop out before a person sees the draft.
6. **The owner's review, about 15 minutes.** A new `/admin/orders` page shows
   the draft: the owner reads the three recommendations and the notes, edits,
   approves. This step is what keeps the price at $79 workable: within 6–8
   hours a week, 15 minutes an order allows about 100 orders a month.
7. **Delivery.** A private page (unguessable address, open for 90 days) and a
   PDF, sent by email through Resend; prices are dated.
8. **Follow-up.** One round of questions by reply within 14 days; a revised
   shortlist if a hard requirement was misunderstood.
9. **Capacity.** At most ten orders a week to start; when full, the checkout
   shows a waitlist instead.

## Rules and paperwork before the first order

- Terms of sale for a digital service. EU consumers may withdraw within 14
  days unless they ask for the work to start at once and accept that the
  right ends when it is delivered; the checkout asks for that explicitly.
- The privacy policy adds what an order stores (email, brief, order and
  payment status from the provider) and for how long.
- The owner's open check of the employer's rules on paid side work
  (`docs/OWNER_QUESTIONS.md` #5).

## What is measured

Panel presses per result screen (counted since 2026-11-27 as
`exclusive_selection` on `/admin/analytics`), visits to `/exclusive`, started
and paid checkouts, delivery within 48 hours, the owner's minutes per order,
refunds, and one question after delivery ("Did the selection help you
decide?"). Working criterion from the business plan: build beyond the manual
pilot when at least 3% of result viewers press the panel and at least five
founding orders are paid in the first month.

## Build order, after the launch

1. **Manual pilot (about a week).** `/exclusive`, the brief form, the
   provider's hosted checkout link, `/admin/orders`; the research runs as a
   script on the owner's go, delivery by email with a PDF. Founding price $49.
2. **Automatic delivery.** The private result page, the PDF and the emails
   made by the site; order status for the customer.
3. **Scale.** The weekly capacity switch, reviews from founding customers,
   referrals.
