const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, ref: "user" 
    },
    image: { 
        type: String, required: true 
    },
    views: [{
        user: { 
            type: mongoose.Schema.Types.ObjectId, ref: "user" 
        },
        viewedAt: { type: Date, default: Date.now }
    }],
    expiresAt: { 
        type: Date, required: true 
    }
},
{
    timestamps: true
})


storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model("story", storySchema)