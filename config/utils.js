// Import required dependencies for media upload and thumbnail creation
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs');
// Import models required for notification
const Notification = require('../models/notification');
const User = require('../models/user');
// Import system configurations
const settings = require('./settings');

//=================================================================================
//									--	ALGORITHMS & FUNCTIONS --
//=================================================================================

// Check user priviledge (not social priviledge)
const priviledgeCheck = (priviledgeList, requiredPriviledges) => {
  for(let i = 0; i < requiredPriviledges.length; i++){
    if(!priviledgeList.includes(requiredPriviledges[i])){
      return false;
    }
  }
  return true;
};

// Hot ranking algorithm - Source from Reddit translated to JS
const log10 = (value) => {
  return Math.log(value) / Math.LN10;
};

const secondsf = (date) => {
  const epoch = new Date(1970, 1, 1);
  const td = date.getTime() - epoch.getTime();
  return Math.abs(td/1000);
};

const signf = (score) => {
  if(score > 0){
    return 1;
  }
  if(score < 0){
    return -1;
  }
  return 0;
};

const hotAlgorithm = (ups, downs, date) => {
  const score = ups - downs;
  const order = log10(Math.max(Math.abs(score), 1));
  const sign = signf(score);
  const seconds = secondsf(date) - 1134028003;
  const result = sign * order + seconds / 45000;
  return Math.round(Math.pow(10, 7) * result) / Math.pow(10, 7);
};

// Safely parse JSON with try catch
const parseJSON = (json, callback) => {
  let parsed;
  try{
    parsed = JSON.parse(json);
    return callback(null, parsed);
  }
  catch(e){
    return callback(e, null);
  }
};

// Parse mongoose error
const parseMongooseError = (error) => {
  if(!error)
    return null;
  const fieldName = error.message.substring(error.message.lastIndexOf('.$') + 2, error.message.lastIndexOf('_1'));
  let errorString = '';
  if (error.code === 11000) {
    errorString = 'already exists';
  }
  const otp = `${fieldName.charAt(0).toUpperCase()} ${fieldName.slice(1)} ${errorString}`;
  const splits = otp.split(':');
  return splits[(splits.length - 1)];
};

// Parse mongoose validation errors
const parseValidationErrors = (err) => {
  if(!err)
    return null;
  let validationErrors = {};
  for(let key in err.errors) {
    validationErrors[key] = (err.errors[key]).properties.message;
  }
  return validationErrors;
};

//=================================================================================
//									--	Notifications --
//=================================================================================

// Create a new notification
const createAndSendNotification = (owner_id, title, description, url, callback) => {
  // Create the notification in the database and up user notification count
  let notification = new Notification({
    'owner': owner_id,
    'title': title,
    'description': description,
    'reference_url': url
  });
  Notification.create(notification, (err, notification) => {
    if(typeof callback === 'function'){
      User.findOneAndUpdate({ '_id': owner_id }, { '$inc': { 'new_notifications': 1 }}); // Increment notification counter
      return callback(err, notification);
    }
    else{
      return (err == null);
    }
  });
};

//=================================================================================
//									--	MULTER & MEDIA STORAGE --
//=================================================================================

// Multer storage object
const storage = multer.diskStorage({
  'destination': function(req, file, cb){
    cb(null, __dirname + '/../public/media/');
  },
  'filename': function (req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
    });
  }
});
// Multer file filter
const filter = function(req, file, cb){
  if(settings.allowed_file_types.includes(mime.extension(file.mimetype))){
    cb(null, true);
  }
  else{
    return cb(new Error('Wrong file format'));
  }
};
// Utility function/middleware to upload a media file
const uploadMediaFile = multer({
  'storage': storage,
  'limits': {'fileSize': settings.max_upload_size, 'files': 1}, // 8 MB max size
  'fileFilter': filter
});
// Utility function to generate a thumbnail from the uploaded file
const thumbnailGenerator = function(multer_file){
  return new Promise((resolve, reject) => {
  if(multer_file){ // File was uploaded
    const thumbnail_name = multer_file.filename.substring(0, multer_file.filename.length -6);
    const thumbnail_dest = `${multer_file.destination}${thumbnail_name}thumb.jpg`;
    // Create thumbnail for file if supported
    if(settings.image_mime_type.includes(multer_file.mimetype)){
      // Create image thumbnail
      sharp(multer_file.path)
        .resize(200, 150)
        .max()
        .toFile(thumbnail_dest, (err) => {
          if(!err){
            multer_file['thumbnail'] = thumbnail_dest;
            resolve(multer_file);
          }
          else {
            reject(err);
          }
        });
    }
    else if(settings.video_mime_type.includes(multer_file.mimetype)){
      // Create video thumbnail
      ffmpeg(multer_file.path)
        .on('end', () => {
          multer_file['thumbnail'] = thumbnail_dest;
          resolve(multer_file);
        })
        .on('error', () => {
          reject(new Error('Unable to parse'));
        })
        .screenshots({
          'timestamps': ['20%'],
          'filename': `${thumbnail_name}thumb.jpg`,
          'folder': multer_file.destination,
          'size': '200x150'
        });
    }
    else{
      resolve(null);
    }
  }
  else{ // No file was uploaded
    resolve(null);
  }
})};
// Delete file from media store
const deleteFile = function(path, callback){
  if(path == null)
    return;
  fs.unlink(path, (err) => {
    if(typeof callback === 'function'){
      return callback(err);
    }
    else{
      return (err == null);
    }
  });
};

module.exports = {
  'hasRequiredPriviledges': priviledgeCheck,
  'hotAlgorithm': hotAlgorithm,
  'createAndSendNotification': createAndSendNotification,
  'parseJSON': parseJSON,
  'uploadMediaFile': uploadMediaFile,
  'thumbnailGenerator': thumbnailGenerator,
  'deleteFile': deleteFile,
  'parseValidationErrors': parseValidationErrors,
  'parseMongooseError': parseMongooseError
};
