import { otelUtils } from "@udibo/juniper/utils/otel";
import { trace } from "@opentelemetry/api";

export const tracer = trace.getTracer("example", "0.0.1");

const { startActiveSpan } = otelUtils(tracer);
export { startActiveSpan };
