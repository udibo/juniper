import { HttpError } from "@udibo/juniper";

export function loader(): void {
  throw new HttpError(
    500,
    "Database connection failed - this error was thrown by a server loader",
  );
}
