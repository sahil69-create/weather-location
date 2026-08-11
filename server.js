const cookieParser = require("cookie-parser")
const socketIO = require("socket.io")
const config = require("./config")
const express = require("express")
const tarkine = require("tarkine")
const http = require('http')
const { exec } = require('child_process')

const app = express()
const server = http.createServer(app)
const io = new socketIO.Server(server)
const PORT = process.env.PORT || config.port

let remoteURL = null // Variable define kar diya
global.remoteURL = remoteURL

global.IO = io

app.set("view engine", "html")
app.engine("html", tarkine.renderFile)
app.use(cookieParser())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(__dirname + "/public"))
app.use(express.json())

app.use("/", require("./router"))

server.listen(PORT, async () => {
    const localURL = `http://localhost:${PORT}`
    console.log(`LOCAL  : ${localURL}`)

    const cloudflaredProcess = exec(`cloudflared tunnel --url ${localURL}`)

    cloudflaredProcess.stderr.on('data', (data) => {
        const match = data.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/)
        if (match && !remoteURL) {
            remoteURL = match[0]
            global.remoteURL = remoteURL
            console.log(`REMOTE : ${remoteURL}`)
        }
    })
})

