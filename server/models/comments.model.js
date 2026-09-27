const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
    text: { 
        type: String, required: true 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    },
    post: { 
        type: mongoose.Schema.Types.ObjectId, ref: "post" 
    },
    replyTo: { 
        type: mongoose.Schema.Types.ObjectId, ref: "comment", default: null 
    },
    likes: [{ 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    }]
},
{
    timestamps: true
})

module.exports = mongoose.model("comment", commentSchema)