require("dotenv").config()

const express = require("express")
const http = require("http")
const path = require("path")
const { Server } = require("socket.io")
const jwt = require("jsonwebtoken")
const ConnectToMongo = require("./db/connectToMongo")
const usersRouter = require("./routes/users.router")
const authRouter = require("./auth/auth.router")
const postsRouter = require("./routes/posts.router")
const commentsRouter = require("./routes/comments.router")
const friendsRouter = require("./routes/friends.router")
const storiesRouter = require("./routes/stories.router")
const messagesRouter = require("./routes/messages.router")
const isAuth = require("./middleware/isAuth.middleware")
const usersModel = require("./models/users.model")
const cors = require("cors")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: { origin: "*" }
})

const PORT = 3030
app.use(cors())
app.use(express.json())
ConnectToMongo()

app.use("/uploads", express.static(path.join(__dirname, "uploads")))

app.use("/users", usersRouter)
app.use("/auth", authRouter)
app.use("/posts", isAuth, postsRouter)
app.use("/comments", isAuth, commentsRouter)
app.use("/friends", isAuth, friendsRouter)
app.use("/stories", isAuth, storiesRouter)
app.use("/messages", isAuth, messagesRouter)

app.get("/", (req, res) => {
    res.json({ message: "This is / request" })
})

const onlineUsers = new Map()
app.set("io", io)
app.set("onlineUsers", onlineUsers)

io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error("ტოკენი არ არის"))

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        socket.userId = payload.userId
        next()
    } catch (error) {
        next(new Error("ტოკენი არასწორია"))
    }
})

io.on("connection", async (socket) => {
    const userId = socket.userId
    onlineUsers.set(userId, socket.id)

    await usersModel.findByIdAndUpdate(userId, { isOnline: true })
    io.emit("user:online", { userId })

    socket.on("conversation:join", (conversationId) => {
        socket.join(conversationId)
    })

    socket.on("typing", ({ conversationId }) => {
        socket.to(conversationId).emit("typing", { userId, conversationId })
    })

    socket.on("disconnect", async () => {
        onlineUsers.delete(userId)
        const lastSeen = new Date()
        await usersModel.findByIdAndUpdate(userId, { isOnline: false, lastSeen })
        io.emit("user:offline", { userId, lastSeen })
    })
})

server.listen(PORT, () => {
    console.log(`server running on http://localhost:${PORT}`)
})