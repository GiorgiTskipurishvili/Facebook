const { default: mongoose } = require("mongoose");

const userSchema = new mongoose.Schema({
    FirstName:{
        type:String
    },
    LastName:{
        type:String
    },
    BirthDate:{
        type:Date
    },
    Gender:{
        type:String
    },
    Email:{
        type:String
    },
    Password:{
        type:String
    },
    ProfilePicture: { type: String, default: "" },
    Posts:{
        type: [mongoose.Schema.Types.ObjectId], ref:"posts", default:[]
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