const { Resend } = require('resend');
// Avoid loading real `.env` during tests; Jest setup is responsible for env.
if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: '.env' });
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, subject, message) {
    const { data, error } = await resend.emails.send({
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
