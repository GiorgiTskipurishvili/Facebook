const {Router} = require("express")
const mongoose = require("mongoose")
const notificationModel = require("../models/notification.model")
const getPagination = require("../utils/pagination")
const { isValidObjectId } = mongoose

const notificationsRouter = Router()

notificationsRouter.get("/", async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, 20)
    const filter = { recipient: req.userId }

    const [notifications, total] = await Promise.all([
        notificationModel
            .find(filter)
            .populate("sender", "FirstName LastName ProfilePicture")
            .populate("post", "desc image")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        notificationModel.countDocuments(filter)
    ])

    res.json({
        message: "ნოტიფიკაციები",
        data: notifications,
        page,
        hasMore: skip + notifications.length < total
    })
})

notificationsRouter.get("/unread/count", async (req, res) => {
    const count = await notificationModel.countDocuments({ recipient: req.userId, isRead: false })
    res.json({ message: "წაუკითხავი ნოტიფიკაციები", count })
})

notificationsRouter.put("/read-all", async (req, res) => {
    await notificationModel.updateMany({ recipient: req.userId, isRead: false }, { isRead: true })
    res.json({ message: "ყველა ნოტიფიკაცია წაკითხულად მოინიშნა" })
})

notificationsRouter.put("/:id/read", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "ნოტიფიკაციის ID არასწორია" })
    }

    const notification = await notificationModel.findOneAndUpdate(
        { _id: id, recipient: req.userId },
        { isRead: true },
        { new: true }
    )
    if (!notification) {
        return res.status(404).json({ message: "ნოტიფიკაცია ვერ მოიძებნა" })
    }

    res.json({ message: "ნოტიფიკაცია წაკითხულად მოინიშნა", data: notification })
})

notificationsRouter.delete("/:id", async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "ნოტიფიკაციის ID არასწორია" })
    }

    const notification = await notificationModel.findOneAndDelete({ _id: id, recipient: req.userId })
    if (!notification) {
        return res.status(404).json({ message: "ნოტიფიკაცია ვერ მოიძებნა" })
    }

    res.json({ message: "ნოტიფიკაცია წაიშალა" })
})

module.exports = notificationsRouter
