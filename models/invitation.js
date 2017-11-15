const mongoose  = require('mongoose')
const Schema = mongoose.Schema
const shortId = require('shortid')

const invitationSchema = new Schema({
  issuer_id: { type: Schema.ObjectId, index: true, required: true },
  to_email: { type: String, required: true }
  key_id: { type: String, required: true, default: shortId.generate }
}, { timestamps: { 'createdAt': 'sent_at', 'updatedAt': 'updated_at' }})

module.exports = mongoose.model('Invitation', invitationSchema)
