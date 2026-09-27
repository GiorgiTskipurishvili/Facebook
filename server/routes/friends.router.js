const {Router} = require("express")
const mongoose = require("mongoose")
const usersModel = require("../models/users.model")
const friendRequestModel = require("../models/friendRequest.model")
const notificationModel = require("../models/notification.model")
const { notify, removeNotification } = require("../utils/notify")
const { isValidObjectId } = mongoose

const friendsRouter = Router()

const USER_FIELDS = "FirstName LastName ProfilePicture"


friendsRouter.post("/request/:id", async (req, res) => {
    const { id } = req.params

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }
    if (id === req.userId) {
        return res.status(400).json({ message: "საკუთარი თავისთვის მოთხოვნას ვერ გაუგზავნი" })
    }

    const receiver = await usersModel.findById(id)
    if (!receiver) {
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    if (receiver.friends.includes(req.userId)) {
        return res.status(400).json({ message: "თქვენ უკვე მეგობრები ხართ" })
    }

    const existingRequest = await friendRequestModel.findOne({
        $or: [
            { sender: req.userId, receiver: id },
            { sender: id, receiver: req.userId }
        ],
        status: "pending"
    })
    if (existingRequest) {
        const message = existingRequest.sender.toString() === req.userId
            ? "მოთხოვნა უკვე გაგზავნილია"
            : "ამ მომხმარებელმა უკვე გამოგიგზავნა მოთხოვნა"
        return res.status(400).json({ message, data: existingRequest })
    }

    const newRequest = await friendRequestModel.create({ sender: req.userId, receiver: id })

    await notify(req, { recipient: id, type: "friend_request" })

    res.status(201).json({ message: "მეგობრობის მოთხოვნა გაიგზავნა", data: newRequest })
})

// გაგზავნილი მოთხოვნის გაუქმება (მხოლოდ გამგზავნს შეუძლია)
friendsRouter.delete("/request/:requestId", async (req, res) => {
    const { requestId } = req.params
    if (!isValidObjectId(requestId)) {
        return res.status(400).json({ message: "მოთხოვნის ID არასწორია" })
    }

    const request = await friendRequestModel.findById(requestId)
    if (!request || request.status !== "pending") {
        return res.status(404).json({ message: "მოთხოვნა ვერ მოიძებნა" })
    }
    if (request.sender.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ მოთხოვნის გაუქმებაზე" })
    }

    await friendRequestModel.findByIdAndDelete(requestId)
    await removeNotification(req, { recipient: request.receiver, type: "friend_request" })

    res.json({ message: "მოთხოვნა გაუქმდა" })
})


friendsRouter.get("/requests", async (req, res) => {
    const requests = await friendRequestModel
        .find({ receiver: req.userId, status: "pending" })
        .populate("sender", USER_FIELDS)
        .sort({ createdAt: -1 })

    res.json({ message: "მიღებული მოთხოვნები", data: requests })
})


friendsRouter.get("/requests/sent", async (req, res) => {
    const requests = await friendRequestModel
        .find({ sender: req.userId, status: "pending" })
        .populate("receiver", USER_FIELDS)
        .sort({ createdAt: -1 })

    res.json({ message: "გაგზავნილი მოთხოვნები", data: requests })
})


friendsRouter.put("/accept/:requestId", async (req, res) => {
    const { requestId } = req.params
    if (!isValidObjectId(requestId)) {
        return res.status(400).json({ message: "მოთხოვნის ID არასწორია" })
    }

    const request = await friendRequestModel.findById(requestId)
    if (!request || request.status !== "pending") {
        return res.status(404).json({ message: "მოთხოვნა ვერ მოიძებნა" })
    }
    if (request.receiver.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ მოთხოვნის დათანხმებაზე" })
    }

    request.status = "accepted"
    await request.save()

    await usersModel.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } })
    await usersModel.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } })

    await notificationModel.deleteMany({ sender: request.sender, recipient: request.receiver, type: "friend_request" })
    await notify(req, { recipient: request.sender, type: "friend_accept" })

    res.json({ message: "მეგობრობის მოთხოვნა მიღებულია" })
})


friendsRouter.put("/reject/:requestId", async (req, res) => {
    const { requestId } = req.params
    if (!isValidObjectId(requestId)) {
        return res.status(400).json({ message: "მოთხოვნის ID არასწორია" })
    }

    const request = await friendRequestModel.findById(requestId)
    if (!request || request.status !== "pending") {
        return res.status(404).json({ message: "მოთხოვნა ვერ მოიძებნა" })
    }
    if (request.receiver.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ მოთხოვნის უარყოფაზე" })
    }

    request.status = "rejected"
    await request.save()

    await notificationModel.deleteMany({ sender: request.sender, recipient: request.receiver, type: "friend_request" })

    res.json({ message: "მეგობრობის მოთხოვნა უარყოფილია" })
})

// "შეიძლება იცნობდე" - ჯერ ისინი, ვისთანაც ყველაზე მეტი საერთო მეგობარი გვაქვს
friendsRouter.get("/suggestions", async (req, res) => {
    const currentUser = await usersModel.findById(req.userId)
    const myFriends = currentUser.friends.map(id => id.toString())

    const pendingRequests = await friendRequestModel.find({
        $or: [{ sender: req.userId }, { receiver: req.userId }],
        status: "pending"
    })
    const pendingIds = pendingRequests.map(r =>
        r.sender.toString() === req.userId ? r.receiver : r.sender
    )

    const candidates = await usersModel
        .find({ _id: { $nin: [req.userId, ...currentUser.friends, ...pendingIds] } })
        .select(`${USER_FIELDS} friends`)
        .limit(100)

    const suggestions = candidates
        .map(user => ({
            _id: user._id,
            FirstName: user.FirstName,
            LastName: user.LastName,
            ProfilePicture: user.ProfilePicture,
            mutualFriends: user.friends.filter(id => myFriends.includes(id.toString())).length
        }))
        .sort((a, b) => b.mutualFriends - a.mutualFriends)
        .slice(0, 10)

    res.json({ message: "შეთავაზებული მეგობრები", data: suggestions })
})


friendsRouter.delete("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    await usersModel.findByIdAndUpdate(req.userId, { $pull: { friends: id } })
    await usersModel.findByIdAndUpdate(id, { $pull: { friends: req.userId } })

    res.json({ message: "მეგობარი წაშლილია" })
})


friendsRouter.get("/", async (req, res) => {
    const user = await usersModel.findById(req.userId).populate("friends", `${USER_FIELDS} isOnline lastSeen`)

    res.json({ message: "მეგობრების სია", data: user.friends })
})

// სხვა მომხმარებლის მეგობრები (პროფილის გვერდისთვის)
friendsRouter.get("/user/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    const user = await usersModel.findById(id).populate("friends", USER_FIELDS)
    if (!user) {
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    res.json({ message: "მეგობრების სია", data: user.friends })
})


friendsRouter.put("/follow/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }
    if (id === req.userId) {
        return res.status(400).json({ message: "საკუთარ თავს ვერ დაფოლოვ" })
    }

    const targetUser = await usersModel.findById(id)
    if (!targetUser) {
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    const alreadyFollowing = targetUser.followers.includes(req.userId)

    if (alreadyFollowing) {
        await usersModel.findByIdAndUpdate(id, { $pull: { followers: req.userId } })
        await usersModel.findByIdAndUpdate(req.userId, { $pull: { following: id } })
        await removeNotification(req, { recipient: id, type: "follow" })
    } else {
        await usersModel.findByIdAndUpdate(id, { $addToSet: { followers: req.userId } })
        await usersModel.findByIdAndUpdate(req.userId, { $addToSet: { following: id } })
        await notify(req, { recipient: id, type: "follow" })
    }

    res.json({ message: alreadyFollowing ? "ანფოლოვდა" : "დაფოლოვდა", following: !alreadyFollowing })
})


friendsRouter.get("/followers/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    const user = await usersModel.findById(id).populate("followers", USER_FIELDS)
    if (!user) {
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    res.json({ message: "Followers-ის სია", data: user.followers })
})


friendsRouter.get("/following/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    const user = await usersModel.findById(id).populate("following", USER_FIELDS)
    if (!user) {
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    res.json({ message: "Following-ის სია", data: user.following })
})

module.exports = friendsRouter
