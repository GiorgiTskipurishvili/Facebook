const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    conversation: { 
        type: mongoose.Schema.Types.ObjectId, ref: "conversation" 
    },
    sender: { 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    },
    text: { 
        type: String, default: "" 
    },
    image: { 
        type: String, default: "" 
    },
    seenBy: [{ 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    }]
},
{
    timestamps: true
})

module.exports = mongoose.model("message", messageSchema)