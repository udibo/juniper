import type { RouteLoaderArgs } from "@udibo/juniper";
import { redirect } from "react-router";

export function loader({ request }: RouteLoaderArgs): void {
  const url = new URL(request.url);
  const shouldRedirect = url.searchParams.get("trigger") === "true";

  if (shouldRedirect) {
    throw redirect("/features/data/server-loaders/redirect?redirected=true");
  }
}
