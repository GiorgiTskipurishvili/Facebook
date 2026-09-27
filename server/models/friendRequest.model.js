const mongoose = require("mongoose");

const friendRequestSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    },
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    },
    status: { 
        type: String, enum: ["pending", "accepted", "rejected"], default: "pending"
     }
},
{
    timestamps: true
})

module.exports = mongoose.model("friendRequest", friendRequestSchema)