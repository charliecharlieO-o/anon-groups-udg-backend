const mongoose = require('mongoose')
const Schema = mongoose.Schema

const posterSchema = new Schema({
	poster_name: { type: String, required: true },
	poster_thumbnail: { type: String, default: null },
	poster_id: { type: Schema.ObjectId, required: true },
	anon: { type: Boolean, required: true, default: false }
}, { '_id': false })

const subReply = new Schema({
	poster: posterSchema,
	to: posterSchema,
	media: { type: {
		name: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number },
		thumbnail: { type: String }
	}, default: null },
	removed: { type: Boolean, required: true, default: false },
	text: { type: String, maxlength: 500 }
}, { timestamps: { 'createdAt': 'created_at', 'updatedAt': 'updated_at' }})

subReply.pre('validate', function(next){
	let subr = this
	// Check if post contains image or text
	if(subr.isNew || subr.isModified('text') || subr.isModified('media')){
		// Check if post contains image or text
		if(!subr.media && (!subr.text || subr.text === '' || subr.text.match(/^\s*$/) !== null)){
			next(new Error('subr must contain at least media or text'))
		}
	}
	// Everything is OK
	next()
})

const replySchema = new Schema({
	thread: { type: Schema.ObjectId, required: true, index: true },
	poster: posterSchema,
	media: { type: {
		name: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number },
		thumbnail: { type: String }
	}, default: null },
	removed: { type: Boolean, required: true, default: false },
	text: { type: String, maxlength: 800 },
	reply_count: { type: Number, required: true, default: 0 },
	replies: [ subReply ]
}, { timestamps: { 'createdAt': 'created_at', 'updatedAt': 'updated_at' }})

replySchema.pre('save', function(next){
	let reply = this
	// Check if post contains image or text
	if(reply.isNew || reply.isModified('text') || reply.isModified('media')){
		// Check if post contains image or text
		if(!reply.media && (!reply.text || reply.text === '' || reply.text.match(/^\s*$/) !== null)){
			next(new Error('reply must contain at least media or text'))
		}
	}
	// Everything is OK
	next()
})

module.exports = mongoose.model('Reply', replySchema)
