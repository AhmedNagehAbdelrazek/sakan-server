import { randomUUID, randomBytes } from 'node:crypto';

export function generateEventId(): string {
  return randomUUID();
}

export function generateTraceId(): string {
  return `trace-${randomBytes(16).toString('hex')}`;
}

export function generateSpanId(): string {
  return `span-${randomBytes(8).toString('hex')}`;
}

export function generateRequestId(): string {
  return `req-${randomBytes(8).toString('hex')}`;
}
