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
    }],
    // post - ჩვეულებრივი, profile_picture/cover_photo - ავტომატური პოსტი სურათის შეცვლისას, share - გაზიარება
    type:{
        type:String, enum:["post", "profile_picture", "cover_photo", "share"], default:"post"
    },
    // გაზიარებისას - ორიგინალი პოსტი
    sharedPost:{
        type:mongoose.Schema.Types.ObjectId, ref:"post", default:null
    }
},
{
    timestamps:true
})

postSchema.index({ user: 1, createdAt: -1 })
postSchema.index({ sharedPost: 1 })

module.exports = mongoose.model("post", postSchema)
