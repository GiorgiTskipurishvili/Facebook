const {Router} = require("express")
const usersModel = require("../models/users.model")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")


const authRouter = Router() 

authRouter.post("/register", async (req,res)=>{
    const {FirstName, LastName, BirthDate, Gender, Email, Password} = req.body
    
    if(!FirstName || !LastName || !BirthDate || !Gender || !Email || !Password){
        return res.status(400).json({message:"გთხოვთ შეავსოთ ყველა ველი"})
    }
    
    const existingUser = await usersModel.findOne({Email})
    if(existingUser){
        return res.status(400).json({message:"მომხმარებელი უკვე არსებობს, გთხოვთ გამოიყენოთ სხვა Email"})
    }
    
    const hashedPassword = await bcrypt.hash(Password, 10)

    await usersModel.create({FirstName, LastName, BirthDate, Gender, Email, Password:hashedPassword})

    res.json({message:"მომხმარებელი წარმატებით შეიქმნა"})   
})

authRouter.post("/login", async (req,res)=>{
    const {Email, Password} = req.body

    if(!Email || !Password){
        return res.status(400).json({message:"გთხოვთ შეავსოთ ყველა ველი"})
    }

    const existingUser = await usersModel.findOne({Email})
    if(!existingUser){
        return res.status(400).json({message:"ასეთი მომხმარებელი არ არსებობს, გთხოვთ შეამოწმოთ Email ან შექმნათ ახალი მომხმარებელი"})
    }

    const isEqualPass = await bcrypt.compare(Password, existingUser.Password)
    if(!isEqualPass){
        return res.status(400).json({message:"პაროლი არასწორია"})
    }

    const payLoad ={
        userId: existingUser._id
    }

    const token = jwt.sign(payLoad, process.env.JWT_SECRET, {expiresIn:"1h"})

    res.json({message:"ტოკენი", token})
})

module.exports = authRouter 