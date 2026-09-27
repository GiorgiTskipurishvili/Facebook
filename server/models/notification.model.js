const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId, ref: "user", required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId, ref: "user", required: true
    },
    type: {
        type: String,
        enum: ["post_like", "post_comment", "comment_reply", "comment_like", "friend_request", "friend_accept", "follow"],
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId, ref: "post", default: null
    },
    comment: {
        type: mongoose.Schema.Types.ObjectId, ref: "comment", default: null
    },
    isRead: {
        type: Boolean, default: false
    }
},
{
    timestamps: true
})

notificationSchema.index({ recipient: 1, createdAt: -1 })

module.exports = mongoose.model("notification", notificationSchema)
