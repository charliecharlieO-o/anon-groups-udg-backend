const express = require('express')
const router = express.Router()
const RecoveryKey = require('../models/recoverykey')
const User = require('../models/user')
// Utility to send mails
const mailer = require('../config/nodemailer')

/* POST reset password (send token) PENDING */
router.post('/forgot-pwd', (req, res) => {
  // Find user with email
  User.findOne({ 'email': req.body.email }, (err, user) => {
    if (err || !user) {
      res.status(404).send('user not found')
    } else {
      // Create token for recovery and save it to user model
      const key = new RecoveryKey({ 'user_id': user._id })
      key.save((err) => {
        if (err) {
          res.status(500).send('failed key')
        } else {
          // Respond with success
          res.json({ 'success': true })
          // Send email with token
          mailer.sendMail({
            from: '"Fred Foo 👻" <kyzpujmyyy36js4c@ethereal.email>', // sender address
            to: user.email, // list of receivers
            subject: 'NetSlap Password Reset', // Subject line
            text: `Hi ${user.username}, your password recovery token: ${key.key_id}`, // plain text body
            html: `<b>Hi ${user.username}</b>, your password recovery token: <b>${key.key_id}</b>` // html body
          })
        }
      })
    }
  })
})


/* POST change pwd */
router.post('/reset-pwd', (req, res) => {
  RecoveryKey.findOne({ 'key_id': req.body.token }, (err, key) => {
    if (err || !key) {
      res.status(404).send('key not found')
    } else {
      // Check if key isn't older than 24 hours
      const hours = Math.abs(key.requested_at - new Date())/36e5
      if (hours > 24) {
        RecoveryKey.findByIdAndRemove(key._id, (err, todo) => {
          res.status(404).send('expired')
        })
  		} else {
        // Delete tokens requested by user
        RecoveryKey.remove({ 'user_id': key.user_id }).exec()
        User.findById(key.user_id, (err, user) => {
          if (err || !user) {
            res.status(404).send('no such user')
          } else {
            user.password = req.body.password
            user.save((err) => {
              if (err) {
                res.status(500).send('server error')
              } else {
                res.json({ 'success': true })
              }
            })
          }
        })
      }
    }
  })
})

module.exports = router
