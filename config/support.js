function getSupportContact() {
  // Keep the API contract stable by returning a simple reference string.
  // Do NOT hardcode environment-specific values here.
  return process.env.SUPPORT_CONTACT || 'Contact Sakan Support';
}

module.exports = {
  getSupportContact,
};
