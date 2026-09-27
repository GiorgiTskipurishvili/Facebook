const { default: mongoose } = require("mongoose")

const RETRY_DELAY = 5000

async function ConnectToMongo() {
    if(!process.env.MONGO_URI){
        console.error("❌ MONGO_URI არ არის მითითებული (.env ან hosting-ის Environment Variables)")
        return
    }

    try{
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
        console.log({message:"დაკავშირდა წარმატებით"})
    }catch(error){
        // პირველი კავშირი ჩავარდა (მაგ. IP არ არის Atlas-ის Access List-ში) -> ვცდით თავიდან
        console.error("ეს ერორი მოდის მონგოს ქონექთიდან:", error.message)
        console.error(`თავიდან ცდა ${RETRY_DELAY / 1000} წამში...`)
        setTimeout(ConnectToMongo, RETRY_DELAY)
    }
}

module.exports = ConnectToMongo
