const fs = require("fs")
const path = require("path")

const uploadDir = path.join(__dirname, "..", "uploads")

// ატვირთული ფაილის წაშლა დისკიდან (მაგ. "/uploads/123.png")
function removeUpload(filePath) {
    if (!filePath || !filePath.startsWith("/uploads/")) return

    const fullPath = path.join(uploadDir, path.basename(filePath))
    fs.unlink(fullPath, () => {})
}

// ერთი ფაილი შეიძლება ერთდროულად იყოს პოსტის ფოტოც და პროფილის/ქავერ სურათიც -
// ვშლით მხოლოდ მაშინ, როცა აღარსად გამოიყენება
async function removeUploadIfUnused(filePath) {
    if (!filePath) return

    // მოდელები აქ იტვირთება, რომ წრიული require არ მივიღოთ
    const postsModel = require("../models/posts.model")
    const usersModel = require("../models/users.model")

    const [usedInPost, usedByUser] = await Promise.all([
        postsModel.exists({ image: filePath }),
        usersModel.exists({ $or: [{ ProfilePicture: filePath }, { CoverPicture: filePath }] })
    ])

    if (!usedInPost && !usedByUser) removeUpload(filePath)
}

module.exports = { removeUpload, removeUploadIfUnused }
