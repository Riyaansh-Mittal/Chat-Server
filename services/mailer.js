const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config({ path: "../config.env" });

async function sendMail(args) {
  try {

    const smtp = {
      service: "gmail",
      auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.PASS,
      },
    };

    const transporter = nodemailer.createTransport(smtp);

    const mailOptions = {
      from: process.env.EMAIL_ID,
      to: args.email,
      subject: args.subject,
      // text: args.text,
      html: args.html,
      attachments: args.attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Mail Success:", info.response);
    return info.response;
  } catch (error) {
    console.error("Mail error:", error);
  }
}

module.exports = {
  sendEmail: async function (args) {
    if (process.env.NODE_ENV === "development") {
      return new Promise.resolve();
    } else {
      return sendMail(args);
    }
  },
};
