// ?page=1&limit=10 -> { page, limit, skip }
function getPagination(query, defaultLimit = 10) {
    const page = Math.max(parseInt(query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 50)

    return { page, limit, skip: (page - 1) * limit }
}

module.exports = getPagination
