const {Router} = require("express")
const mongoose = require("mongoose")
const commentsModel = require("../models/comments.model")
const postsModel = require("../models/posts.model")
const { isValidObjectId } = mongoose

const commentsRouter = Router()

commentsRouter.get("/post/:postId", async (req, res) => {
    const { postId } = req.params
    if (!isValidObjectId(postId)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const comments = await commentsModel
        .find({ post: postId })
        .populate("user", "FirstName LastName ProfilePicture")
        .sort({ createdAt: 1 })

    res.json({ message: "წარმატებით წამოვიღეთ კომენტარები", data: comments })
})


commentsRouter.post("/", async (req, res) => {
    const { text, postId, replyTo } = req.body

    if (!text || !postId) {
        return res.status(400).json({ message: "საჭიროა ტექსტი და პოსტის ID" })
    }
    if (!isValidObjectId(postId)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const post = await postsModel.findById(postId)
    if (!post) {
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    if (replyTo) {
        if (!isValidObjectId(replyTo)) {
            return res.status(400).json({ message: "replyTo ID არასწორია" })
        }
        const parentComment = await commentsModel.findById(replyTo)
        if (!parentComment) {
            return res.status(404).json({ message: "საწყისი კომენტარი ვერ მოიძებნა" })
        }
    }

    const newComment = await commentsModel.create({
        text,
        post: postId,
        user: req.userId,
        replyTo: replyTo || null
    })

    const populatedComment = await newComment.populate("user", "FirstName LastName ProfilePicture")

    res.json({ message: "კომენტარი დაემატა", data: populatedComment })
})


commentsRouter.delete("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "კომენტარის ID არასწორია" })
    }

    const comment = await commentsModel.findById(id)
    if (!comment) {
        return res.status(404).json({ message: "კომენტარი ვერ მოიძებნა" })
    }
    if (comment.user.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ კომენტარის წაშლაზე" })
    }

    await commentsModel.deleteMany({ replyTo: id })
    await commentsModel.findByIdAndDelete(id)

    res.json({ message: "კომენტარი წარმატებით წაიშალა" })
})


commentsRouter.put("/:id/like", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "კომენტარის ID არასწორია" })
    }

    const comment = await commentsModel.findById(id)
    if (!comment) {
        return res.status(404).json({ message: "კომენტარი ვერ მოიძებნა" })
    }

    const alreadyLiked = comment.likes.some(userId => userId.toString() === req.userId)

    if (alreadyLiked) {
        comment.likes = comment.likes.filter(userId => userId.toString() !== req.userId)
    } else {
        comment.likes.push(req.userId)
    }

    await comment.save()

    res.json({
        message: alreadyLiked ? "ლაიქი მოიხსნა" : "კომენტარი მოიწონეთ",
        likesCount: comment.likes.length,
        liked: !alreadyLiked
    })
})


commentsRouter.put("/:id", async (req, res) => {
    const { id } = req.params
    const { text } = req.body

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "კომენტარის ID არასწორია" })
    }
    if (!text) {
        return res.status(400).json({ message: "ტექსტი აუცილებელია" })
    }

    const comment = await commentsModel.findById(id)
    if (!comment) {
        return res.status(404).json({ message: "კომენტარი ვერ მოიძებნა" })
    }
    if (comment.user.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ კომენტარის რედაქტირებაზე" })
    }

    comment.text = text
    await comment.save()

    const populatedComment = await comment.populate("user", "FirstName LastName ProfilePicture")

    res.json({ message: "კომენტარი წარმატებით განახლდა", data: populatedComment })
})

module.exports = commentsRouter