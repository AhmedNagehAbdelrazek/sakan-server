// const { AuditClient, createAuditedFetch } = require('./audit-client');

// const audit = new AuditClient({
//   serviceId: process.env.AUDIT_SERVICE_ID,
//   serviceName: 'masar-trip-service',       // unique per service
//   environment: process.env.NODE_ENV,
//   collectorUrl: process.env.AUDIT_COLLECTOR_URL,
//   clientKey: process.env.AUDIT_CLIENT_KEY,
//   clientSecret: process.env.AUDIT_CLIENT_SECRET,
// });

// const auditedFetch = createAuditedFetch(audit);

// exports.audit = audit;
// exports.auditedFetch = auditedFetch;