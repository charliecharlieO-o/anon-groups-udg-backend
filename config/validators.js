const validator = require('validator')

function isEmptyOrSpaces (str) {
  return str === null || str.match(/^ *$/) !== null
}

function isNotEmptyOrSpaces (str) {
  return !(str === null || str.match(/^ *$/) !== null)
}

function isSpaces (str) {
  str.match(/^ *$/) !== null
}

function validateUserName (username) {
  if (isEmptyOrSpaces(username)) {
    return false
  }
  else if (username.length < 2) {
    return false
  }
  else if (username.match(/.?".?|.?&.?|.?\'.?|.?<.?|.?>.?/)) {
    return false
  }
  else{
    return true
  }
}

function validateNameWithNull (username) {
  if (username == null)
    return true
  if (isSpaces(username)) {
    return false
  }
  else if (username.length < 2) {
    return false
  }
  else if (username.match(/.?".?|.?&.?|.?\'.?|.?<.?|.?>.?/)) {
    return false
  }
  else{
    return true
  }
}

function validateEmail(str) {
  return validator.isEmail(str)
}

module.exports = {
  'isEmptyOrSpaces': isEmptyOrSpaces,
  'validateUserName': validateUserName,
  'validateEmail': validateEmail,
  'isNotEmptyOrSpaces': isNotEmptyOrSpaces,
  'validateNameWithNull': validateNameWithNull
}
