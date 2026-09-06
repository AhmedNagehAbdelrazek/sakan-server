export type AuditOutcome = 'success' | 'failure' | 'denied';
export type AuditEventType = 'http.request' | 'domain.event' | 'security.event' | 'admin.action' | 'system.event';
export type SpanKind = 'server' | 'client' | 'internal' | 'producer' | 'consumer';

export interface AuditActor {
  type?: 'user' | 'driver' | 'passenger' | 'admin' | 'system' | 'anonymous';
  id?: string;
  role?: string;
}

export interface AuditResource {
  type: string;
  id?: string;
  label?: string;
}

export interface AuditRequestContext {
  trace_id?: string;
  request_id?: string;
  correlation_id?: string;
  span_id?: string;
  parent_span_id?: string;
  caller_service?: string;
  method?: string;
  path?: string;
  route?: string;
  query?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  status_code?: number;
  duration_ms?: number;
}

export interface AuditEventInput {
  event_type?: AuditEventType;
  action: string;
  actor?: AuditActor;
  resource?: AuditResource;
  request?: AuditRequestContext;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  outcome?: AuditOutcome;
  error?: { code?: string; message?: string };
  idempotency_key?: string;
}

export interface AuditEvent {
  id: string;
  schema_version: '1.0';
  service_id: string;
  service_name: string;
  environment: string;
  instance_id?: string;
  event_type: AuditEventType;
  event_time: string;
  action: string;
  outcome: AuditOutcome;
  actor_type?: string;
  actor_id?: string;
  actor_role?: string;
  resource_type?: string;
  resource_id?: string;
  resource_label?: string;
  trace_id?: string;
  request_id?: string;
  correlation_id?: string;
  span_id?: string;
  parent_span_id?: string;
  caller_service?: string;
  method?: string;
  path?: string;
  route?: string;
  query?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  status_code?: number;
  duration_ms?: number;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: { code?: string; message?: string };
  idempotency_key?: string;
}

export interface TraceSpanInput {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  kind: SpanKind;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  status_code?: number;
  status?: 'ok' | 'error';
  caller_service?: string;
  target_service?: string;
  request_id?: string;
  correlation_id?: string;
  attributes?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

export interface TraceSpan extends TraceSpanInput {
  service_id: string;
  service_name: string;
  environment: string;
  instance_id?: string;
}
