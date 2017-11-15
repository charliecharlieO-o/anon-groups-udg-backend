const express = require('express')
const passport = require('passport')
const router = express.Router()

// DB models
const User = require('../models/users')
const Invitation = require('../models/invitation')

// Include passport module as passport strategy
require('../config/passport')(passport)

// Utility to send mails
const mailer = require('../config/nodemailer')

/* POST create and send invitation */
router.post('/invite', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Invitation.findOne({ 'to_email': req.body.email, 'issuer_id': req.user.data._id }, (err, invitation) => {
    // Create new invitationobject
    const newInvitation = new Invitation({
      issuer_id: req.body.user.data._id,
      to_email: req.body.email
    })
    // If invitation with email exists and it's older than 48 hours
    if (!err && invitation) {
      const hours = Math.abs(invitation.sent_at - new Date())/36e5
      if (hours > 48) {
        // Delete last invitation
        Invitation.findByIdAndRemove(invitation._id).exec()
      }
    }
    // Create and save invitations
    newInvitation.save((err) => {
      if (err) {
        res.status(500).send("DB error")
      } else {
        const user = req.body.user.data
        // success
        res.json({ 'success': true })
        // Send email
        mailer.sendMail({
          from: 'postmaster@mg.netslap.me', // sender address
          to: req.body.email, // list of receivers
          subject: `${user.username} te invita a NetSlap`, // Subject line
          text: `${user.username} te esta invitando a NetSlap`, // plain text body
          html: `<b>Hola!</b>, <b>${user.username}</b> te esta invitando a NetSlap, la red de foros mas exclusiva de GDL.
            <br />Ingresa el siguiente token en el area de registro para crear tu cuenta!: ${newInvitation.key_id}` // html body
        })
      }
    })
  })
})

/* POST register user with invitation */
router.post('/signup', (req, res) => {
  Invitation.findOne({ 'key_id': reqq.body.key }, (err, invitation) => {
    if (err || !invitation) {
      res.status(404).send('Token doesnt exist')
    } else {
      // If key isnt used, exists and isnt expired
      const hours = Math.abs(invitation.sent_at - new Date())/36e5
      if (hours > 48) {
        // Delete last invitation
        Invitation.findByIdAndRemove(invitation._id).exec()
        // Send error
        res.status(404).send('Key expired')
      } else {
        // Create user and return success
        // Create user object
      	let newUser = new User({
      		'username': req.body.username,
      		'password': req.body.password,
          'alias': {
            'anonId': null,
            'handle': null,
            'changed': null
          },
          'profile_pic': {
            'thumbnail': null,
            'location': null,
            'mimetype': null,
            'size': null
          },
          'bio': null,
      		'contact_info': null,
      		'info_requests': [],
      		'alerts': [],
      		'email': req.body.email,
      		'last_log': Date.now(),
          'priviledges': ['search_user','can_reply','can_post']
      	})
        User.create(newUser, (err, user) => {
      		if(err){
      			res.json({ 'success': false, 'dberr': utils.parseMongooseError(err) })
      		}
      		else{
      			user.password = null
      			res.json({ 'success': true, 'doc': user })
            // Delete invititation
            Invitation.findByIdAndRemove(invititation._id).exec()
      		}
      	})
      }
    }
  })
})

module.exports = router
