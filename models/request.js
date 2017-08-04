const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const requestSchema = new Schema({
  to: {
    id: { type: Schema.ObjectId, required: true, index: true },
    username: { type: String, required: true },
    thumbnail_pic: { type: String, required: true }
  },
  requested_by: {
    id: { type: Schema.ObjectId, required: true, index: true },
    username: { type: String, required: true },
    thumbnail_pic: { type: String, required: true }
  },
  actors: [{ type: Schema.ObjectId, required: true, index: true }],
  responded: { type: Boolean, required: true, default: false },
  has_access: { type: Boolean, required: true, default: false }
}, { timestamps: { "createdAt": "date_requested" }});

module.exports = mongoose.model("Request", requestSchema);
