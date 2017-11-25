const express = require('express')
const router = express.Router()
const RecoveryKey = require('../models/recoverykey')
const User = require('../models/user')
const asyncMid = require('./asyncmid') // Async

// Utility to send mails
const mailer = require('../config/nodemailer')

/* POST reset password (send token) PENDING */
router.post('/forgot-pwd', asyncMid(async (req, res, next) => {
  // Find user with email
  const user = await User.findOne({ 'email': req.body.email })
  if (!user) {
    res.status(404).send('User doesnt exist')
  } else {
    // Create token for recovery and save it to user model
    const key = new RecoveryKey({ 'user_id': user._id })
    key.save()
    // Respond with success
    res.json({ 'success': true })
    // Send email with token
    mailer.sendMail({
      from: 'postmaster@mg.netslap.me', // sender address
      to: user.email, // list of receivers
      subject: 'NetSlap Password Reset', // Subject line
      text: `Hola ${user.username}, tu token de recuperacion es: ${key.key_id}`, // plain text body
      html: `<b>Hola ${user.username}</b>, tu token de recuperacion es: <b>${key.key_id}</b>` // html body
    })
  }
}))


/* POST change pwd */
router.post('/reset-pwd', asyncMid(async (req, res, next) => {
  const key = await RecoveryKey.findOne({ 'key_id': req.body.token })
  if (!key) {
    res.status(404).send('Key doesnt exist')
  } else {
    // Check if key isn't older than 24 hours
    const hours = Math.abs(key.requested_at - new Date())/36e5
    if (hours > 24) {
      const todo = await RecoveryKey.findByIdAndRemove(key._id)
      res.status(404).send('Key doesnt exist')
    } else {
      // Delete tokens requested by user
      RecoveryKey.remove({ 'user_id': key.user_id })
      const user = await User.findById(key.user_id)
      if (!user) {
        res.status(404).send('User doesnt exist')
      } else {
        user.password = req.body.password
        user.save()
        res.json({ 'success': true })
      }
    }
  }
}))

module.exports = router
