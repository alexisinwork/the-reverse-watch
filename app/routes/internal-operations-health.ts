import type { Route } from "./+types/internal-operations-health";
import { operationsHealth } from "../domain/operations-health.server";
export async function loader({ request }: Route.LoaderArgs) {
  return operationsHealth(request);
}
