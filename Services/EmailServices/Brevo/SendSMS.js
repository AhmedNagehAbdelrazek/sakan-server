const { BrevoClient } = require('@getbrevo/brevo');
// Avoid loading real `.env` during tests; Jest setup is responsible for env.
if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: '.env' });
}
// Initialize Brevo client
const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY, // Replace with your actual API key
});

async function sendSMS( countryCode,phoneNumber, message) {
    try {
        const response = await brevo.transactionalSms.sendAsyncTransactionalSms({
            sender: "Sakan",
            recipient: countryCode + phoneNumber,
            content: message,
            type: "transactional",
            tag: "otp-verification"
        });
        console.log('SMS sent successfully:', response);
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
}

module.exports = sendSMS;