const {Router} = require("express")
const usersModel = require("../models/users.model")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const isAuth = require("../middleware/isAuth.middleware")


const authRouter = Router()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function createToken(userId){
    return jwt.sign({ userId }, process.env.JWT_SECRET, {expiresIn:"7d"})
}

authRouter.post("/register", async (req,res)=>{
    const {FirstName, LastName, BirthDate, Gender, Password} = req.body
    const Email = req.body.Email?.toLowerCase().trim()

    if(!FirstName || !LastName || !BirthDate || !Gender || !Email || !Password){
        return res.status(400).json({message:"გთხოვთ შეავსოთ ყველა ველი"})
    }
    if(!EMAIL_REGEX.test(Email)){
        return res.status(400).json({message:"Email-ის ფორმატი არასწორია"})
    }
    if(Password.length < 6){
        return res.status(400).json({message:"პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს"})
    }
    if(isNaN(new Date(BirthDate))){
        return res.status(400).json({message:"დაბადების თარიღი არასწორია"})
    }

    const existingUser = await usersModel.findOne({Email})
    if(existingUser){
        return res.status(400).json({message:"მომხმარებელი უკვე არსებობს, გთხოვთ გამოიყენოთ სხვა Email"})
    }

    const hashedPassword = await bcrypt.hash(Password, 10)

    const newUser = await usersModel.create({FirstName, LastName, BirthDate, Gender, Email, Password:hashedPassword})

    res.status(201).json({message:"მომხმარებელი წარმატებით შეიქმნა", token: createToken(newUser._id)})
})

authRouter.post("/login", async (req,res)=>{
    const {Password} = req.body
    const Email = req.body.Email?.toLowerCase().trim()

    if(!Email || !Password){
        return res.status(400).json({message:"გთხოვთ შეავსოთ ყველა ველი"})
    }

    const existingUser = await usersModel.findOne({Email}).select("+Password")
    if(!existingUser){
        return res.status(400).json({message:"Email ან პაროლი არასწორია"})
    }

    const isEqualPass = await bcrypt.compare(Password, existingUser.Password)
    if(!isEqualPass){
        return res.status(400).json({message:"Email ან პაროლი არასწორია"})
    }

    res.json({message:"ტოკენი", token: createToken(existingUser._id)})
})

// მიმდინარე (დალოგინებული) მომხმარებელი
authRouter.get("/me", isAuth, async (req,res)=>{
    const user = await usersModel.findById(req.userId)
    if(!user){
        return res.status(404).json({message:"მომხმარებელი ვერ მოიძებნა"})
    }

    res.json({message:"მიმდინარე მომხმარებელი", data:user})
})

module.exports = authRouter
