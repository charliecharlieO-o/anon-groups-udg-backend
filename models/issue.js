const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const settings = require("../config/settings");

const adminSubSchema = new Schema({
	name: { type: String, required: true },
	id: { type: Schema.ObjectId, required: true }
});

const issueSchema = new Schema({
	by_user: {
		name: { type: String, required: true },
		id: { type: Schema.ObjectId, required: true }
	},
	file: {
		name: { type: String, default: null },
		location: { type: String, default: null },
		size: { type: String, default: null }
	},
	category: { type: String, required: true, enum: settings.issue_categories	},
	problem: { type: String, required: true, maxlength:500 },
	solved: { type: Boolean, default: false },
	board: { type: Schema.ObjectId, default: null },
	reported_object_url: { type: String, required: false, default: null },
	solved_by: { type: adminSubSchema, required: false, default: null },
	details: { type: String }
}, { timestamps: { "createdAt": "reported_at", "updatedAt": "updated_at" }});

module.exports = mongoose.model("Issue", issueSchema);
