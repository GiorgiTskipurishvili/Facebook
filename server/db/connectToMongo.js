const { default: mongoose } = require("mongoose")


async function ConnectToMongo() {
    try{
        await mongoose.connect(process.env.MONGO_URI)
        console.log({message:"დაკავშირდა წარმატებით"})
    }catch(error){
        console.log(error, "ეს ერორი მოდის მონგოს ქონექთიდან")
    }
}

module.exports = ConnectToMongo

