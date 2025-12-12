import type { RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";

export async function action({ request }: RouteActionArgs): Promise<void> {
  const formData = await request.formData();
  const destination = formData.get("destination") as string;

  await new Promise((resolve) => setTimeout(resolve, 300));

  if (destination === "home") {
    throw redirect("/");
  }
  if (destination === "features") {
    throw redirect("/features");
  }

  throw redirect(
    "/features/data/server-actions/redirect?success=true&dest=" +
      encodeURIComponent(destination || "default"),
  );
}
