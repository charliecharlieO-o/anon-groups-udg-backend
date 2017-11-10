const aws = require('aws-sdk')

const s3 = new aws.S3({
  endpoint: 'nyc3.digitaloceanspaces.com',
  accessKeyId: 'QXC5NBOESTUHKZO4RPMI',
  secretAccessKey: 'fjb3qo6M606+gjl5JGbkfE8QFZ7jbIucFhj2CGAi9cI'
})

module.exports = s3
