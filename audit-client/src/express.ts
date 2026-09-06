import type { Request, Response, NextFunction } from 'express';
import { AuditClient } from './client';
import { traceStorage, TraceContext } from './context';
import { generateSpanId, generateTraceId, generateRequestId } from './ids';
import { AuditEventInput } from './types';

export interface ExpressAuditOptions {
  skip?: (req: Request) => boolean;
  captureBody?: (req: Request) => boolean;
}

export function createAuditMiddleware(
  client: AuditClient,
  options: ExpressAuditOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) return next();

    const start = process.hrtime.bigint();

    const trace_id = (req.headers['x-audit-trace-id'] as string) || generateTraceId();
    const request_id =
      (req.headers['x-audit-request-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      generateRequestId();
    const correlation_id =
      (req.headers['x-audit-correlation-id'] as string) || request_id;
    const parent_span_id =
      (req.headers['x-audit-span-id'] as string) ||
      (req.headers['x-audit-parent-span-id'] as string);
    const caller_service = req.headers['x-audit-caller-service'] as string | undefined;
    const span_id = generateSpanId();

    const context: TraceContext = {
      trace_id,
      request_id,
      correlation_id,
      span_id,
      parent_span_id,
      caller_service,
    };

    res.setHeader('X-Request-Id', request_id);
    res.setHeader('X-Audit-Trace-Id', trace_id);

    let finished = false;

    const onFinish = () => {
      if (finished) return;
      finished = true;

      const durationNs = Number(process.hrtime.bigint() - start);
      const durationMs = Math.round(durationNs / 1e6);
      const route = req.baseUrl + ((req as any).route?.path ?? req.path);
      const outcome =
        res.statusCode >= 500 ? 'failure' : res.statusCode >= 400 ? 'denied' : 'success';

      const shouldCaptureBody =
        options.captureBody?.(req) ?? (req.method !== 'GET' && req.method !== 'HEAD');
      const data : AuditEventInput = {
        event_type: 'http.request',
        action: 'http.request',
        actor: (req as any).user
          ? {
              type: (req as any).user.type ?? 'user',
              id: (req as any).user.id,
              role: (req as any).user.role,
            }
          : { type: 'anonymous' },
        request: {
          trace_id,
          request_id,
          correlation_id,
          span_id,
          parent_span_id,
          caller_service,
          method: req.method,
          path: req.originalUrl.split('?')[0],
          route,
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          status_code: res.statusCode,
          duration_ms: durationMs,
        },
        payload: shouldCaptureBody ? { body: req.body } : undefined,
        outcome,
      };
      // console.log("data", data);
      client.track(data);

      client.trackSpan({
        trace_id,
        span_id,
        parent_span_id,
        name: `${req.method} ${route}`,
        kind: 'server',
        start_time: new Date(Date.now() - durationMs).toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: durationMs,
        status_code: res.statusCode,
        status: res.statusCode >= 500 ? 'error' : 'ok',
        caller_service,
        request_id,
        correlation_id,
        attributes: {
          http_method: req.method,
          http_path: req.originalUrl.split('?')[0],
          http_route: route,
          http_status_code: res.statusCode,
        },
      });
    };

    res.on('finish', onFinish);
    res.on('close', onFinish);

    traceStorage.run(context, () => next());
  };
}
