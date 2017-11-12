const mongoose  = require('mongoose')
const Schema = mongoose.Schema
const shortId = require('shortid')

const keySchema = new Schema({
  user_id: { type: Schema.ObjectId, index: true, required: true },
  key_id: { type: String, required: true, default: shortId.generate }
}, { timestamps: { 'createdAt': 'requested_at', 'updatedAt': 'updated_at' }})

module.exports = mongoose.model('RecoveryKey', keySchema)
