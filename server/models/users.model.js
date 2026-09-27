const { default: mongoose } = require("mongoose");

const userSchema = new mongoose.Schema({
    FirstName:{
        type:String, required:true, trim:true
    },
    LastName:{
        type:String, required:true, trim:true
    },
    BirthDate:{
        type:Date
    },
    Gender:{
        type:String
    },
    Email:{
        type:String, required:true, unique:true, lowercase:true, trim:true
    },
    Password:{
        type:String, required:true, select:false
    },
    ProfilePicture: { type: String, default: "" },
    CoverPicture: { type: String, default: "" },
    Bio: { type: String, default: "", maxlength: 200 },
    Posts:{
        type: [mongoose.Schema.Types.ObjectId], ref:"post", default:[]
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId, ref: "user"
    }],
    followers: [{
         type: mongoose.Schema.Types.ObjectId, ref: "user"
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId, ref: "user"
    }],
    isOnline: {
        type: Boolean, default: false
    },
    lastSeen: {
        type: Date, default: Date.now
    }
},
    {
        timestamps:true
    }
)



module.exports = mongoose.model("user", userSchema)
