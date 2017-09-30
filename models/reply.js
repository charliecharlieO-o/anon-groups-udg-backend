const mongoose = require('mongoose')
const Schema = mongoose.Schema

const posterSchema = new Schema({
	poster_name: { type: String, required: true },
	poster_thumbnail: { type: String, default: null },
	poster_id: { type: Schema.ObjectId, required: true },
	anon: { type: Boolean, required: true, default: false }
},{ '_id': false })

const subReply = new Schema({
	poster: posterSchema,
	to: posterSchema,
	media: {
		name: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number },
		thumbnail: { type: String }
	},
	removed: { type: Boolean, required: true, default: false },
	text: { type: String, required: true, maxlength: 200 }
})

subReply.pre('save', function(next){
	let subr = this
	if(subr.isNew || subr.isModified('media') || subr.isModified('text')){
		if(subr.media || (subr.text && subr.text !== '' && subr.text.match(/^\s*$/) == null)){
			next()
		}
		else{
			next(new Error('Reply must contain at least media or text'))
		}
	}
	else{
		next()
	}
})

const replySchema = new Schema({
	thread: { type: Schema.ObjectId, required: true, index: true },
	poster: posterSchema,
	media: {
		name: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number },
		thumbnail: { type: String }
	},
	removed: { type: Boolean, required: true, default: false },
	text: { type: String, required: true, maxlength: 500 },
	reply_count: { type: Number, required: true, default: 0 },
	replies: [ subReply ]
}, { timestamps: { 'createdAt': 'created_at', 'updatedAt': 'updated_at' }})

replySchema.pre('save', function(next){
	let reply = this
	if(reply.isNew || reply.isModified('media') || reply.isModified('text')){
		if(reply.media || (reply.text && reply.text !== '' && reply.text.match(/^\s*$/) == null)){
			next()
		}
		else{
			next(new Error('Reply must contain at least media or text'))
		}
	}
	else{
		next()
	}
})

module.exports = mongoose.model('Reply', replySchema)
