import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  trace_id: string;
  request_id: string;
  correlation_id: string;
  span_id: string;
  parent_span_id?: string;
  caller_service?: string;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}
