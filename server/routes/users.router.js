const {Router} = require('express');
const usersModel = require('../models/users.model');
const mongoose = require("mongoose");
const usersRouter = Router();
const { isValidObjectId } = mongoose;

usersRouter.get("/", async (req,res)=>{
    // res.json({message:"This is /users request"})
    const findAllUser = await usersModel.find()
    res.json({message:"გილოცავ შენ წარმატებით წამოიღე ინფორმაცია ბაზიდან", data:findAllUser})
})

usersRouter.get("/:id", async (req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({message:"მომხმარებლის ID არასწორია", data:null})
    }

    const findUser = await usersModel.findById(id).select("-Password")
    res.json({message:"გილოცავ შენ წარმატებით წამოიღე ინფორმაცია ბაზიდან ID-ის მიხედვით", data:findUser})
})

usersRouter.delete("/:id", async (req,res)=>{
    const {id} = req.params
    if(!isValidObjectId(id)){
        return res.status(400).json({message:"მომხმარებლის ID არასწორია", data:null})
    }

    const deleteUser = await usersModel.findByIdAndDelete(id)
    res.json({message:"გილოცავ შენ წარმატებით წაშალე ინფორმაცია ბაზიდან ID-ის მიხედვით", data:deleteUser})
})

usersRouter.put("/:id", async (req,res)=>{
    const {id} = req.params
    const {FirstName, LastName, BirthDate, Gender, Email, Password} = req.body
    if(!isValidObjectId(id)){
        return res.status(400).json({message:"მომხმარებლის ID არასწორია", data:null})
    }

    // const updateUser = await usersModel.findByIdAndUpdate(id, req.body, {new:true})
    const findByIdAndUpdateUser = await usersModel.findByIdAndUpdate(id,{FirstName, LastName, BirthDate, Gender, Email, Password}, {new:true})
    res.json({message:"გილოცავ შენ წარმატებით განაახლე ინფორმაცია ბაზაში ID-ის მიხედვით", data:findByIdAndUpdateUser})
})

module.exports = usersRouter