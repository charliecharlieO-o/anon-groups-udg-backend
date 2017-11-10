const nodemailer = require('nodemailer')

module.exports = {
  async sendMail (mail) {
    try {
      const account = await nodemailer.createTestAccount()
      const transport = await nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
              user: account.user, // generated ethereal user
              pass: account.pass  // generated ethereal password
          }
      })
      const info = await transporter.sendMail(mail)
      return info
    }  catch(err) {
      Promise.reject(err)
    }
  }
}
