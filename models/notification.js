const mongoose = require('mongoose')
const Schema = mongoose.Schema

const notificationSchema = new Schema({
  owner: { type: Schema.ObjectId, required: true, index: true },
  title: { type: String, required: true },
	description: { type: String, required: true },
  meta: { type: Schema.Types.Mixed, required: false, default: null },
  seen: { type: Boolean, required: true, default: false },
  date_seen: { type: Date, default: null }
}, { timestamps: { 'createdAt': 'date_alerted' }})

module.exports = mongoose.model('Notification', notificationSchema)
