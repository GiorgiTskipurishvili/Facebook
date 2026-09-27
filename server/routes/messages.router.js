const {Router} = require("express")
const mongoose = require("mongoose")
const conversationModel = require("../models/conversation.model")
const messageModel = require("../models/message.model")
const usersModel = require("../models/users.model")
const upload = require("../middleware/upload.middleware")
const getPagination = require("../utils/pagination")
const { isValidObjectId } = mongoose

const messagesRouter = Router()

const USER_FIELDS = "FirstName LastName ProfilePicture"

// აბრუნებს საუბარს, თუ მომხმარებელი მისი მონაწილეა, სხვა შემთხვევაში პასუხს თვითონ აგზავნის
async function getMyConversation(req, res){
    const { conversationId } = req.params
    if (!isValidObjectId(conversationId)) {
        res.status(400).json({ message: "საუბრის ID არასწორია" })
        return null
    }

    const conversation = await conversationModel.findById(conversationId)
    if (!conversation) {
        res.status(404).json({ message: "საუბარი ვერ მოიძებნა" })
        return null
    }
    if (!conversation.participants.some(p => p.toString() === req.userId)) {
        res.status(403).json({ message: "თქვენ არ ხართ ამ საუბრის მონაწილე" })
        return null
    }

    return conversation
}

function unreadFilter(userId, conversationIds){
    return {
        conversation: { $in: conversationIds },
        sender: { $ne: userId },
        seenBy: { $ne: userId }
    }
}

// საუბრის დაწყება ან არსებულის წამოღება ორ user-ს შორის
messagesRouter.post("/conversation/:userId", async (req, res) => {
    const { userId } = req.params
    if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }
    if (userId === req.userId) {
        return res.status(400).json({ message: "საკუთარ თავთან საუბარს ვერ დაიწყებ" })
    }

    const otherUser = await usersModel.findById(userId)
    if (!otherUser) {
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    let conversation = await conversationModel.findOne({
        participants: { $all: [req.userId, userId], $size: 2 }
    })

    if (!conversation) {
        conversation = await conversationModel.create({ participants: [req.userId, userId] })
    }

    await conversation.populate("participants", `${USER_FIELDS} isOnline lastSeen`)

    res.json({ message: "საუბარი მზადაა", data: conversation })
})

// ერთი საუბრის ინფორმაცია (მონაწილეებით) - chat-ის სათაურისთვის
messagesRouter.get("/conversation/:conversationId", async (req, res) => {
    const conversation = await getMyConversation(req, res)
    if (!conversation) return

    await conversation.populate("participants", `${USER_FIELDS} isOnline lastSeen`)
    res.json({ message: "საუბარი", data: conversation })
})

// ჩემი ყველა საუბრის სია (ბოლო შეტყობინებით, წაუკითხავების რაოდენობით)
messagesRouter.get("/conversations", async (req, res) => {
    const conversations = await conversationModel
        .find({ participants: req.userId, lastMessage: { $ne: null } })
        .populate("participants", `${USER_FIELDS} isOnline lastSeen`)
        .populate("lastMessage")
        .sort({ updatedAt: -1 })

    const conversationIds = conversations.map(c => c._id)
    const counts = await messageModel.aggregate([
        { $match: unreadFilter(new mongoose.Types.ObjectId(req.userId), conversationIds) },
        { $group: { _id: "$conversation", count: { $sum: 1 } } }
    ])
    const countMap = new Map(counts.map(c => [c._id.toString(), c.count]))

    const data = conversations.map(c => ({
        ...c.toObject(),
        unreadCount: countMap.get(c._id.toString()) || 0
    }))

    res.json({ message: "საუბრების სია", data })
})

// რამდენ საუბარში მაქვს წაუკითხავი შეტყობინება (navbar-ის badge-ისთვის)
messagesRouter.get("/unread/count", async (req, res) => {
    const conversations = await conversationModel.find({ participants: req.userId }).select("_id")
    const unread = await messageModel.distinct(
        "conversation",
        unreadFilter(req.userId, conversations.map(c => c._id))
    )

    res.json({ message: "წაუკითხავი საუბრები", count: unread.length })
})

// კონკრეტული საუბრის შეტყობინებები: ?page=1 უახლესი, ?page=2 უფრო ძველი...
messagesRouter.get("/:conversationId", async (req, res) => {
    const conversation = await getMyConversation(req, res)
    if (!conversation) return

    const { page, limit, skip } = getPagination(req.query, 30)

    const [messages, total] = await Promise.all([
        messageModel
            .find({ conversation: conversation._id })
            .populate("sender", USER_FIELDS)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        messageModel.countDocuments({ conversation: conversation._id })
    ])

    res.json({
        message: "შეტყობინებები",
        data: messages.reverse(),
        page,
        hasMore: skip + messages.length < total
    })
})

// შეტყობინების გაგზავნა (ტექსტი და/ან ფოტო)
messagesRouter.post("/:conversationId", upload.single("image"), async (req, res) => {
    const text = req.body.text?.trim()

    if (!text && !req.file) {
        return res.status(400).json({ message: "შეტყობინებას სჭირდება ტექსტი ან ფოტო მაინც" })
    }

    const conversation = await getMyConversation(req, res)
    if (!conversation) return

    const newMessage = await messageModel.create({
        conversation: conversation._id,
        sender: req.userId,
        text: text || "",
        image: req.file ? `/uploads/${req.file.filename}` : "",
        seenBy: [req.userId]
    })

    conversation.lastMessage = newMessage._id
    await conversation.save()

    const populatedMessage = await newMessage.populate("sender", USER_FIELDS)

    // რეალურ დროში მიწოდება ყველა მონაწილისთვის (client-მა _id-ით უნდა გაფილტროს დუბლიკატი)
    const io = req.app.get("io")
    conversation.participants.forEach(p => {
        io.to(`user:${p}`).emit("message:new", populatedMessage)
    })

    res.status(201).json({ message: "შეტყობინება გაიგზავნა", data: populatedMessage })
})

// საუბრის ყველა შეტყობინების "ნანახად" მონიშვნა
messagesRouter.put("/:conversationId/seen", async (req, res) => {
    const conversation = await getMyConversation(req, res)
    if (!conversation) return

    const result = await messageModel.updateMany(
        unreadFilter(req.userId, [conversation._id]),
        { $addToSet: { seenBy: req.userId } }
    )

    if (result.modifiedCount > 0) {
        const io = req.app.get("io")
        conversation.participants.forEach(p => {
            io.to(`user:${p}`).emit("message:seen", { conversationId: conversation._id, userId: req.userId })
        })
    }

    res.json({ message: "შეტყობინებები ნანახად მოინიშნა", updated: result.modifiedCount })
})

module.exports = messagesRouter
