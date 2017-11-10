const nodemailer = require('nodemailer')

module.exports = {
  async sendMail (mail) {
    try {
      const transport = await nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
              user: 'kyzpujmyyy36js4c@ethereal.email', // generated ethereal user
              pass: 'yqasrcfMQ7aX5X4ujM'  // generated ethereal password
          }
      })
      const info = await transport.sendMail(mail)
      return info
    }  catch(err) {
      Promise.reject(err)
    }
  }
}
