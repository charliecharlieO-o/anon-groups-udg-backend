const express = require('express')
const jwt = require('jwt-simple')
const passport = require('passport')
const crypto = require('crypto')
const uuid = require('uuid')
const passport_utils = require('../config/passport-utils')
const router = express.Router()

//mongoose
const mongoose = require('mongoose')
// Utilities
const config = require('../config/database')
const utils = require('../config/utils')
const settings = require('../config/settings')
// Siiau authentication
const siiauAuth = require('../config/siiau-auth.js')

const default_user_list = '_id username banned profile_pic last_log'

// Include passport module as passport strategy
require('../config/passport')(passport)

// Models
const User = require('../models/user')
const Request = require('../models/request')
const Notification = require('../models/notification')

//=================================================================================
//									--	USERS --
//=================================================================================

const user_list_default = '_id username last_log banned'

/* GET users that registered between X and Y dates */
router.get('/list/by-date', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['admin_admins'])){
    User.find({}, default_user_list, { 'sort': { 'signedup_at': -1 }}, (err, users) => {
      if(err || !users){
        res.json({ 'success': false })
      }
      else{
        res.json({ 'success': true, 'doc': users })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

/* POST search users with specific priviledge in priviledges array*/
router.post('/search/by-priviledge', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['admin_admins'])){
    utils.parseJSON(req.body.divisions, (e, divisions) => {
      if(divisions && Array.isArray(divisions)){
        User.find({'priviledges': {'$in': divisions}}, default_user_list, { 'sort': { 'signedup_at': -1 }}, (err, users) => {
          if(err || !users){
            res.json({ 'success': false })
          }
          else{
            res.json({ 'success': true, 'doc': users })
          }
        })
      }
      else{
        res.json({ 'success': false })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

/* GET user */
router.get('/:user_id/profile', passport.authenticate('jwt', {'session': false}), (req, res) => {
  // If an admin is requestinig the profile
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['admin_admins'])){
    User.findById(req.params.user_id, { 'password': 0, 'nipCode': 0 }, (err, user) => {
      if(err || !user){
        res.json({ 'success': false })
      }
      else {
        res.json({ 'success': true, 'doc': user })
      }
    })
  }
  else{
    if(req.user.data._id == req.params.user_id){
      // If the requested user equals the requesting user give profile
      User.findById(req.params.user_id, { 'password': 0 }, (err, user) => {
        if(err || !user){
          res.json({ 'success': false })
        }
        else {
          res.json({ 'success': true, 'doc': user })
        }
      })
    }
    else{
      Request.findOne({ 'actors': req.user.data._id }, 'has_access', (err, request) => {
        if(err){
          res.json({ 'success': false })
        }
        else{
          if(request && request.has_access){
            // if the requested user allowed requesting user, give info
            User.findById(req.params.user_id, 'username profile_pic bio contact_info last_log signedup_at', (err, user) => {
              if(err || !user){
                res.json({ 'success': false })
              }
              else{
                res.json({ 'success': true, 'doc': user })
              }
            })
          }
          else{
            // give limited access
            User.findById(req.params.user_id, 'username bio profile_pic contact_info', (err, user) => {
              if(err || !user){
                res.json({ 'success': false })
              }
              else{
                const contactsCount = (user.contact_info != null)? user.contact_info.length : 0
                user.contact_info = null
                res.json({ 'success': true, 'doc': user, 'networks': contactsCount, 'limited': true })
              }
            })
          }
        }
      })
    }
  }
})

/* POST register new user by invitation */
/*router.post('/invite', passport.authenticate('jwt', {'session': false}), (req, res) => {
  // Create invitation token and save it in invitation's collection
  // Send token to phone Number
})*/

/* POST register new user */
router.post('/register', (req, res) => {
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
  // Check user existence in SIIAU first
  siiauAuth.getUserInfo(req.body.nip, req.body.udgpwd)
    .then((response) => {
      // Reject teachers and invalid people
      if(response != null && response.type !== 'P' && settings.college_centers.includes(response.campus)){
        // Set NIP code to user object
        newUser.setNIP(response.code)
        // If there are any validation errorrs return in convenient JSON
        let validationErrors = newUser.validateSync()
        if(validationErrors) {
          res.json({ 'success': false, 'valerr': utils.parseValidationErrors(validationErrors) })
          return
        }
        // Check user credentials and info
        User.create(newUser, (err, user) => {
      		if(err){
      			res.json({ 'success': false, 'dberr': utils.parseMongooseError(err) })
      		}
      		else{
      			user.password = null
      			res.json({ 'success': true, 'doc': user })
      		}
      	})
      } else {
        res.json({ 'success': false, 'err': 101 })
      }
    })
    .catch((err) => {
      res.json({ 'success': false, 'err': 100 })
    })
})

/* POST login user */
router.post('/login/email', (req, res) => {
	User.findOne({
		'email': req.body.email
	}, (err, user) => {
		if(err)
			throw err
		if(!user){
			res.send({ 'success': false })
		}
		else{
			// Check if password matches
			user.comparePassword(req.body.password, (err, isMatch) => {
				if(isMatch && !err){
					// User save last log
					user.last_log = Date.now()
					user.save((err) => {
						if(err){
							res.json({'error':'Log in failed'})
						}
						else{
							// If user is found and password is right create a token
							const token = passport_utils.createToken(user, config.secret)
              user.password = null
              user.nipCode = null
							// Return the information including token as JSON
							res.json({'success': true, 'token': token, 'user':user})
						}
					})
				}
				else{
					res.json({ 'success': false })
				}
			})
		}
	})
})

/* POST login with username and password */
router.post('/login/standard', (req, res) => {
  User.findOne({
		'username': req.body.username
	}, (err, user) => {
		if(err)
			throw err
		if(!user){
			res.send({ 'success': false })
		}
		else{
			// Check if password matches
			user.comparePassword(req.body.password, (err, isMatch) => {
				if(isMatch && !err){
					// User save last log
					user.last_log = Date.now()
					user.save((err) => {
						if(err){
							res.json({'error':'Log in failed'})
						}
						else{
							// If user is found and password is right create a token
							const token = passport_utils.createToken(user, config.secret)
              user.password = null
              user.nipCode = null
							// Return the information including token as JSON
							res.json({'success': true, 'token': token, 'user': user})
						}
					})
				}
				else{
					res.json({ 'success': false })
				}
			})
		}
	})
})

/* PUT update profile picture */
router.put('/update/profile-pic', passport.authenticate('jwt', {'session': false}), utils.uploadMediaFile.single('mfile'), (req, res) => {
  if(settings.image_mime_type.includes(req.file.mimetype)){
    utils.thumbnailGenerator(req.file).then((file) => {
      const picture = {
        'thumbnail': file.thumbnail,
        'location': file.path,
        'mimetype': file.mimetype,
        'size': file.size
      }
      User.findByIdAndUpdate(req.user.data._id, {'$set': {'profile_pic': picture}}, {'new': true}, (err, user) => {
        if(err || !user){
          res.json({'success': false})
          utils.deleteFile(req.file.path) // :(
          utils.deleteFile(file.thumbnail)
        }
        else{
          res.json({'success': true})
        }
      })
    }).catch((err) => {
      res.json({'success': false})
      // Delete Uploaded File
      if(req.file)
        utils.deleteFile(req.file.path) // :(
    })
  }
  else{
    res.json({'success': false})
    // Delete Uploaded File
    if(req.file)
      utils.deleteFile(req.file.path) // :(
  }
})

/* PUT update bio */
router.put('/update/bio', passport.authenticate('jwt', {'session': false}), (req, res) => {
  // Edit profile information
  User.findByIdAndUpdate(req.user.data._id, {'$set': {'bio': req.body.bio}}, {'new':true}, (err, user) => {
    if(err || !user){
      res.json({ 'success': false })
    } else {
      res.json({'success': true, 'doc': user.bio})
    }
  })
})

/* PUT update social networks */
router.put('/update/networks', passport.authenticate('jwt', {'session': false}), (req, res) => {
  // Edit profile information
  User.findById(req.user.data._id, (err, user) => {
    if(err || !user){
      res.json({'success': false})
    } else {
      const networkToAdd = { 'network_name': req.body.network_name, 'network_contact': req.body.contact }
      if (!user.contact_info || user.contact_info.length === 0) {
        // User has no network info
        user.contact_info = networkToAdd
        user.save((err) => {
          if (err) {
            res.status(500).send('error')
          } else {
            res.json({'success': true, 'doc': user.contact_info})
          }
        })
      } else {
        // User has network info
        let networkIdx = user.contact_info.findIndex(x => x.network_name === req.body.network_name)
        if (networkIdx < 0) { // Didn't find  element
          user.contact_info.push(networkToAdd)
        } else { // Found element
          (user.contact_info[networkIdx]).network_contact = networkToAdd.network_contact
        }
        user.save((err) => {
          if (err) {
            res.status(500).send('error')
          } else {
            res.json({'success': true, 'doc': user.contact_info})
          }
        })
      }
    }
  })
})

/* POST reset password (send token) PENDING */
router.post('/forgot-pwd', passport.authenticate('jwt', {'session': false}), (req, res) => {
  // Create token for recovery and save it to user model
  // Respond with success
  // Send email with token
  res.json({'success': false})
})

/* PUT change email */
router.put('/reset-email', passport.authenticate('jwt', {'session': false}), (req, res) => {
  User.findById(req.user.data._id, (err, user) => {
    if (!user || err) {
      res.status(404).send('no such user')
    }
    user.comparePassword(req.body.password, (err, isMatch) => {
      if(isMatch && !err){
        // If its the correct password, update email
        User.findByIdAndUpdate(req.user.data._id, { '$set': { 'email': req.body.email }}, (err, user) => {
          if (err || !user) {
            res.status(500).send('error')
          } else {
            res.json({ 'success': true })
          }
        })
      } else{
        res.status(403).send({ 'error': 'unauthorized' })
      }
    })
  })
})

/* PUT change user alias */
router.put('/alias', passport.authenticate('jwt', {'session': false}), (req, res) => {
  const hours = Math.abs(req.user.data.alias.changed - new Date())/36e5
  if(req.user.data.alias.handle === null || hours >= settings.alias_change_rate){
    // Determine new alias string
    const aliasHandle = (!req.body.alias || req.body.alias === '' || req.body.alias.match(/^\s*$/) !== null)?
      null : req.body.alias
    // Update user
    User.findByIdAndUpdate(req.user.data._id,
      {
        '$set':{
          'alias.anonId': mongoose.Types.ObjectId(),
          'alias.handle': aliasHandle,
          'alias.changed': new Date()
        }
      }, (err) => {
        if(err){
          res.json({ 'success': false, 'valerr': utils.parseValidationErrors(validationErrors) })
        }
        else{
          res.json({ 'success': true })
        }
    })
  }
  else{
    res.json({ 'success': false, 'err': 'hours'})
  }
})

/* POST search user by username with filters */
router.post('/search', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['search_user'])){
    User.find(
      { '$text': { '$search': req.body.username }},
      { 'score': { '$meta': 'textScore' }}
    ).select(
      user_list_default
    ).sort(
      { 'score': { '$meta': 'textScore' }}
    ).limit(
      settings.max_user_search_results
    ).exec((err, users) => {
      if(err || !users){
        res.json({ 'success': false })
      }
      else{
        res.json({ 'success': true, 'doc': users })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

/* PUT ban user */ //(GENERATES NOTIFICATION)
router.put('/ban', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['ban_user'])){
    User.findOneAndUpdate({ '_id': req.body.user_id, 'is_super': false },
    {
      '$set': {
        'banned': {
          'is_banned': true,
          'banned_by': req.user.data._id,
          'banned_until': req.body.banned_until
        }
      }
    }, (err, user) => {
      if(err || !user){
        res.json({ 'success': false })
      }
      else{
        res.json({ 'success': true })
        utils.createAndSendNotification(req.body.user_id, false, req.user.data, `You are banned`,
        'You were banned for violating the site\'s policies', { 'type': 'ban' }).catch((err) => {
          // Handle error
        })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

/* PUT unban user */
router.put('/unban', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['unban_user'])){
    User.findOneAndUpdate({ '_id': req.body.user_id },
    {
      '$set': {
        'banned': {
          'is_banned': false,
          'banned_by': null,
          'banned_until': null
        }
      }
    }, (err, user) => {
      if(err || !user){
        res.json({ 'success': false })
      }
      else{
        res.json({ 'success': true })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

/* PUT change user's password */
router.put('/password', passport.authenticate('jwt', {'session': false}), (req, res) => {
  User.findById(req.user.data._id, (err, user) => {
    if (!user || err || !req.body.new_password) {
      res.status(404).send('val errors')
    }
    user.comparePassword(req.body.password, (err, isMatch) => {
      if(isMatch && !err){
        user.password = req.body.new_password
        user.save((err) => {
          if(err){
            res.status(500).send('error')
          } else{
            res.json({ 'success': true })
          }
        })
      }
      else{
        res.status(403).send({ 'error': 'unauthorized' })
      }
    })
  })
})

/* DELETE user */
router.delete('/remove', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['delete_user'])){
    User.remove({ '_id': req.body.user_id, 'is_super': false }, (err) => {
      if(err){
        res.json({ 'success': false })
      }
      else{
        res.json({ 'success': true })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

/* POST upgrade a user's priviledges or remove them */ //(GENERATES NOTIFICATION)
router.post('/promote', passport.authenticate('jwt', {'session': false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['promote_user'])){
    const priviledges = (req.body.priviledges)? req.body.priviledges : []
    User.findOneAndUpdate({ '_id': req.body.user_id, 'is_super': false },
    {
      '$set': {
        'priviledges': priviledges
      }
    }, (err, user) => {
      if(err || !user){
        res.json({ 'success': false })
      }
      else{
        res.json({ 'success': true })
        utils.createAndSendNotification(req.body.user_id, false, req.user.data, `Congratulations!`,
        'You were promoted', { 'type': 'promotion'}).catch((err) => {
          // Handle error
        })
      }
    })
  }
  else{
    res.status(401).send('Unauthorized')
  }
})

//=================================================================================
//									--	INFO REQUESTS --
//=================================================================================

// List items to show
const default_request_list = 'to requested_by date_requested'
const personal_request_list = 'to requested_by date_requested has_access responded'

/* GET specific info request */
router.get('/request/:request_id', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.findById({ '_id': req.params.request_id, 'actors': { '$in': [req.user.data._id]}},
  'to requested_by has_access', (err, request) => {
    if(err || !request){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': request })
    }
  })
})

/* GET check if user has info access */
router.get('/is-friend/:user_id', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.findOne({ 'actors': { '$all': [req.user.data._id, req.params.user_id]}}, 'has_access responded requested_by', (err, request) => {
    if(err || !request){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': request })
    }
  })
})

/* POST create an info request */ //(GENERATES NOTIFICATION)
router.post('/request', passport.authenticate('jwt', {'session': false}),(req, res) => {
  let newRequest = new Request({
    'to': {
      'id': req.body.to_userid
    },
    'requested_by': {
      'username': req.user.data.username,
      'id': req.user.data._id,
      'thumbnail_pic': req.user.data.profile_pic.thumbnail
    },
    'actors': [req.body.to_userid, req.user.data._id]
  })
  Request.findOne({ 'actors': { '$all': [req.user.data._id, newRequest.to.id]}}, 'has_access', (err, request) => {
    if(err){
      res.json({ 'success': false })
    }
    else{
      if(request){
        // A relationship has already been established
        res.json({ 'success': true, 'is_friend': request.has_access })
      }
      else{
        User.findOne({ '_id': newRequest.to.id }, 'username profile_pic new_requests', (err, user) => {
          if(err || !user || user._id == req.user.data._id){
            res.json({ 'success': false })
          }
          else{
            if(user.new_requests < settings.max_info_requests){
              newRequest.to['username'] = user.username
              newRequest.to['thumbnail_pic'] = user.profile_pic.thumbnail
              Request.create(newRequest, (err, request) => {
                if(err || !request){
                  res.json({ 'success': false })
                }
                else{
                  // Notify user
                  utils.createAndSendNotification(request.to.id, false, req.user.data, `New Networking Request`,
                  `${req.user.data.username} sent you a request`, { 'type': 'request', 'friendId': req.user.data.id }).catch((err) => {
                    // Handle error
                  })
                  // Increment request count
                  user.update({ '$inc': { 'new_requests': 1 }}).exec()
                  res.json({ 'success': true })
                }
              })
            }
            else{
              res.json({ 'success': false })
            }
          }
        })
      }
    }
  })
})

/* GET list of user's forward info requests */
router.get('/sent-requests', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.find({ 'requested_by.id': req.user.data._id, 'responded': false }).select(
    default_request_list
  ).sort(
    { 'date_requested': -1 }
  ).exec((err, requests) => {
    if(err || !requests){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': requests })
    }
  })
})

/* GET list of user's incoming info requests */
router.get('/my-requests', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.find({ 'to.id': req.user.data._id, 'responded': false }).select(
    default_request_list
  ).sort(
    { 'date_requested': -1 }
  ).exec((err, requests) => {
    if(err || !requests){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': requests })
    }
  })
})

/* POST deny all info requests */
router.post('/requests/deny-all', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.update({ 'to.id': req.user.data._id, 'responded': false },
  {
    '$set': {
      'responded': true,
      'has_access': false
    }
  }, (err) => {
    if(err){
      res.json({ 'success': false })
    }
    else{
      // Reset request counter to 0
      req.user.data.update({ '$set': { 'new_requests': 0 }}).exec()
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

/* GET list of users with granted access */
router.get('/friends', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.find({ 'actors': req.user.data._id, 'has_access': true }).select(
    personal_request_list
  ).sort(
    { 'date_requested': -1 }
  ).exec((err, requests) => {
    if(err || !requests){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': requests })
    }
  })
})

/* GET list of users which access has been denied */
router.get('/foes', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.find({ 'to.id': req.user.data._id, 'responded': true ,'has_access': false }).select(
    personal_request_list
  ).sort(
    { 'date_requested': -1 }
  ).exec((err, requests) => {
    if(err || !requests){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': requests })
    }
  })
})

/* PUT accept or deny an info request */ //(GENERATES NOTIFICATION)
router.put('/request/:request_id/respond', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.findOneAndUpdate({ 'to.id': req.user.data._id, '_id': req.params.request_id, 'responded': false },
  {
    '$set': {
      'responded': true,
      'has_access': req.body.has_access
    }
  }, { 'new': true }, (err, request) => {
    if(err || !request){ // If there's an error
      res.json({ 'success': false })
    }
    else{
      // Notificate requesting user that he has been accepted
      if(request.has_access == true){
        utils.createAndSendNotification(request.requested_by.id, false, req.user.data, `${request.to.username} accepted your request`,
        'You now have access to user\'s networking data', { 'type': 'friendRes', 'friendId': request.to.id }).catch((err) => {
          // Handle error
        })
      }
      // Decrease user's new_requests counter
      req.user.data.update({ '$inc': { 'new_requests': -1 }}).exec()
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

/* PUT change an already denied or accepted request */
router.put('/request/:request_id/edit', passport.authenticate('jwt', {'session': false}), (req, res) => {
  const accss = (req.body.has_access === 'true')? false : true
  Request.findOneAndUpdate({ 'to.id': req.user.data._id, '_id': req.params.request_id, 'has_access': accss,'responded': true },
  {
    '$set': {
      'has_access': req.body.has_access
    }
  }, { 'new': true }, (err, request) => {
    if(err || !request){ // If there's an error
      res.json({ 'success': false })
    }
    else{
      // Notificate requesting user that he has been accepted
      if(request.has_access == true){
        utils.createAndSendNotification(request.requested_by.id, false, req.user.data, `${request.to.username} accepted your request`,
          'You now have access to user\'s networking data', { 'type': 'requestAccepted', 'userId': request.to.id })
      }
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

/* DELETE revoke an user\'s info access */
router.delete('/request/:request_id/remove', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Request.findOne({'_id': req.params.request_id, 'actors': { '$in': [req.user.data._id]}}, (err, request) => {
    request.remove((err) => {
      if(err){
        res.json({ 'success': false })
      }
      else{
        if(!request.responded)
          req.user.data.update({ '$inc': { 'new_requests': -1 }}).exec()
        res.json({ 'success': true })
      }
    })
  })
})

//=================================================================================
//									--	NOTIFICATIONS --
//=================================================================================

const default_notification_list = '_id title description reference_url seen meta'

/* POST list notifications past X date */
router.post('/notifications/since', passport.authenticate('jwt', {'session': false}), (req, res) => {
  const date = new Date(req.body.date)
  Notification.find({ 'owner': req.user.data._id, 'seen': false, 'date_alerted': { '$gt': req.body.date }}).select(
    default_notification_list
  ).sort(
    { 'date_alerted': -1 }
  ).exec((err, notifications) => {
    if(err || !notifications){
      res.json({ 'success': false })
    } else{
      res.json({ 'success': true, 'doc': notifications })
    }
  })
})

/* PUT set a notification as seen */
router.put('/notification/:notif_id/set-seen', passport.authenticate('jwt', {'session': false}), (req, res) => {
  const now = (new Date()).now
  Notification.findOneAndUpdate({ '_id': req.params.notif_id, 'owner': req.user.data._id },
  {
    '$set': {
      'seen': true,
      'date_seen': now
    }
  },{ 'new': true }, (err, notif) => {
    if(err || !notif){
      res.json({ 'success': true })
    }
    else{
      // Update user's notification account
      req.user.data.update({ '$inc': {'new_notifications': -1}}).exec()
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

/* GET specific notification */
router.get('/notification/:notif_id', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Notification.findOne({ '_id': req.params.notif_id, 'owner': req.user.data._id }, (err, notif) => {
    if(err || !notif){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': notif })
    }
  })
})

/* DELETE remove all notifications of logged in user */
router.delete('/notifications/empty', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Notification.remove({ 'owner': req.user.data._id }, (err, notification) => {
    if(err){
      res.json({ 'success': false })
    }
    else{
      // Update user's notification account
      req.user.data.update({ '$set': {'new_notifications': 0}}).exec()
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

/* GET unseen notifications */
router.get('/notifications/unseen', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Notification.find({ 'owner': req.user.data._id, 'seen': false }).select(
    default_notification_list
  ).sort(
    { 'date_alerted': -1 }
  ).exec((err, notifications) => {
    if(err || !notifications){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': notifications })
    }
  })
})

/* PUT set all unseen notifs as seen */
router.put('/notifications/set-seen', passport.authenticate('jwt', {'session': false}), (req, res) => {
  const now = (new Date()).now
  Notification.updateMany({ 'owner': req.user.data._id, 'seen': false },
  {
    '$set': { 'seen': true, 'date_seen': now }
  }, (err) => {
    if(err){
      res.json({ 'success': false })
    }
    else {
      // Update user's notification account
      req.user.data.update({ '$set': {'new_notifications': 0}}).exec()
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

/* GET latest notifications (first X) */
router.get('/notifications/latest', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Notification.find({ 'owner': req.user.data._id }).select(
    default_notification_list
  ).sort(
    { 'date_alerted': -1 }
  ).limit(
    settings.max_notif_list_results
  ).exec((err, notifications) => {
    if(err || !notifications){
      res.json({ 'success': false })
    }
    else{
      res.json({ 'success': true, 'doc': notifications })
    }
  })
})

/* DELETE remove a notification */
router.delete('/notification/:notif_id/remove', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Notification.findOneAndRemove({ '_id': req.params.notif_id, 'owner': req.user.data._id }, (err) => {
    if(err){
      res.json({ 'success': false })
    }
    else{
      // Update user's notification count
      if(notification.seen === true)
        req.user.data.update({ '$inc': {'new_notifications': -1}}).exec()
      // Send successfull response
      res.json({ 'success': true })
    }
  })
})

module.exports = router
