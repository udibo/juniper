import type { AnyParams, RouteProps } from "@udibo/juniper";

export interface HomeLoaderData {
  message: string;
  now: Date;
}

export default function Home(
  { loaderData }: RouteProps<AnyParams, HomeLoaderData>,
) {
  return (
    <>
      <title>Home</title>
      <meta name="description" content="Home page" />
      <h2>{loaderData.message}</h2>
      <p>Current time: {loaderData.now.toISOString()}</p>
    </>
  );
}
