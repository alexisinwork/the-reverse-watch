/** What the visitor is searching for on /watches/find; chosen from a list. */
/** Longest film, series or person name a search accepts. */
export const FILM_QUERY_MAX = 120;

export const FILM_SUBJECT_KINDS = [
  "movie",
  "series",
  "actor",
  "character",
  "celebrity",
] as const;

export type FilmSubjectKind = (typeof FILM_SUBJECT_KINDS)[number];

export const FILM_SUBJECT_LABELS: Record<FilmSubjectKind, string> = {
  movie: "Movie",
  series: "Series",
  actor: "Actor",
  character: "Character",
  celebrity: "Celebrity",
};

export function parseFilmSubjectKind(
  value: string | null | undefined,
): FilmSubjectKind | null {
  return (FILM_SUBJECT_KINDS as readonly string[]).includes(value ?? "")
    ? (value as FilmSubjectKind)
    : null;
}
