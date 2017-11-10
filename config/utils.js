// Import required dependencies for media upload and thumbnail creation
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const mime = require('mime')
const sharp = require('sharp')
const fs = require('fs')
const ffmpeg = require('fluent-ffmpeg')
const s3 = require('./s3') // Import s3 configurations
// const ffmpeg = require('fluent-ffmpeg') // DISK
// Import models required for notification
const Notification = require('../models/notification')
const User = require('../models/user')
// Import system configurations
const settings = require('./settings')

// Promisify Crypo
const { promisify } = require('util')
const pseudoRandomBytes = promisify(crypto.pseudoRandomBytes);

// For sending emails
const mailer = require('./nodemailer.js')

//=================================================================================
//									--	ALGORITHMS & FUNCTIONS --
//=================================================================================

// Check user priviledge (not social priviledge)
const priviledgeCheck = (priviledgeList, requiredPriviledges) => {
  for(let i = 0; i < requiredPriviledges.length; i++){
    if(!priviledgeList.includes(requiredPriviledges[i])){
      return false
    }
  }
  return true
}

// Hot ranking algorithm - Source from Reddit translated to JS
const log10 = (value) => {
  return Math.log(value) / Math.LN10
}

const secondsf = (date) => {
  const epoch = new Date(1970, 1, 1)
  const td = date.getTime() - epoch.getTime()
  return Math.abs(td/1000)
}

const signf = (score) => {
  if(score > 0){
    return 1
  }
  if(score < 0){
    return -1
  }
  return 0
}

const hotAlgorithm = (ups, downs, date) => {
  const score = ups - downs
  const order = log10(Math.max(Math.abs(score), 1))
  const sign = signf(score)
  const seconds = secondsf(date) - 1134028003
  const result = sign * order + seconds / 45000
  return Math.round(Math.pow(10, 7) * result) / Math.pow(10, 7)
}

// Safely parse JSON with try catch
const parseJSON = (json, callback) => {
  if (callback) {
    let parsed
    try{
      parsed = JSON.parse(json)
      return callback(null, parsed)
    } catch(e){
      return callback(e, null)
    }
  } else {
    let parsed
    try{
      parsed = JSON.parse(json)
      return parsed
    } catch(e){
      return null
    }
  }
}

// Parse mongoose error
const parseMongooseError = (error) => {
  if(!error)
    return null
  const fieldName = error.message.substring(error.message.lastIndexOf('.$') + 2, error.message.lastIndexOf('_1'))
  let errorString = ''
  if (error.code === 11000) {
    errorString = 'already exists'
  }
  const otp = `${fieldName.charAt(0).toUpperCase()} ${fieldName.slice(1)} ${errorString}`
  const splits = otp.split(':')
  return splits[(splits.length - 1)]
}

// Parse mongoose validation errors
const parseValidationErrors = (err) => {
  if(!err)
    return null
  let validationErrors = {}
  for(let key in err.errors) {
    validationErrors[key] = (err.errors[key]).properties.message
  }
  return validationErrors
}

//=================================================================================
//									--	Notifications --
//=================================================================================

// Create a new notification
const createAndSendNotification = async (ownerId, isAnon, sender, title, description, metainfo) => {
  try {
    const query = (isAnon === true) ? { 'alias.anonId': ownerId } : { '_id': ownerId }
    const user = await User.findOne(query).exec()
    // Check if triggering user exists and isn't recipient user
    const isSameId = user._id.equals(sender._id)
    const isSameAnon = (user.alias.anonId && sender.alias) ? user.alias.anonId.equals(sender.alias.anonId)  : false
    if (user && !isSameId && !isSameAnon) {
      // Create the notification in the database and up user notification count
      const notification = new Notification({
        'owner': user._id,
        'title': title,
        'description': description,
        'meta': metainfo
      })
      const savedNotif = await Notification.create(notification)
      // Send email if user has been disconnected for X amount of time
      const hours = Math.abs(user.last_log - new Date())/36e5
      // Check user's notifs are greater than threshold
      if (user.new_notifications >= settings.threshold || hours >= settings.max_gone_hours) {
        console.log('sending mail')
        // Send mail
        mailer.sendMail({
          from: '"Fred Foo 👻" <kyzpujmyyy36js4c@ethereal.email>', // sender address
          to: user.email, // list of receivers
          subject: 'Hello ✔', // Subject line
          text: 'Hello world?', // plain text body
          html: '<b>Hello world?</b>' // html body
        }).catch((err)=>{console.log(err)}) // should catch error
        // Reset notif counter
        user.update({ '$set': {'new_notifications': 0}}).exec()
      } else {
        // increment usr notifs
        user.update({ '$inc': {'new_notifications': 1}}).exec()
      }
      return Promise.resolve(savedNotif)
    } else {
      return Promise.resolve(null)
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

//=================================================================================
//									--	MULTER & MEDIA STORAGE --
//=================================================================================

const s3url = 'https://netslap-objstrg.nyc3.digitaloceanspaces.com'

// Multer storage object (DISK)
/* const storage = multer.diskStorage({
  'destination': function(req, file, cb){
    cb(null, __dirname + '/../public/media/')
  },
  'filename': function (req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype))
    })
  }
}) */

// Multer storage object memory
const storage = multer.memoryStorage()

// Multer file filter
const filter = function(req, file, cb){
  if(settings.allowed_file_types.includes(mime.extension(file.mimetype))){
    cb(null, true)
  }
  else{
    return cb(new Error('Wrong file format'))
  }
}

// Utility function/middleware to upload a media file
const uploadMediaFile = multer({
  'storage': storage,
  'limits': {'fileSize': settings.max_upload_size, 'files': 1}, // 8 MB max size
  'fileFilter': filter
})

// Delete file from media store
const deleteFile = function(path, callback){
  if(path == null)
    return
  fs.unlink(path, (err) => {
    if(typeof callback === 'function'){
      return callback(err)
    }
    else{
      return (err == null)
    }
  })
}

const promiseFFMPG = function (filePath, dest, fileName) {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .on('end', () => {
        resolve(`${dest}${fileName}`)
      })
      .on('error', () => {
        reject(new Error('ffmpeg error'))
      })
      .screenshots({
        'timestamps': ['20%'],
        'filename': `${fileName}`,
        'folder': dest,
        'size': '200x150'
      })
  })
}

// Utility function to upload media to S3
const uploadMediaToS3 = async (file) => {
  try {
    if (file) {
      let randbytes = await pseudoRandomBytes(16)
      file.tourl = s3url
      if(settings.image_mime_type.includes(file.mimetype)) {
        file.filename = `${randbytes.toString('hex')}.${mime.extension(file.mimetype)}`
        file.thumbname = `${randbytes.toString('hex')}.jpg`
        // Upload main file
        const mainres = await s3.putObject({
          Bucket: 'netslap-objstrg',
          Key: file.filename,
          Body: file.buffer,
          ACL: 'public-read'
        }).promise()
        // Create and upload thumbnail
        const buffer = await sharp(file.buffer).resize(300, 200).max().toBuffer()
        const s3res = await s3.putObject({
          Bucket: 'netslap-objstrg',
          Key: file.thumbname,
          Body: buffer,
          ACL: 'public-read'
        }).promise()
      } else { // assume video
        let randbytes = await pseudoRandomBytes(16)
        file.filename = `${randbytes.toString('hex')}.${mime.extension(file.mimetype)}`
        file.thumbname = `${randbytes.toString('hex')}thumb.png`
        // Save files temporarily
        const path = `${__dirname}/../public/media/`
        const fpath = `${path}${file.filename}`
        const fileError = await promisify(fs.writeFile)(fpath, file.buffer)
        const thumbPath = await promiseFFMPG(fpath, path, file.thumbname)
        // Retreive thumbnail from disk
        const thumbnailBuffer = await promisify(fs.readFile)(thumbPath)
        // Upload main file
        const mainres = await s3.putObject({
          Bucket: 'netslap-objstrg',
          Key: file.filename,
          Body: file.buffer,
          ACL: 'public-read'
        }).promise()
        // Upload thumbnail
        const s3res = await s3.putObject({
          Bucket: 'netslap-objstrg',
          Key: file.thumbname,
          Body: thumbnailBuffer,
          ACL: 'public-read'
        }).promise()
        // Delete temporary files asynchronously
        deleteFile(fpath)
        deleteFile(thumbPath)
        return file
      }
      return file
    } else {
      return null
    }
  } catch (err) {
    return new Error(err)
  }
}

// Utility function to generate a thumbnail from the uploaded file (DISK)
const thumbnailGenerator = function(multer_file){
  return new Promise((resolve, reject) => {
  if(multer_file){ // File was uploaded
    const thumbnail_name = multer_file.filename.substring(0, multer_file.filename.length -6)
    const thumbnail_dest = `${multer_file.destination}${thumbnail_name}thumb.jpg`
    // Create thumbnail for file if supported
    if(settings.image_mime_type.includes(multer_file.mimetype)){
      // Create image thumbnail
      sharp(multer_file.path)
        .resize(300, 200)
        .max()
        .toFile(thumbnail_dest, (err) => {
          if(!err){
            multer_file['thumbnail'] = thumbnail_dest
            resolve(multer_file)
          }
          else {
            reject(err)
          }
        })
    }
    else if(settings.video_mime_type.includes(multer_file.mimetype)){
      // Create video thumbnail
      ffmpeg(multer_file.path)
        .on('end', () => {
          multer_file['thumbnail'] = thumbnail_dest
          resolve(multer_file)
        })
        .on('error', () => {
          reject(new Error('Unable to parse'))
        })
        .screenshots({
          'timestamps': ['20%'],
          'filename': `${thumbnail_name}thumb.jpg`,
          'folder': multer_file.destination,
          'size': '200x150'
        })
    }
    else{
      resolve(null)
    }
  }
  else{ // No file was uploaded
    resolve(null)
  }
})}

module.exports = {
  'hasRequiredPriviledges': priviledgeCheck,
  'hotAlgorithm': hotAlgorithm,
  'createAndSendNotification': createAndSendNotification,
  'parseJSON': parseJSON,
  'uploadMediaFile': uploadMediaFile,
  'thumbnailGenerator': thumbnailGenerator,
  'deleteFile': deleteFile,
  'parseValidationErrors': parseValidationErrors,
  'parseMongooseError': parseMongooseError,
  'uploadMediaToS3':uploadMediaToS3
}
