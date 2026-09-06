import crypto from 'node:crypto';

export interface SignedHeaders {
  'X-Audit-Service-Id': string;
  'X-Audit-Client-Key': string;
  'X-Audit-Timestamp': string;
  'X-Audit-Signature': string;
}

export function signAuditRequest(params: {
  serviceId: string;
  clientKey: string;
  clientSecret: string;
  body: string;
}): SignedHeaders {
  const timestamp = Date.now().toString();

  const bodyHash = crypto
    .createHash('sha256')
    .update(params.body)
    .digest('hex');

  const signature = crypto
    .createHmac('sha256', params.clientSecret)
    .update(`${timestamp}.${bodyHash}`)
    .digest('hex');

  return {
    'X-Audit-Service-Id': params.serviceId,
    'X-Audit-Client-Key': params.clientKey,
    'X-Audit-Timestamp': timestamp,
    'X-Audit-Signature': signature,
  };
}
