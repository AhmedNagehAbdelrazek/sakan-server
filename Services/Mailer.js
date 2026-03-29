var nodemailer = require('nodemailer');
const { google } = require("googleapis");
const ApiError = require('../utils/ApiError');
// Avoid loading real `.env` during tests; Jest setup is responsible for env.
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line global-require
  require('dotenv').config();
}


const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

async function sendEmail(to,subject,message){
  //if you want to use the email for testing you can comment the return 
  // better option is to log the message in the log for ONLY TESTING!
  // return;

  const accessToken = await oAuth2Client.getAccessToken();

  var transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      type:'OAuth2',
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
  
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken: accessToken,
    },
  });
  try{
    var mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        text: message,
      };
      
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Email sent: " + info.response);
        }
        transporter.close();
    });
  }catch(e){
    throw new ApiError(e.message, 500);
  }
}



module.exports = sendEmail;