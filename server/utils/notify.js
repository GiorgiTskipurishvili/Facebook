const notificationModel = require("../models/notification.model")

const SENDER_FIELDS = "FirstName LastName ProfilePicture"

// ნოტიფიკაციის შექმნა და რეალურ დროში გაგზავნა მიმღების პირად ოთახში
async function notify(req, { recipient, type, post = null, comment = null }) {
    if (!recipient || recipient.toString() === req.userId) return null

    const notification = await notificationModel.create({
        recipient,
        sender: req.userId,
        type,
        post,
        comment
    })

    const populated = await notification.populate("sender", SENDER_FIELDS)

    const io = req.app.get("io")
    io.to(`user:${recipient}`).emit("notification:new", populated)

    return populated
}

// ნოტიფიკაციის წაშლა (მაგ. ლაიქის მოხსნისას)
async function removeNotification(req, { recipient, type, post = null, comment = null }) {
    if (!recipient) return
    await notificationModel.deleteMany({ recipient, sender: req.userId, type, post, comment })
}

module.exports = { notify, removeNotification }
