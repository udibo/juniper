import { createContext } from "react-router";

/** Server session data set by the server and serialized to the client. */
export interface ServerSession {
  sessionId: string;
  serverTimestamp: string;
  serverPid: number;
}

/** Context for accessing server session data on the client. */
export const serverSessionContext = createContext<ServerSession>();

/** Creates a new server session with the current server state. */
export function createServerSession(): ServerSession {
  return {
    sessionId: crypto.randomUUID().slice(0, 8),
    serverTimestamp: new Date().toISOString(),
    serverPid: Deno.pid,
  };
}
