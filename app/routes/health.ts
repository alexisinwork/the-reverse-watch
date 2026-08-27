export function loader() {
  return Response.json(
    {
      status: "ok",
      service: "the-reserve-web",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
