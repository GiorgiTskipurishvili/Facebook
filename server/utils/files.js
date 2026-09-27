const fs = require("fs")
const path = require("path")

const uploadDir = path.join(__dirname, "..", "uploads")

// ატვირთული ფაილის წაშლა დისკიდან (მაგ. "/uploads/123.png")
function removeUpload(filePath) {
    if (!filePath || !filePath.startsWith("/uploads/")) return

    const fullPath = path.join(uploadDir, path.basename(filePath))
    fs.unlink(fullPath, () => {})
}

module.exports = { removeUpload }
