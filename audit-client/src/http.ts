import { getTraceContext } from './context';
import { generateSpanId, generateRequestId } from './ids';
import { AuditClient } from './client';

export function createAuditedFetch(client: AuditClient) {
  return async function auditedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const ctx = getTraceContext();

    const trace_id = ctx?.trace_id ?? generateSpanId();
    const request_id = ctx?.request_id ?? generateRequestId();
    const correlation_id = ctx?.correlation_id ?? request_id;
    const parent_span_id = ctx?.span_id;
    const span_id = generateSpanId();

    const method = options.method ?? 'GET';
    const start = Date.now();

    const headers = new Headers(options.headers);
    headers.set('X-Audit-Trace-Id', trace_id);
    headers.set('X-Audit-Request-Id', request_id);
    headers.set('X-Audit-Correlation-Id', correlation_id);
    headers.set('X-Audit-Span-Id', span_id);
    if (parent_span_id) {
      headers.set('X-Audit-Parent-Span-Id', parent_span_id);
    }
    headers.set('X-Audit-Caller-Service', client.config.serviceName);

    try {
      const response = await fetch(url, { ...options, method, headers });

      client.trackSpan({
        trace_id,
        span_id,
        parent_span_id,
        name: `${method} ${url}`,
        kind: 'client',
        start_time: new Date(start).toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: Date.now() - start,
        status_code: response.status,
        status: response.status >= 500 ? 'error' : 'ok',
        target_service: new URL(url).hostname,
        request_id,
        correlation_id,
        attributes: { http_method: method, http_url: url, http_status_code: response.status },
      });

      return response;
    } catch (err) {
      client.trackSpan({
        trace_id,
        span_id,
        parent_span_id,
        name: `${method} ${url}`,
        kind: 'client',
        start_time: new Date(start).toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: Date.now() - start,
        status: 'error',
        target_service: new URL(url).hostname,
        request_id,
        correlation_id,
        error: { message: err instanceof Error ? err.message : 'Unknown error' },
      });
      throw err;
    }
  };
}
