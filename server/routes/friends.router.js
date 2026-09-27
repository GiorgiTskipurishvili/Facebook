const {Router} = require("express")
const mongoose = require("mongoose")
const usersModel = require("../models/users.model")
const friendRequestModel = require("../models/friendRequest.model")
const { isValidObjectId } = mongoose

const friendsRouter = Router()


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
        return res.status(400).json({ message: "მოთხოვნა უკვე გაგზავნილია" })
    }

    const newRequest = await friendRequestModel.create({ sender: req.userId, receiver: id })

    res.json({ message: "მეგობრობის მოთხოვნა გაიგზავნა", data: newRequest })
})


friendsRouter.get("/requests", async (req, res) => {
    const requests = await friendRequestModel
        .find({ receiver: req.userId, status: "pending" })
        .populate("sender", "FirstName LastName ProfilePicture")

    res.json({ message: "მიღებული მოთხოვნები", data: requests })
})


friendsRouter.put("/accept/:requestId", async (req, res) => {
    const { requestId } = req.params
    if (!isValidObjectId(requestId)) {
        return res.status(400).json({ message: "მოთხოვნის ID არასწორია" })
    }

    const request = await friendRequestModel.findById(requestId)
    if (!request) {
        return res.status(404).json({ message: "მოთხოვნა ვერ მოიძებნა" })
    }
    if (request.receiver.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ მოთხოვნის დათანხმებაზე" })
    }

    request.status = "accepted"
    await request.save()

    
    await usersModel.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } })
    await usersModel.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } })

    res.json({ message: "მეგობრობის მოთხოვნა მიღებულია" })
})


friendsRouter.put("/reject/:requestId", async (req, res) => {
    const { requestId } = req.params
    if (!isValidObjectId(requestId)) {
        return res.status(400).json({ message: "მოთხოვნის ID არასწორია" })
    }

    const request = await friendRequestModel.findById(requestId)
    if (!request) {
        return res.status(404).json({ message: "მოთხოვნა ვერ მოიძებნა" })
    }
    if (request.receiver.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ მოთხოვნის უარყოფაზე" })
    }

    request.status = "rejected"
    await request.save()

    res.json({ message: "მეგობრობის მოთხოვნა უარყოფილია" })
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
    const user = await usersModel.findById(req.userId).populate("friends", "FirstName LastName ProfilePicture")

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
    } else {
        await usersModel.findByIdAndUpdate(id, { $addToSet: { followers: req.userId } })
        await usersModel.findByIdAndUpdate(req.userId, { $addToSet: { following: id } })
    }

    res.json({ message: alreadyFollowing ? "ანფოლოვდა" : "დაფოლოვდა", following: !alreadyFollowing })
})


friendsRouter.get("/followers/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    const user = await usersModel.findById(id).populate("followers", "FirstName LastName ProfilePicture")
    res.json({ message: "Followers-ის სია", data: user.followers })
})


friendsRouter.get("/following/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    const user = await usersModel.findById(id).populate("following", "FirstName LastName ProfilePicture")
    res.json({ message: "Following-ის სია", data: user.following })
})

module.exports = friendsRouter