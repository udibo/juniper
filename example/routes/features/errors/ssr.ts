import { HttpError } from "@udibo/juniper";

export function loader(): void {
  throw new HttpError(
    400,
    "This error was thrown during server-side rendering!",
  );
}
