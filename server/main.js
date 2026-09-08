const express = require("express")
const ConnectToMongo = require("./db/connectToMongo")
const usersRouter = require("./routes/users.router")
const authRouter = require("./auth/auth.router")
const postsRouter = require("./routes/posts.router")
const isAuth = require("./middleware/isAuth.middleware")
const cors = require("cors")

const app = express()
const PORT = 3030
app.use(cors())
app.use(express.json())
require("dotenv").config()
ConnectToMongo()



app.use("/users", usersRouter)
app.use("/auth", authRouter)
app.use("/posts", isAuth, postsRouter)


app.get("/", (req,res)=>{
    res.json({message:"This is / request"})
})


app.listen(PORT, ()=>{
    console.log(`server running on http://localhost:${PORT}`)
})