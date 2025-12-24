import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";

export function loader(_args: RouteLoaderArgs) {
  throw new HttpError(
    500,
    "Database connection failed - this error was thrown by a server loader",
  );
}
