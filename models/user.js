const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

const settings = require("../config/settings");

// Salt rounds for password hashing
//  a reasonable goal would be for password
//  verification/hashing to take 8 milliseconds per password
const saltRounds = 10;

const userContactInfo = new Schema({
	network_name : { type: String, required: true },
	network_contact: { type: String, required: true },
}, { "_id": false });

const userSchema = new Schema({
	username: { type: String, minlength:1, maxlength: 35, required: true, unique: true, index: true },
	password: { type: String, required: true },
	alias: { // This field will enforce user anonimity throughout the site
		handle: { type: String, minlength: 1, maxlength: 35, default: null },
		changed: { type: Date, default: null }
	},
	profile_pic: {
		thumbnail: { type: String },
		location: { type: String },
		mimetype: { type: String },
		size: { type: Number }
	},
	bio: { type: String, maxlength: 300, default: null },
	priviledges: [ { type: String, required: true, enum: settings.priviledges } ],
	contact_info: [ userContactInfo ],
	phone_number: { type: String, required: true, unique: true },
	new_notifications: { type: Number, required: true, default: 0 },
	new_requests: { type: Number, required: true, default: 0 },
	last_log: { type: Date, required: true, default: null },
	is_super: { type: Boolean, required: true, default: false },
	banned: {
		is_banned: { type: Boolean, required: true, default: false },
		banned_by: { type: Schema.ObjectId, default: null },
		banned_until: { type: Date, default: null }
	}
}, { timestamps: { "createdAt": "signedup_at", "updatedAt": "updated_at" } });

userSchema.index({ username: "text" });

// Here we use the function keyword and not arrows cause
//  arrows change scope out of 'this'

userSchema.pre("save", function(next){
	let user = this;
	if(user.isModified("password") || user.isNew){
		bcrypt.hash(user.password, saltRounds, (err, hash) => {
			if(err){
				return next(err);
			}
			user.password = hash;
			next();
		});
	}
	else{
		return next();
	}
});

userSchema.methods.comparePassword = function(passw, cb){
	bcrypt.compare(passw, this.password, (err, isMatch) => {
		if(err){
			return cb(err);
		}
		cb(null, isMatch);
	});
};

module.exports = mongoose.model('User', userSchema);
