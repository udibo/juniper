import { HomeLoaderData } from "./index.tsx";

export function loader(): HomeLoaderData {
  return { message: "Hello, World!", now: new Date() };
}
