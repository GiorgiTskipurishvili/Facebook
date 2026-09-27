const {Router} = require("express")
const mongoose = require("mongoose")
const commentsModel = require("../models/comments.model")
const postsModel = require("../models/posts.model")
const notificationModel = require("../models/notification.model")
const { notify, removeNotification } = require("../utils/notify")
const { isValidObjectId } = mongoose

const commentsRouter = Router()

const USER_FIELDS = "FirstName LastName ProfilePicture"

// კომენტარის და მისი ყველა (ჩადგმული) პასუხის ID-ები
async function collectThreadIds(commentId){
    const ids = [commentId]
    let queue = [commentId]

    while (queue.length) {
        const replies = await commentsModel.find({ replyTo: { $in: queue } }).select("_id")
        queue = replies.map(r => r._id)
        ids.push(...queue)
    }

    return ids
}

commentsRouter.get("/post/:postId", async (req, res) => {
    const { postId } = req.params
    if (!isValidObjectId(postId)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const comments = await commentsModel
        .find({ post: postId })
        .populate("user", USER_FIELDS)
        .sort({ createdAt: 1 })

    res.json({ message: "წარმატებით წამოვიღეთ კომენტარები", data: comments })
})


commentsRouter.post("/", async (req, res) => {
    const { postId, replyTo } = req.body
    const text = req.body.text?.trim()

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

    let parentComment = null
    if (replyTo) {
        if (!isValidObjectId(replyTo)) {
            return res.status(400).json({ message: "replyTo ID არასწორია" })
        }
        parentComment = await commentsModel.findById(replyTo)
        if (!parentComment || parentComment.post.toString() !== postId) {
            return res.status(404).json({ message: "საწყისი კომენტარი ვერ მოიძებნა" })
        }
    }

    const newComment = await commentsModel.create({
        text,
        post: postId,
        user: req.userId,
        replyTo: replyTo || null
    })

    if (parentComment) {
        await notify(req, { recipient: parentComment.user, type: "comment_reply", post: post._id, comment: newComment._id })
    }
    if (!parentComment || parentComment.user.toString() !== post.user.toString()) {
        await notify(req, { recipient: post.user, type: "post_comment", post: post._id, comment: newComment._id })
    }

    const populatedComment = await newComment.populate("user", USER_FIELDS)

    res.status(201).json({ message: "კომენტარი დაემატა", data: populatedComment })
})


// წაშლა შეუძლია კომენტარის ავტორს ან პოსტის ავტორს
commentsRouter.delete("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "კომენტარის ID არასწორია" })
    }

    const comment = await commentsModel.findById(id)
    if (!comment) {
        return res.status(404).json({ message: "კომენტარი ვერ მოიძებნა" })
    }

    const post = await postsModel.findById(comment.post)
    const isCommentOwner = comment.user.toString() === req.userId
    const isPostOwner = post && post.user.toString() === req.userId
    if (!isCommentOwner && !isPostOwner) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ კომენტარის წაშლაზე" })
    }

    const ids = await collectThreadIds(comment._id)
    await commentsModel.deleteMany({ _id: { $in: ids } })
    await notificationModel.deleteMany({ comment: { $in: ids } })

    res.json({ message: "კომენტარი წარმატებით წაიშალა", deletedIds: ids })
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

    const notification = { recipient: comment.user, type: "comment_like", post: comment.post, comment: comment._id }
    if (alreadyLiked) {
        await removeNotification(req, notification)
    } else {
        await notify(req, notification)
    }

    res.json({
        message: alreadyLiked ? "ლაიქი მოიხსნა" : "კომენტარი მოიწონეთ",
        likesCount: comment.likes.length,
        liked: !alreadyLiked
    })
})


commentsRouter.put("/:id", async (req, res) => {
    const { id } = req.params
    const text = req.body.text?.trim()

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

    const populatedComment = await comment.populate("user", USER_FIELDS)

    res.json({ message: "კომენტარი წარმატებით განახლდა", data: populatedComment })
})

module.exports = commentsRouter
