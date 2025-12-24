import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";

export function loader(_args: RouteLoaderArgs) {
  throw new HttpError(
    400,
    "This error was thrown during server-side rendering!",
  );
}
