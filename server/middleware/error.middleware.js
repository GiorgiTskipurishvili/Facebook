const multer = require("multer")
const { removeUpload } = require("../utils/files")

function notFound(req, res) {
    res.status(404).json({ message: "ასეთი მისამართი არ არსებობს" })
}

// გლობალური error handler - ყველა შეცდომა JSON-ად ბრუნდება
function errorHandler(err, req, res, next) {
    // თუ request-ის დამუშავება ჩავარდა, ატვირთული ფაილი აღარ გვჭირდება
    if (req.file) removeUpload(`/uploads/${req.file.filename}`)

    if (err instanceof multer.MulterError) {
        const message = err.code === "LIMIT_FILE_SIZE"
            ? "ფაილის ზომა არ უნდა აღემატებოდეს 5MB-ს"
            : "ფაილის ატვირთვა ვერ მოხერხდა"
        return res.status(400).json({ message })
    }

    if (err.message && err.message.startsWith("დაშვებულია მხოლოდ სურათები")) {
        return res.status(400).json({ message: err.message })
    }

    if (err.name === "CastError") {
        return res.status(400).json({ message: "არასწორი ID ან მონაცემი" })
    }

    if (err.name === "ValidationError") {
        const message = Object.values(err.errors).map(e => e.message).join(", ")
        return res.status(400).json({ message })
    }

    if (err.code === 11000) {
        return res.status(400).json({ message: "ასეთი მონაცემი უკვე არსებობს" })
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "არასწორი JSON" })
    }

    console.error(err)
    res.status(500).json({ message: "სერვერის შეცდომა" })
}

module.exports = { notFound, errorHandler }
