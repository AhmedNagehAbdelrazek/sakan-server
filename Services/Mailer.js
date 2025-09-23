var nodemailer = require('nodemailer');
const ApiError = require('../utils/ApiError');
require("dotenv").config();


var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
function sendEmail(to,subject,message){
  //if you want to use the email for testing you can comment the return 
  // better option is to log the message in the log for ONLY TESTING!
  // return;
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
    });
  }catch(e){
    throw new ApiError(e.message, 500);
  }
}



module.exports = sendEmail;