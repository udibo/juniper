import { trace } from "@opentelemetry/api";

import { otelUtils } from "@udibo/juniper/utils/otel";

export const tracer = trace.getTracer(Deno.env.get("APP_NAME") ?? "unknown");

const { startActiveSpan } = otelUtils(tracer);
export { startActiveSpan };
