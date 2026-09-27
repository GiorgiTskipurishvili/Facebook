const { default: mongoose } = require("mongoose");


const postSchema = new mongoose.Schema({
    desc:{
        type:String, default:""
    },
    image:{
        type:String, default:""
    },
    user:{
        type:mongoose.Schema.Types.ObjectId, ref:"user", required:true
    },
    likes:[{
        type:mongoose.Schema.Types.ObjectId, ref:"user"
    }]
},
{
    timestamps:true
})

postSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model("post", postSchema)
