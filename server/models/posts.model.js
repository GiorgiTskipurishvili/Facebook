const { default: mongoose } = require("mongoose");


const postSchema = new mongoose.Schema({
    desc:{
        type:String
    },
    images:{
        type:String, default:""
    },
    user:{
        type:mongoose.Schema.Types.ObjectId, ref:"user"
    },
    likes:[{
        type:mongoose.Schema.Types.ObjectId, ref:"user"
    }]
},
{
    timestamps:true
})


module.exports = mongoose.model("post", postSchema)