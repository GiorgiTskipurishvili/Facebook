const {Router} = require("express")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const usersModel = require("../models/users.model")
const postsModel = require("../models/posts.model")
const commentsModel = require("../models/comments.model")
const storyModel = require("../models/story.model")
const friendRequestModel = require("../models/friendRequest.model")
const notificationModel = require("../models/notification.model")
const conversationModel = require("../models/conversation.model")
const messageModel = require("../models/message.model")
const upload = require("../middleware/upload.middleware")
const { removeUpload } = require("../utils/files")
const getPagination = require("../utils/pagination")
const { isValidObjectId } = mongoose

const usersRouter = Router()

const PUBLIC_FIELDS = "FirstName LastName ProfilePicture"

function escapeRegex(text){
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

usersRouter.get("/", async (req,res)=>{
    const { limit, skip } = getPagination(req.query, 20)

    const users = await usersModel
        .find({ _id: { $ne: req.userId } })
        .select(`${PUBLIC_FIELDS} isOnline`)
        .skip(skip)
        .limit(limit)

    res.json({message:"მომხმარებლების სია", data:users})
})

// ძებნა სახელით/გვარით: /users/search?q=გიორგი
usersRouter.get("/search", async (req,res)=>{
    const q = (req.query.q || "").trim()
    if(!q){
        return res.json({message:"ძებნის შედეგები", data:[]})
    }

    // ყოველი სიტყვა უნდა დაემთხვეს სახელს ან გვარს ("გიორგი ცხ")
    const conditions = q.split(/\s+/).map(word => {
        const regex = new RegExp(escapeRegex(word), "i")
        return { $or: [{ FirstName: regex }, { LastName: regex }] }
    })

    const users = await usersModel
        .find({ $and: conditions, _id: { $ne: req.userId } })
        .select(`${PUBLIC_FIELDS} isOnline`)
        .limit(20)

    res.json({message:"ძებნის შედეგები", data:users})
})

// საკუთარი პროფილის რედაქტირება
usersRouter.put("/me", async (req,res)=>{
    const {FirstName, LastName, BirthDate, Gender, Bio} = req.body

    const updates = {}
    if(FirstName !== undefined) updates.FirstName = FirstName
    if(LastName !== undefined) updates.LastName = LastName
    if(BirthDate !== undefined) updates.BirthDate = BirthDate
    if(Gender !== undefined) updates.Gender = Gender
    if(Bio !== undefined) updates.Bio = Bio

    if(updates.FirstName === "" || updates.LastName === ""){
        return res.status(400).json({message:"სახელი და გვარი არ შეიძლება იყოს ცარიელი"})
    }

    const updatedUser = await usersModel.findByIdAndUpdate(req.userId, updates, {new:true, runValidators:true})
    res.json({message:"პროფილი წარმატებით განახლდა", data:updatedUser})
})

usersRouter.put("/me/password", async (req,res)=>{
    const {currentPassword, newPassword} = req.body

    if(!currentPassword || !newPassword){
        return res.status(400).json({message:"გთხოვთ შეავსოთ ყველა ველი"})
    }
    if(newPassword.length < 6){
        return res.status(400).json({message:"პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს"})
    }

    const user = await usersModel.findById(req.userId).select("+Password")
    const isEqualPass = await bcrypt.compare(currentPassword, user.Password)
    if(!isEqualPass){
        return res.status(400).json({message:"მიმდინარე პაროლი არასწორია"})
    }

    user.Password = await bcrypt.hash(newPassword, 10)
    await user.save()

    res.json({message:"პაროლი წარმატებით შეიცვალა"})
})

usersRouter.put("/me/avatar", upload.single("image"), async (req,res)=>{
    if(!req.file){
        return res.status(400).json({message:"სურათი აუცილებელია"})
    }

    const user = await usersModel.findById(req.userId)
    removeUpload(user.ProfilePicture)
    user.ProfilePicture = `/uploads/${req.file.filename}`
    await user.save()

    res.json({message:"პროფილის სურათი განახლდა", data:user})
})

usersRouter.put("/me/cover", upload.single("image"), async (req,res)=>{
    if(!req.file){
        return res.status(400).json({message:"სურათი აუცილებელია"})
    }

    const user = await usersModel.findById(req.userId)
    removeUpload(user.CoverPicture)
    user.CoverPicture = `/uploads/${req.file.filename}`
    await user.save()

    res.json({message:"ქავერ ფოტო განახლდა", data:user})
})

// საკუთარი ანგარიშის წაშლა (პაროლის დადასტურებით) და ყველა დაკავშირებული მონაცემის გასუფთავება
usersRouter.delete("/me", async (req,res)=>{
    const {Password} = req.body || {}
    if(!Password){
        return res.status(400).json({message:"ანგარიშის წასაშლელად საჭიროა პაროლი"})
    }

    const user = await usersModel.findById(req.userId).select("+Password")
    const isEqualPass = await bcrypt.compare(Password, user.Password)
    if(!isEqualPass){
        return res.status(400).json({message:"პაროლი არასწორია"})
    }

    const userId = user._id

    const posts = await postsModel.find({ user: userId })
    const postIds = posts.map(p => p._id)
    posts.forEach(p => removeUpload(p.image))

    const stories = await storyModel.find({ user: userId })
    stories.forEach(s => removeUpload(s.image))

    const conversations = await conversationModel.find({ participants: userId })
    const conversationIds = conversations.map(c => c._id)

    await Promise.all([
        postsModel.deleteMany({ user: userId }),
        commentsModel.deleteMany({ $or: [{ user: userId }, { post: { $in: postIds } }] }),
        storyModel.deleteMany({ user: userId }),
        friendRequestModel.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }),
        notificationModel.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
        messageModel.deleteMany({ conversation: { $in: conversationIds } }),
        conversationModel.deleteMany({ _id: { $in: conversationIds } }),
        postsModel.updateMany({ likes: userId }, { $pull: { likes: userId } }),
        commentsModel.updateMany({ likes: userId }, { $pull: { likes: userId } }),
        usersModel.updateMany({}, { $pull: { friends: userId, followers: userId, following: userId } })
    ])

    removeUpload(user.ProfilePicture)
    removeUpload(user.CoverPicture)
    await usersModel.findByIdAndDelete(userId)

    res.json({message:"ანგარიში წარმატებით წაიშალა"})
})

// პროფილი + ურთიერთობა ჩემსა და ამ მომხმარებელს შორის
usersRouter.get("/:id", async (req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({message:"მომხმარებლის ID არასწორია", data:null})
    }

    // Email მხოლოდ საკუთარ პროფილზე ჩანს
    const user = await usersModel.findById(id).select(id === req.userId ? "" : "-Email")
    if(!user){
        return res.status(404).json({message:"მომხმარებელი ვერ მოიძებნა", data:null})
    }

    let friendStatus = "none"
    let requestId = null

    if(id === req.userId){
        friendStatus = "self"
    }else if(user.friends.includes(req.userId)){
        friendStatus = "friends"
    }else{
        const request = await friendRequestModel.findOne({
            $or: [
                { sender: req.userId, receiver: id },
                { sender: id, receiver: req.userId }
            ],
            status: "pending"
        })
        if(request){
            friendStatus = request.sender.toString() === req.userId ? "request_sent" : "request_received"
            requestId = request._id
        }
    }

    res.json({
        message:"მომხმარებლის პროფილი",
        data:user,
        relation:{
            friendStatus,
            requestId,
            isFollowing: user.followers.includes(req.userId),
            friendsCount: user.friends.length,
            followersCount: user.followers.length,
            followingCount: user.following.length
        }
    })
})

module.exports = usersRouter
