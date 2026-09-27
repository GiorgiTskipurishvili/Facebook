const {Router} = require("express") 
const postsModel = require("../models/posts.model")
const usersModel = require("../models/users.model")
const upload = require("../middleware/upload.middleware")
const postsRouter = Router()
const mongoose = require("mongoose")
const { isValidObjectId } = mongoose


postsRouter.get("/", async (req,res)=>{
    const findAllPosts = await postsModel.find()
    
    res.json({message:"წარმატებით წამოვიღეთ პოსტები", data: findAllPosts})
})

postsRouter.get("/:id", async(req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({ message: "პოსტის ID არასწორია" })
    }

    const findPost = await postsModel.findById(id).populate("user", "FirstName LastName ProfilePicture")

    if(!findPost){
        return res.status(404).json({ message: "პოსტი ვერ მოიძებნა" })
    }

    res.json({ message: "წარმატებით წამოვიღეთ პოსტი", data: findPost })
})

postsRouter.post("/", upload.single("image"), async (req, res) => {
    const { desc } = req.body

    if (!desc && !req.file) {
        return res.status(400).json({ message: "პოსტს სჭირდება ტექსტი ან ფოტო მაინც" })
    }

    const newPost = await postsModel.create({
        desc: desc || "",
        image: req.file ? `/uploads/${req.file.filename}` : "",
        user: req.userId
    })

    await usersModel.findByIdAndUpdate(req.userId, { $push: { Posts: newPost._id } })

    res.json({ message: "პოსტი წარმატებით გამოქვეყნდა", data: newPost })
})

postsRouter.put("/:id", upload.single("image"), async (req, res) => {
    const { id } = req.params
    const { desc } = req.body

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

    if (desc !== undefined) post.desc = desc
    if (req.file) post.image = `/uploads/${req.file.filename}`
    await post.save()

    res.json({ message: "პოსტი წარმატებით განახლდა", data: post })
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
    await usersModel.findByIdAndUpdate(post.user, { $pull: { Posts: id } })

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

    res.json({
        message: alreadyLiked ? "ლაიქი მოიხსნა" : "პოსტი მოიწონეთ",
        likesCount: post.likes.length,
        liked: !alreadyLiked
    })
})

module.exports = postsRouter    