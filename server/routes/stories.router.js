const {Router} = require("express")
const mongoose = require("mongoose")
const storyModel = require("../models/story.model")
const usersModel = require("../models/users.model")
const upload = require("../middleware/upload.middleware")
const { isValidObjectId } = mongoose

const storiesRouter = Router()

storiesRouter.post("/", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "სთორისთვის სურათი აუცილებელია" })
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // +24 საათი

    const newStory = await storyModel.create({
        user: req.userId,
        image: `/uploads/${req.file.filename}`,
        expiresAt
    })

    res.json({ message: "სთორი წარმატებით აიტვირთა", data: newStory })
})

storiesRouter.get("/feed", async (req, res) => {
    const currentUser = await usersModel.findById(req.userId)

    const stories = await storyModel
        .find({ user: { $in: [...currentUser.friends, req.userId] } })
        .populate("user", "FirstName LastName ProfilePicture")
        .sort({ createdAt: -1 })

    res.json({ message: "აქტიური სთორები", data: stories })
})


storiesRouter.get("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "სთორის ID არასწორია" })
    }

    const story = await storyModel.findById(id).populate("user", "FirstName LastName ProfilePicture")
    if (!story) {
        return res.status(404).json({ message: "სთორი ვერ მოიძებნა ან ვადა გაუვიდა" })
    }

    const alreadyViewed = story.views.some(v => v.user.toString() === req.userId)
    if (story.user._id.toString() !== req.userId && !alreadyViewed) {
        story.views.push({ user: req.userId })
        await story.save()
    }

    res.json({ message: "სთორი წარმატებით წამოღებულია", data: story })
})


storiesRouter.get("/:id/views", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "სთორის ID არასწორია" })
    }

    const story = await storyModel.findById(id).populate("views.user", "FirstName LastName ProfilePicture")
    if (!story) {
        return res.status(404).json({ message: "სთორი ვერ მოიძებნა" })
    }
    if (story.user.toString() !== req.userId) {
        return res.status(403).json({ message: "მხოლოდ ავტორს შეუძლია ნახოს ვინ უყურა სთორს" })
    }

    res.json({
        message: "ნახვების სია",
        viewsCount: story.views.length,
        data: story.views
    })
})


storiesRouter.delete("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "სთორის ID არასწორია" })
    }

    const story = await storyModel.findById(id)
    if (!story) {
        return res.status(404).json({ message: "სთორი ვერ მოიძებნა" })
    }
    if (story.user.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ სთორის წაშლაზე" })
    }

    await storyModel.findByIdAndDelete(id)
    res.json({ message: "სთორი წაიშალა" })
})

module.exports = storiesRouter