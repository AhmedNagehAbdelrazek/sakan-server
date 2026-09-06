const { Resend } = require('resend');
// Avoid loading real `.env` during tests; Jest setup is responsible for env.
if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: '.env' });
}

let resend = null;

function getResend() {
    if (!resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('Missing API key. Set RESEND_API_KEY to send email.');
        }
        resend = new Resend(apiKey);
    }
    return resend;
}

async function sendEmail(to, subject, message) {
    const client = getResend();
    const { data, error } = await client.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Sakan <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: message,
    });

    if (error) {
        console.error('Error sending email:', error);
        throw error;
    }

    console.log('Email sent successfully:', data);
}

module.exports = sendEmail;
