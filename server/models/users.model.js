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
    Posts:{
        type: [mongoose.Schema.Types.ObjectId], ref:"posts", default:[]
    }
},
    {      
        timestamps:true
    }
)



module.exports = mongoose.model("user", userSchema)