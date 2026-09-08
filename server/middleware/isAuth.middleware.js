const jwt = require("jsonwebtoken")

function getToken(headers){
    if(!headers["authorization"]) return null

    const [type, token] = headers["authorization"].split(" ")
    
    return type === "Bearer" ? token : null
}


async function isAuth(req,res,next){
    const token = getToken(req.headers)

    if(!token){
        return res.status(401).json({message:"ტოკენი არ არის"})
    }

    try{
        const payLoad = await jwt.verify(token, process.env.JWT_SECRET)
        console.log(payLoad)
        req.userId= payLoad.userId

        next()
    }catch(error){
        return res.status(401).json({message:"ტოკენი არასწორია"})
    }

}


module.exports = isAuth 