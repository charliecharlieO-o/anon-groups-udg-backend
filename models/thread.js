const mongoose = require('mongoose')
const Schema = mongoose.Schema

const utils = require('../config/utils')

//Threads should die after 24 hours and decay continuosly

const posterSchema = new Schema({
	name: { type: String, required: true },
	thumbnail: { type: String, required: true },
	id: { type: Schema.ObjectId, required: true }
},{ '_id': false })

const replyExcerptSchema = new Schema({
	reply_id: { type: Schema.ObjectId }, //MUST BE REQUIRED
	poster_name: { type: String, required: true },
	poster_id: { type: Schema.ObjectId, required: true },
	poster_pic: { type: String, required: true },
	text_excerpt: { type: String, required: true }
},{ '_id': false })

const threadSchema = new Schema({
	board: { type: Schema.ObjectId },
	poster: posterSchema,
	title: { type: String, required: true, maxlength: 100 },//30 ideal max
	text: { type: String, maxlength: 500 },
	media: {
		name: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number },
		thumbnail: { type: String }
	},
	reply_excerpts: [ // Will store the first n comment excerpts
		replyExcerptSchema
	],
	alive: { type: Boolean, required: true, default: true },
	thread_decay: { type: Number, required: true, default: 0 },
	reply_count: { type: Number, required: true, default: 0 }
}, { timestamps: { 'createdAt': 'created_at', 'updatedAt': 'updated_at' } })

threadSchema.index({ title: 'text' })

threadSchema.pre('save', function(next){
	let thread = this
	if(thread.isNew || thread.isModified('text') || thread.isModified('media')){
		// Check if post contains image or text
		if(thread.media || (thread.text && thread.text !== '' && thread.text.match(/^\s*$/) == null)){
			thread.thread_decay = utils.hotAlgorithm(thread.reply_count, 0, thread.created_at)
			next()
		}
		else{
			next(new Error('Thread must contain at least media or text'))
		}
	}
	else{
		next()
	}
})

module.exports = mongoose.model('Thread', threadSchema)
