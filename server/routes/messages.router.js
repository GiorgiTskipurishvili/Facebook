const {Router} = require("express")
const mongoose = require("mongoose")
const conversationModel = require("../models/conversation.model")
const messageModel = require("../models/message.model")
const upload = require("../middleware/upload.middleware")
const { isValidObjectId } = mongoose

const messagesRouter = Router()

// საუბრის დაწყება ან არსებულის წამოღება ორ user-ს შორის
messagesRouter.post("/conversation/:userId", async (req, res) => {
    const { userId } = req.params
    if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    let conversation = await conversationModel.findOne({
        participants: { $all: [req.userId, userId], $size: 2 }
    })

    if (!conversation) {
        conversation = await conversationModel.create({ participants: [req.userId, userId] })
    }

    res.json({ message: "საუბარი მზადაა", data: conversation })
})

// ჩემი ყველა საუბრის სია (ბოლო შეტყობინებით, სორტირებული)
messagesRouter.get("/conversations", async (req, res) => {
    const conversations = await conversationModel
        .find({ participants: req.userId })
        .populate("participants", "FirstName LastName ProfilePicture isOnline lastSeen")
        .populate("lastMessage")
        .sort({ updatedAt: -1 })

    res.json({ message: "საუბრების სია", data: conversations })
})

// კონკრეტული საუბრის შეტყობინებები
messagesRouter.get("/:conversationId", async (req, res) => {
    const { conversationId } = req.params
    if (!isValidObjectId(conversationId)) {
        return res.status(400).json({ message: "საუბრის ID არასწორია" })
    }

    const messages = await messageModel
        .find({ conversation: conversationId })
        .populate("sender", "FirstName LastName ProfilePicture")
        .sort({ createdAt: 1 })

    res.json({ message: "შეტყობინებები", data: messages })
})

// შეტყობინების გაგზავნა (ტექსტი და/ან ფოტო)
messagesRouter.post("/:conversationId", upload.single("image"), async (req, res) => {
    const { conversationId } = req.params
    const { text } = req.body

    if (!isValidObjectId(conversationId)) {
        return res.status(400).json({ message: "საუბრის ID არასწორია" })
    }
    if (!text && !req.file) {
        return res.status(400).json({ message: "შეტყობინებას სჭირდება ტექსტი ან ფოტო მაინც" })
    }

    const conversation = await conversationModel.findById(conversationId)
    if (!conversation) {
        return res.status(404).json({ message: "საუბარი ვერ მოიძებნა" })
    }
    if (!conversation.participants.map(p => p.toString()).includes(req.userId)) {
        return res.status(403).json({ message: "თქვენ არ ხართ ამ საუბრის მონაწილე" })
    }

    const newMessage = await messageModel.create({
        conversation: conversationId,
        sender: req.userId,
        text: text || "",
        image: req.file ? `/uploads/${req.file.filename}` : "",
        seenBy: [req.userId]
    })

    conversation.lastMessage = newMessage._id
    await conversation.save()

    const populatedMessage = await newMessage.populate("sender", "FirstName LastName ProfilePicture")

    // რეალურ დროში მიწოდება საუბრის ოთახში მყოფებისთვის
    const io = req.app.get("io")
    io.to(conversationId).emit("message:new", populatedMessage)

    res.json({ message: "შეტყობინება გაიგზავნა", data: populatedMessage })
})

module.exports = messagesRouter