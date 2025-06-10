import { otelUtils } from "./otel.ts";
import { trace } from "@opentelemetry/api";
import denoConfig from "../deno.json" with { type: "json" };

export const tracer = trace.getTracer(denoConfig.name, denoConfig.version);

const { startActiveSpan } = otelUtils(tracer);
export { startActiveSpan };
