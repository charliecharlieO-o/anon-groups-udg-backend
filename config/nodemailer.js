const nodemailer = require('nodemailer')
const mg = require('nodemailer-mailgun-transport')

module.exports = {
  async sendMail (mail) {
    try {
      const transport = await nodemailer.createTransport(mg(
        {
          auth: {
            api_key: '',
            domain: ''
          }
        }))
      const info = await transport.sendMail(mail)
      Promise.resolve(info)
    }  catch(err) {
      Promise.reject(err)
    }
  }
}
