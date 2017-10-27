const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crc32 = require('crc32');
const Schema = mongoose.Schema;

// Salt rounds for password hashing
//  a reasonable goal would be for password
//  verification/hashing to take 8 milliseconds per password
const saltRounds = 10;

// Import app global settings
const settings = require('../config/settings');

// Import validation functions
const validators = require('../config/validators')

const userContactInfo = new Schema({
	network_name : { type: String, required: true },
	network_contact: { type: String },
}, { '_id': false });

// Custom validation arrays
const userNameValidator = [validators.validateUserName, 'Invalid username format']
const aliasValidator = [validators.validateNameWithNull, 'Invalid alias format']
const emailValidator = [validators.validateEmail, 'Invalid email']

// Main User Model
const userSchema = new Schema({
	username: { type: String, minlength:1, required: true, unique: true,
							index: true, validate: userNameValidator },
	password: { type: String, required: true },
	nipCode: { type: Number, required: false, unique: true, index: true }, // SIIAU NIP HASH
	alias: { // This field will enforce user anonimity throughout the site
		anonId: { type: Schema.ObjectId, index: true, default: null }, //yass
		handle: { type: String, minlength: 1, default: null, validate: aliasValidator },
		changed: { type: Date, default: null }
	},
	profile_pic: {
		type: {
			thumbnail: { type: String },
			location: { type: String },
			mimetype: { type: String },
			size: { type: Number }
		},
		default: null
	},
	bio: { type: String, maxlength: 300, default: null },
	priviledges: [ { type: String, required: true, enum: settings.priviledges } ],
	contact_info: [ userContactInfo ],
	email: { type: String, required: true, unique: true, index: true, validate: emailValidator },
	new_notifications: { type: Number, required: true, default: 0 },
	new_requests: { type: Number, required: true, default: 0 },
	last_log: { type: Date, required: true, default: null },
	is_super: { type: Boolean, required: true, default: false },
	banned: {
		is_banned: { type: Boolean, required: true, default: false },
		banned_by: { type: Schema.ObjectId, default: null },
		banned_until: { type: Date, default: null }
	}
}, { timestamps: { 'createdAt': 'signedup_at', 'updatedAt': 'updated_at' } });

userSchema.index({ username: 'text' });

// Here we use the function keyword and not arrows cause
//  arrows change scope out of 'this'
userSchema.pre('save', function(next){
	let user = this;
	if(user.isModified('password') || user.isNew){
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

// NIP setter
userSchema.methods.setNIP = function(newNIP) {
	const hash = crc32.direct(newNIP);
	this.nipCode = hash;
	return hash;
};

// Built-in password comparison method
userSchema.methods.comparePassword = function(passw, cb) {
	bcrypt.compare(passw, this.password, (err, isMatch) => {
		if(err){
			return cb(err);
		}
		cb(null, isMatch);
	});
};

module.exports = mongoose.model('User', userSchema);
