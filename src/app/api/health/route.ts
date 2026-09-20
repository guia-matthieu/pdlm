/** Healthcheck interne (exception explicite du filtrage /api sur domaines communaux — I7). */
export async function GET() {
  return Response.json({ status: 'ok' })
}
