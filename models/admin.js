const mongoose = require('mongoose')
const Schema = mongoose.Schema

const settings = require('../config/settings')

const boardSchema = new Schema({
	id: { type: Schema.ObjectId, required: false, index: true },
	slug: { type: String, required: false, index: true },
	short_name: { type: String, required: false }
},{ '_id': false })

const adminSchema = new Schema({
	user: {
		id: { type: Schema.ObjectId, required: true, unique: true, index: true },
		name: { type: String, required: true }
	},
	appointed_by: {
		id: { type: Schema.ObjectId, required: true, index: true },
		name: { type: String, required: true },
	},
	board: { type: boardSchema, required: false, default: null },
	divisions: { type: [{ type: String, enum: settings.issue_categories }], required: false },
	last_resolution: { type: Date, default: null },
	issues_solved: { type: Number, required: true, default: 0 }
}, { timestamps: { 'createdAt': 'appointed_at' }})

adminSchema.index({ 'user.name': 'text' })

module.exports = mongoose.model('Admin', adminSchema)
