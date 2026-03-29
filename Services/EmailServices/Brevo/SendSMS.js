const { BrevoClient } = require('@getbrevo/brevo');
const dotenv = require('dotenv');
dotenv.config({ path: ".env" });
// Initialize Brevo client
const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY, // Replace with your actual API key
});

async function sendSMS(phoneNumber, message) {
    try {
        const response = await brevo.transactionalSms.sendAsyncTransactionalSms({
            sender: "Sakan",
            recipient: "+2"+phoneNumber,
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