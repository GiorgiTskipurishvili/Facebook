const {Router} = require("express")
const postsModel = require("../models/posts.model")
const usersModel = require("../models/users.model")
const commentsModel = require("../models/comments.model")
const notificationModel = require("../models/notification.model")
const upload = require("../middleware/upload.middleware")
const { notify, removeNotification } = require("../utils/notify")
const { removeUpload } = require("../utils/files")
const getPagination = require("../utils/pagination")
const postsRouter = Router()
const mongoose = require("mongoose")
const { isValidObjectId } = mongoose

const USER_FIELDS = "FirstName LastName ProfilePicture"

// პოსტებს ამატებს commentsCount, likesCount და likedByMe ველებს
async function withStats(posts, userId){
    const postIds = posts.map(p => p._id)
    const counts = await commentsModel.aggregate([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: "$post", count: { $sum: 1 } } }
    ])
    const countMap = new Map(counts.map(c => [c._id.toString(), c.count]))

    return posts.map(p => {
        const post = p.toObject()
        post.commentsCount = countMap.get(p._id.toString()) || 0
        post.likesCount = p.likes.length
        post.likedByMe = p.likes.some(id => id.toString() === userId)
        return post
    })
}

async function sendPostsPage(req, res, filter, message){
    const { page, limit, skip } = getPagination(req.query)

    const [posts, total] = await Promise.all([
        postsModel.find(filter)
            .populate("user", USER_FIELDS)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        postsModel.countDocuments(filter)
    ])

    res.json({
        message,
        data: await withStats(posts, req.userId),
        page,
        hasMore: skip + posts.length < total
    })
}

// მთავარი feed: ჩემი, მეგობრების და იმ ხალხის პოსტები ვისაც ვაფოლოვებ
postsRouter.get("/", async (req,res)=>{
    const currentUser = await usersModel.findById(req.userId)
    if(!currentUser){
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    const authors = [req.userId, ...currentUser.friends, ...currentUser.following]
    await sendPostsPage(req, res, { user: { $in: authors } }, "წარმატებით წამოვიღეთ პოსტები")
})

// კონკრეტული მომხმარებლის პოსტები (პროფილის გვერდისთვის)
postsRouter.get("/user/:userId", async (req,res)=>{
    const {userId} = req.params
    if(!isValidObjectId(userId)){
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    await sendPostsPage(req, res, { user: userId }, "მომხმარებლის პოსტები")
})

postsRouter.get("/:id", async(req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const findPost = await postsModel.findById(id).populate("user", USER_FIELDS)

    if(!findPost){
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    const [post] = await withStats([findPost], req.userId)
    res.json({ message: "წარმატებით წამოვიღეთ პოსტი", data: post })
})

// ვინ მოიწონა პოსტი
postsRouter.get("/:id/likes", async(req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const post = await postsModel.findById(id).populate("likes", USER_FIELDS)
    if(!post){
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    res.json({ message: "მოწონებების სია", data: post.likes })
})

postsRouter.post("/", upload.single("image"), async (req, res) => {
    const desc = req.body.desc?.trim()

    if (!desc && !req.file) {
        return res.status(400).json({ message: "პოსტს სჭირდება ტექსტი ან ფოტო მაინც" })
    }

    const newPost = await postsModel.create({
        desc: desc || "",
        image: req.file ? `/uploads/${req.file.filename}` : "",
        user: req.userId
    })

    await usersModel.findByIdAndUpdate(req.userId, { $push: { Posts: newPost._id } })

    const populatedPost = await newPost.populate("user", USER_FIELDS)
    const [post] = await withStats([populatedPost], req.userId)

    res.status(201).json({ message: "პოსტი წარმატებით გამოქვეყნდა", data: post })
})

// რედაქტირება: desc, ახალი ფოტო, ან removeImage=true ფოტოს მოსაშორებლად
postsRouter.put("/:id", upload.single("image"), async (req, res) => {
    const { id } = req.params
    const { desc, removeImage } = req.body

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const post = await postsModel.findById(id)
    if (!post) {
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }
    if (post.user.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ პოსტის რედაქტირებაზე" })
    }

    if (desc !== undefined) post.desc = desc.trim()
    if (req.file) {
        removeUpload(post.image)
        post.image = `/uploads/${req.file.filename}`
    } else if (removeImage === "true" || removeImage === true) {
        removeUpload(post.image)
        post.image = ""
    }

    if (!post.desc && !post.image) {
        return res.status(400).json({ message: "პოსტს სჭირდება ტექსტი ან ფოტო მაინც" })
    }

    await post.save()

    const populatedPost = await post.populate("user", USER_FIELDS)
    const [result] = await withStats([populatedPost], req.userId)

    res.json({ message: "პოსტი წარმატებით განახლდა", data: result })
})

postsRouter.delete("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const post = await postsModel.findById(id)
    if (!post) {
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }
    if (post.user.toString() !== req.userId) {
        return res.status(403).json({ message: "არ გაქვს უფლება ამ პოსტის წაშლაზე" })
    }

    await postsModel.findByIdAndDelete(id)
    await Promise.all([
        usersModel.findByIdAndUpdate(post.user, { $pull: { Posts: id } }),
        commentsModel.deleteMany({ post: id }),
        notificationModel.deleteMany({ post: id })
    ])
    removeUpload(post.image)

    res.json({ message: "პოსტი წარმატებით წაიშალა" })
})

postsRouter.put("/:id/like", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const post = await postsModel.findById(id)
    if (!post) {
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    const alreadyLiked = post.likes.some(userId => userId.toString() === req.userId)

    if (alreadyLiked) {
        post.likes = post.likes.filter(userId => userId.toString() !== req.userId)
    } else {
        post.likes.push(req.userId)
    }

    await post.save()

    const notification = { recipient: post.user, type: "post_like", post: post._id }
    if (alreadyLiked) {
        await removeNotification(req, notification)
    } else {
        await notify(req, notification)
    }

    res.json({
        message: alreadyLiked ? "ლაიქი მოიხსნა" : "პოსტი მოიწონეთ",
        likesCount: post.likes.length,
        liked: !alreadyLiked
    })
})

module.exports = postsRouter
