const mongoose = require('mongoose')
const Schema = mongoose.Schema

const settings = require('../config/settings')

const boardSchema = new Schema({
	slug: { type: String, required: true, unique: true, index: true }, // Index
	short_name: { type: String, required: true, maxlength: 15 },
	name: { type: String, required: true, maxlength: 100 }, // Text search index
	image: {
		name: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number },
		thumbnail: { type: String }
	},
	active: { type: Boolean, required: true, default: true },
	description: { type: String, required: true, maxlength: 500 },
	created_by: {
		name: { type: String, required: true },
		id: { type: Schema.ObjectId, required: true }
	}
}, { timestamps: { 'createdAt': 'created_at', 'updatedAt': 'updated_at' }})

boardSchema.index({ short_name: 'text' })

// On Update check image is not null

module.exports = mongoose.model('Board', boardSchema)
