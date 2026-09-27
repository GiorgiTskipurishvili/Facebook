const {Router} = require("express")
const postsModel = require("../models/posts.model")
const usersModel = require("../models/users.model")
const commentsModel = require("../models/comments.model")
const notificationModel = require("../models/notification.model")
const upload = require("../middleware/upload.middleware")
const { notify, removeNotification } = require("../utils/notify")
const { removeUploadIfUnused } = require("../utils/files")
const getPagination = require("../utils/pagination")
const postsRouter = Router()
const mongoose = require("mongoose")
const { isValidObjectId } = mongoose

const USER_FIELDS = "FirstName LastName ProfilePicture"

// ავტორი + გაზიარებული პოსტი თავისი ავტორით
function populatePost(query){
    return query
        .populate("user", USER_FIELDS)
        .populate({ path: "sharedPost", populate: { path: "user", select: USER_FIELDS } })
}

async function countBy(model, field, ids){
    const counts = await model.aggregate([
        { $match: { [field]: { $in: ids } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } }
    ])
    return new Map(counts.map(c => [c._id.toString(), c.count]))
}

// პოსტებს ამატებს commentsCount, sharesCount, likesCount და likedByMe ველებს
async function withStats(posts, userId){
    const postIds = posts.map(p => p._id)
    const [comments, shares] = await Promise.all([
        countBy(commentsModel, "post", postIds),
        countBy(postsModel, "sharedPost", postIds)
    ])

    return posts.map(p => {
        const post = p.toObject()
        post.commentsCount = comments.get(p._id.toString()) || 0
        post.sharesCount = shares.get(p._id.toString()) || 0
        post.likesCount = p.likes.length
        post.likedByMe = p.likes.some(id => id.toString() === userId)
        return post
    })
}

async function sendPostsPage(req, res, filter, message){
    const { page, limit, skip } = getPagination(req.query)

    const [posts, total] = await Promise.all([
        populatePost(postsModel.find(filter))
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

async function sendOnePost(res, post, userId, message, status = 200){
    const populated = await populatePost(postsModel.findById(post._id))
    const [result] = await withStats([populated], userId)
    res.status(status).json({ message, data: result })
}

// ფოტო = პოსტი სურათით (გაზიარებების გარეშე)
// ($nin null - ძველ პოსტებს image ველი შეიძლება საერთოდ არ ჰქონდეთ)
const PHOTO_FILTER = { image: { $nin: ["", null] }, sharedPost: null }

// მთავარი feed: ჩემი, მეგობრების და იმ ხალხის პოსტები ვისაც ვაფოლოვებ
postsRouter.get("/", async (req,res)=>{
    const currentUser = await usersModel.findById(req.userId)
    if(!currentUser){
        return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" })
    }

    const authors = [req.userId, ...currentUser.friends, ...currentUser.following]
    await sendPostsPage(req, res, { user: { $in: authors } }, "წარმატებით წამოვიღეთ პოსტები")
})

// ყველა მომხმარებლის ფოტოები (ფოტოების სექცია)
postsRouter.get("/photos", async (req,res)=>{
    await sendPostsPage(req, res, PHOTO_FILTER, "ფოტოები")
})

// კონკრეტული მომხმარებლის ფოტოები (პროფილის "ფოტოები" tab)
postsRouter.get("/photos/user/:userId", async (req,res)=>{
    const {userId} = req.params
    if(!isValidObjectId(userId)){
        return res.status(400).json({ message: "მომხმარებლის ID არასწორია" })
    }

    await sendPostsPage(req, res, { ...PHOTO_FILTER, user: userId }, "მომხმარებლის ფოტოები")
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

    const post = await postsModel.findById(id)
    if(!post){
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    await sendOnePost(res, post, req.userId, "წარმატებით წამოვიღეთ პოსტი")
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

// ვინ გააზიარა პოსტი
postsRouter.get("/:id/shares", async(req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const shares = await postsModel.find({ sharedPost: id }).populate("user", USER_FIELDS).sort({ createdAt: -1 })

    // ერთი ადამიანი შეიძლება რამდენჯერმე აზიარებდეს - სიაში ერთხელ
    const users = new Map()
    shares.forEach(s => s.user && users.set(s.user._id.toString(), s.user))

    res.json({ message: "გაზიარებების სია", data: [...users.values()] })
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

    await sendOnePost(res, newPost, req.userId, "პოსტი წარმატებით გამოქვეყნდა", 201)
})

// გაზიარება: ახალი პოსტი, რომელიც ორიგინალზე მიუთითებს (desc - არასავალდებულო კომენტარი)
postsRouter.post("/:id/share", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const post = await postsModel.findById(id)
    if (!post) {
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    // გაზიარების გაზიარება -> ყოველთვის ორიგინალს ვაზიარებთ
    const original = post.sharedPost ? await postsModel.findById(post.sharedPost) : post
    if (!original) {
        return res.status(404).json({ message: "ორიგინალი პოსტი აღარ არსებობს" })
    }

    const sharePost = await postsModel.create({
        desc: req.body.desc?.trim() || "",
        user: req.userId,
        type: "share",
        sharedPost: original._id
    })

    await usersModel.findByIdAndUpdate(req.userId, { $push: { Posts: sharePost._id } })
    await notify(req, { recipient: original.user, type: "post_share", post: original._id })

    const sharesCount = await postsModel.countDocuments({ sharedPost: original._id })

    const populated = await populatePost(postsModel.findById(sharePost._id))
    const [result] = await withStats([populated], req.userId)
    res.status(201).json({ message: "პოსტი გაზიარდა", data: result, originalId: original._id, sharesCount })
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

    const isShare = post.type === "share"
    if (isShare && req.file) {
        return res.status(400).json({ message: "გაზიარებულ პოსტს ფოტოს ვერ დაამატებ" })
    }

    const oldImage = post.image
    if (desc !== undefined) post.desc = desc.trim()
    if (req.file) {
        post.image = `/uploads/${req.file.filename}`
    } else if (removeImage === "true" || removeImage === true) {
        post.image = ""
    }

    if (!isShare && !post.desc && !post.image) {
        return res.status(400).json({ message: "პოსტს სჭირდება ტექსტი ან ფოტო მაინც" })
    }

    await post.save()
    if (oldImage !== post.image) await removeUploadIfUnused(oldImage)

    await sendOnePost(res, post, req.userId, "პოსტი წარმატებით განახლდა")
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
    // ფოტო შეიძლება ახლაც პროფილის სურათი იყოს - მაშინ ფაილი რჩება
    await removeUploadIfUnused(post.image)

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
