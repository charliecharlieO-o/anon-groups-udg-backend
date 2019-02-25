const aws = require('aws-sdk')

const s3 = new aws.S3({
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: ''
})

module.exports = s3
