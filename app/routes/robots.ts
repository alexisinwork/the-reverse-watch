import { robotsTxt, SEO_FILE_CACHE_CONTROL } from "../domain/seo";

export function loader() {
  return new Response(robotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": SEO_FILE_CACHE_CONTROL,
    },
  });
}
