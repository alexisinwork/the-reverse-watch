# Phase 8 editorial research and corrections protocol

Last verified: 2026-08-31

This protocol controls packet 8.2 public-figure and screen-watch research. It
works with the publication rules in
[`phase-8-discovery-source-contract.md`](phase-8-discovery-source-contract.md)
and does not research, accept, or modify recommendation-catalogue facts.

## Atomic story rule

One pilot card makes one bounded assertion about one entity:

- a fictional character wore a watch in one named work;
- a public figure wore a watch at a named event or across a documented period;
  or
- a public figure owned a watch supported by provenance.

Actor ownership and character wear are separate records even when the physical
watch is the same. A model-family identification is not silently promoted to a
retail reference. A commercial watch inspired by a custom prop is not the prop.
Every card must be understandable without an image.

## Source hierarchy

Sources are ranked by what they can establish, not by audience size or search
position.

1. **Production and provenance records.** Production-company or prop-department
   records, authenticated prop-auction catalogues, manufacturer production
   records that name the work and wearer, and auction records carrying owner,
   family, or property-master provenance can support publication directly.
2. **Direct testimony.** On-record interviews with the wearer, actor, costume
   designer, property master, watchmaker, or production representative can
   support only what that person is positioned to know.
3. **Contemporaneous reporting and primary visuals.** Dated event reporting or
   reviewable original imagery may support public wear. A visual identification
   must expose enough distinguishing evidence for the published precision; a
   logo-shaped blur is not an exact reference.
4. **Specialist corroboration.** Reputable watch publications and identified
   specialists may corroborate a claim or supply a research lead. A specialist
   article that merely repeats an unnamed source does not become independent
   evidence.
5. **Lead-only material.** Search snippets, fan databases, forums, reposted
   social images, marketplace listings, and generative summaries may locate a
   better source but cannot support an accepted pilot card by themselves.

Manufacturer sources are not treated as neutral. Partnership, ambassador,
product-placement, and inspired-by relationships are recorded in the editorial
note wherever material. A brand page can establish its own production work or
reference code; its promotional adjectives are not imported as facts.

## Research and review workflow

1. Write the smallest claim worth testing before searching.
2. Search for the highest available source tier and open the underlying page;
   snippets are not reviewed evidence.
3. Record the canonical URL, page title, publisher, source role, publication
   time when known, retrieval time, locator, and a concise note explaining
   exactly what the source supports.
4. Search specifically for a conflicting identification. Add credible conflict
   evidence with `stance: contradicts`; absence of a conflict is not evidence.
5. Set identification precision from the weakest unresolved part of the claim.
   If the source names a family but no reference, publish `family_only`.
6. Keep unsupported dates, scenes, ownership, and reference codes `null`.
7. Record an image-rights decision. Packet 8.2 is text-only and uses
   `no_image_stored` for every card.
8. A second editorial pass checks entity/work separation, source independence,
   commercial context, wording, precision, and the publication schema.
9. Only accepted supporting evidence plus the image decision can move the card
   from `in_review` to `accepted` and set `publishedAt`.

The reviewer must be able to answer: “Which exact words or authenticated
object in this source support this exact precision?” If that answer is not
specific, the card is downgraded or remains unpublished.

## Contradictory sources

Credible sources are not resolved by vote-counting. Apply these rules in order:

1. Prefer an authenticated record for the physical object over visual
   resemblance.
2. Prefer a production or property-master record for screen use, and direct
   owner/family provenance for private ownership.
3. Prefer a source with an exact inventory, case, or reference identifier over
   an unlocated narrative claim, provided the identifier belongs to the same
   object and context.
4. Treat later manufacturer marketing as context when it conflates an
   inspired-by retail watch with a custom prop.
5. If two credible, context-matched sources remain incompatible, set
   `confidenceCode: disputed`, open a correction record, and show the public
   dispute note. Never choose the more commercially attractive answer.

If exact-reference support fails but the family remains supported, downgrade to
`model_family` and `family_only`. If identity support fails entirely, clear all
brand/model/reference fields and use `unidentified` plus `unconfirmed`.

## Corrections and withdrawal

Correction requests may arrive through the site's published support channel.
Do not request private identity documents unless a legal review specifically
requires them.

1. Log the request with the affected attribution, source URL when supplied,
   opening time, neutral summary, and public note when the issue is visible.
2. Acknowledge a complete request within two business days and triage evidence,
   precision, image rights, privacy, and legal urgency.
3. For a credible identification conflict, add the contradicting evidence and
   mark the card disputed while review is open. For an image-rights or serious
   safety issue, remove the asset or withdraw publication immediately while
   retaining the audit record.
4. Re-run the full publication gate. Resolution may confirm, narrow, correct,
   or withdraw the claim; it may never erase the prior evidence trail.
5. Record the resolution time and note. Material public changes receive a plain
   correction note; spelling-only changes do not imply a factual dispute.
6. Review open corrections at least weekly until resolved. Recheck accepted
   mutable claims on the Phase 8 refresh schedule established in packet 8.5.

Dismissal means the submitted evidence did not alter the supported claim. It
does not mean the requester or source is unreliable beyond that issue.

## Pilot corpus

The executable corpus is in
[`discovery-pilot.ts`](../app/domain/discovery-pilot.ts). It contains 21
text-only cards: 10 cinema, 3 television, and 8 public-figure stories. Twelve
claims have exact-reference support, eight remain model-family-only, and one
screen-worn object remains explicitly unidentified. Every source was retrieved
and reviewed on 2026-08-31. No card has a `referenceVariantId` or stored image.

| Story | Public label | Primary reviewed source |
| --- | --- | --- |
| Murph Cooper — *Interstellar* | Model family only | [Hamilton production history](https://www.hamiltonwatch.com/en-int/making-the-khaki-field-murph) |
| The Protagonist — *TENET* | Model family only | [Hamilton production record](https://www.hamiltonwatch.com/no-no/tenet) |
| Paul Atreides — *Dune: Part Two* | Model family only | [Hamilton and the Desert Watch](https://www.hamiltonwatch.com/en-ca/dunemovie-watches) |
| J. Robert Oppenheimer — Cushion B | Model family only | [Hamilton Oppenheimer record](https://www.hamiltonwatch.com/en-us/watches-oppenheimer) |
| Kitty Oppenheimer — Lady Hamilton A-2 | Model family only | [Hamilton Oppenheimer record](https://www.hamiltonwatch.com/en-us/watches-oppenheimer) |
| Leslie Groves — Piping Rock | Model family only | [Hamilton Oppenheimer record](https://www.hamiltonwatch.com/en-us/watches-oppenheimer) |
| James Bond — *No Time to Die* | Model family only | [Planet OMEGA exhibition record](https://press.omegawatches.com/the-planet-omega-exhibition-opens-in-new-york-city/) |
| Colonel Kurtz — *Apocalypse Now* | Confirmed identification | [Phillips ref. 1675 provenance](https://www.phillips.com/detail/rolex/130499) |
| Agent J — *Men in Black* | Model family only | [Hamilton cinema history](https://www.hamiltonwatch.com/en-my/company/hamilton-cinema) |
| Indiana Jones — *Dial of Destiny* | Confirmed identification | [Hamilton H13431553 product record](https://www.hamiltonwatch.com/en-sa/h13431553-boulton-quartz.html) |
| Don Draper — *Mad Men* | Confirmed identification | [Christie's Omega ref. 166.020 lot](https://www.christies.com/lot/lot-5967746) |
| Roger Sterling — *Mad Men* | Confirmed identification | [Christie's Tudor ref. 7967 lot](https://www.christies.com/en/lot/lot-5967745) |
| Annie Edison — *Community* | Unconfirmed identification | [Propstore production-prop lot](https://us.propstoreauction.com/view-auctions/catalog/id/89/lot/17735/index.html) |
| Paul Newman — Rolex Daytona | Confirmed identification | [Phillips ref. 6239 provenance](https://www.phillips.com/detail/rolex/100049) |
| Jack Nicklaus — Rolex Day-Date | Confirmed identification | [Phillips ref. 1803 provenance](https://www.phillips.com/detail/NY080119/18) |
| Eric Clapton — Patek Philippe | Confirmed identification | [Christie's ref. 2499/100 sale record](https://www.christies.com/auction/auction-1391-gnv) |
| Wally Schirra — Sigma 7 | Confirmed identification | [OMEGA CK 2998 history](https://press.omegawatches.com/the-first-omega-in-space-makes-a-vintage-return/) |
| Aaron Taylor-Johnson — OMEGA HQ | Confirmed identification | [OMEGA ambassador event record](https://press.omegawatches.com/aaron-taylor-johnson-joins-omega-as-a-brand-ambassador/) |
| Marlon Brando — Rolex GMT-Master | Confirmed identification | [Phillips ref. 1675 provenance](https://www.phillips.com/detail/rolex/130499) |
| Rafael Nadal — RM 27-04 | Confirmed identification | [Richard Mille RM 27-04 record](https://www.richardmille.com/historical-models/rm-27-04-tourbillon) |
| Lewis Hamilton — Silverstone podium | Confirmed identification | [IWC ref. IW388306 event record](https://press.iwc.com/iwc-chronograph-worn-by-lewis-hamilton-on-podium-auction-laureus-en/) |

This pilot is editorial input for packet 8.3. It is not a database seed or a
public explorer route yet; those require the narrow published-read contract
and UI work sequenced in the next packet.
