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

async function sendEmail(to, subject, message) {
    try {
        const response = await brevo.transactionalEmails.sendTransacEmail({
            sender: { email: 'ahmednagh2005@gmail.com', name: 'Ahmed Nageh' },
            to: [{ email: to }],
            subject: subject,
            htmlContent: message,
        });
        console.log('Email sent successfully:', response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

module.exports = sendEmail;