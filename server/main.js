require("dotenv").config()

const express = require("express")
const http = require("http")
const path = require("path")
const mongoose = require("mongoose")
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
const notificationsRouter = require("./routes/notifications.router")
const isAuth = require("./middleware/isAuth.middleware")
const { notFound, errorHandler } = require("./middleware/error.middleware")
const usersModel = require("./models/users.model")
const conversationModel = require("./models/conversation.model")
const cors = require("cors")

const app = express()
const server = http.createServer(app)
// CLIENT_URL: ერთი ან რამდენიმე მისამართი მძიმით ("https://a.vercel.app,https://b.vercel.app")
// ბოლო "/" იშლება, რადგან ბრაუზერის Origin მას არ შეიცავს. არ არის მითითებული -> ყველა ნებადართულია
const CLIENT_URL = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map(url => url.trim().replace(/\/+$/, "")).filter(Boolean)
    : "*"
const io = new Server(server, {
    cors: { origin: CLIENT_URL }
})

const PORT = process.env.PORT || 3030
app.use(cors({ origin: CLIENT_URL }))
app.use(express.json())
// Express 5-ში req.body undefined-ია, თუ body არ გამოგზავნილა
app.use((req, res, next) => {
    if (!req.body) req.body = {}
    next()
})
ConnectToMongo()

app.use("/uploads", express.static(path.join(__dirname, "uploads")))

app.use("/auth", authRouter)
app.use("/users", isAuth, usersRouter)
app.use("/posts", isAuth, postsRouter)
app.use("/comments", isAuth, commentsRouter)
app.use("/friends", isAuth, friendsRouter)
app.use("/stories", isAuth, storiesRouter)
app.use("/messages", isAuth, messagesRouter)
app.use("/notifications", isAuth, notificationsRouter)

app.get("/", (req, res) => {
    res.json({ message: "This is / request" })
})

app.use(notFound)
app.use(errorHandler)

// userId -> ღია socket-ების რაოდენობა (რამდენიმე tab-ის შემთხვევისთვის)
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

    // პირადი ოთახი: ნოტიფიკაციები და ახალი შეტყობინებები აქ მოდის
    socket.join(`user:${userId}`)

    const connections = (onlineUsers.get(userId) || 0) + 1
    onlineUsers.set(userId, connections)

    if (connections === 1) {
        try {
            await usersModel.findByIdAndUpdate(userId, { isOnline: true })
            io.emit("user:online", { userId })
        } catch (error) {
            console.error(error)
        }
    }

    // საუბრის ოთახში შესვლა მხოლოდ მონაწილეს შეუძლია (typing-ისთვის)
    socket.on("conversation:join", async (conversationId) => {
        if (!mongoose.isValidObjectId(conversationId)) return

        try {
            const isParticipant = await conversationModel.exists({ _id: conversationId, participants: userId })
            if (isParticipant) socket.join(conversationId)
        } catch (error) {
            console.error(error)
        }
    })

    socket.on("conversation:leave", (conversationId) => {
        socket.leave(conversationId)
    })

    socket.on("typing", ({ conversationId } = {}) => {
        if (!socket.rooms.has(conversationId)) return
        socket.to(conversationId).emit("typing", { userId, conversationId })
    })

    socket.on("typing:stop", ({ conversationId } = {}) => {
        if (!socket.rooms.has(conversationId)) return
        socket.to(conversationId).emit("typing:stop", { userId, conversationId })
    })

    socket.on("disconnect", async () => {
        const remaining = (onlineUsers.get(userId) || 1) - 1
        if (remaining > 0) {
            onlineUsers.set(userId, remaining)
            return
        }

        onlineUsers.delete(userId)
        const lastSeen = new Date()
        try {
            await usersModel.findByIdAndUpdate(userId, { isOnline: false, lastSeen })
            io.emit("user:offline", { userId, lastSeen })
        } catch (error) {
            console.error(error)
        }
    })
})

server.listen(PORT, () => {
    console.log(`server running on http://localhost:${PORT}`)
})
