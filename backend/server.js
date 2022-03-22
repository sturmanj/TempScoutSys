require("dotenv").config()
const fetch = require("node-fetch")
var express = require("express")
const http = require("http")
const io = require("socket.io")(http)
const jp = require("JSONpath")
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioClient = require("twilio")(accountSid, authToken)
const { App } = require("@slack/bolt")
const { google } = require("googleapis")

let client, googleSheets, spreadsheetId, timeToTeams

//Initialize SocketIO, Slack, Google Sheets, and Twilio
const server = http.createServer(express())

server.listen(process.env.IO_PORT, () => {
	console.log(`SocketIO Server started on port ${process.env.IO_PORT}`)
})

const slackApp = new App({
	token: process.env.SLACK_BOT_TOKEN,
	socketMode: true,
	appToken: process.env.SLACK_APP_TOKEN,
})
const auth = new google.auth.GoogleAuth({
	keyFile: "APIkeys.json",
	scopes: "https://www.googleapis.com/auth/spreadsheets",
})

//Async Initialization
;(async () => {
	await slackApp.start(process.env.APP_PORT)
	console.log(`Slack App started on port ${process.env.APP_PORT}`)
	client = await auth.getClient()
	googleSheets = google.sheets({ version: "v4", auth: client })
	spreadsheetId = process.env.SPREADSHEET_ID
	// list = await getTeamPriority()
	// console.log(list)
})()

/////////////////////////////////////////////////////////////////////////////////////////////////////
// io.on("connection", (socket) => {
// 	io.emit("refresh", data)
// 	socket.on("join", (obj) => {
// 		io.emit("refresh", data)
// 	})
// 	socket.on("leave", (obj) => {
// 		io.emit("refresh", data)
// 	})
// })

fetch("https://www.thebluealliance.com/api/v3/event/2022miliv/matches/simple", {
	method: "GET",
	headers: {
		"X-TBA-Auth-Key":
			"z6Y2VRevkgac8q9f9tReGE8K1iPvhSM4zJzRMfikF3WHyQhfzdr6uizUMS6QPWWA",
	},
})
	.then((response) => response.json())
	.then((data) => {
		times = jp.query(data, "$.*.predicted_time")
		times = times.map((time) => roundTime(time * 1000))
		teams = jp.query(data, "$.*.*.*.team_keys")
		timeToTeams = new Map()
		for (let i = 0; i < times.length; i++) {
			timeToTeams.set(times[i], teams[2 * i].concat(teams[2 * i + 1]))
		}
	})
	.catch((err) => {
		console.error(err)
	})

//for testing:
// const data = require("./testRes.json")
// times = jp.query(data, "$.*.predicted_time")
// times = times.map((time) => roundTime(time * 1000))
// teams = jp.query(data, "$.*.*.*.team_keys")
// timeToTeams = new Map()
// for (let i = 0; i < times.length; i++) {
// 	timeToTeams.set(times[i], teams[2 * i].concat(teams[2 * i + 1]))
// }


//Check if the current time is time to alert for a match.
setInterval(function(){
	currentTime = roundTime(new Date().getTime()) + 120
	if (timeToTeams.has(currentTime)) {
		console.log(timeToTeams.get(currentTime))
		timeToTeams.delete(currentTime)
	}
}, 30000);

/////////////////////////////////////////////////////////////////////////////////////////////////////

//Helpful functions
function roundTime(timestamp) {
	return Math.floor(new Date(timestamp / 60000) * 60000) / 1000
}

async function getTeamPriority() {
	try {
	const data = await googleSheets.spreadsheets.values.batchGet({
		auth: auth,
		spreadsheetId: spreadsheetId,
		majorDimension: "COLUMNS",
		ranges: process.env.SHEET_SCOUT_RANGE,
	})
	}
	catch (err) {
		console.log("Failed to get Team Priority List")
	}

	return data.data.valueRanges[0].values[0]
}

async function textMessage(number, message) {
	twilioClient.messages
		.create({
			to: "+1" + number,
			from: process.env.TWILIO_NUMBER,
			body: message,
		})
		.then((message) => console.log(message))
		.catch((err) => console.log(`Failed to send text "${message}" to "${number}"`))
}

async function slackMessage(channel, message) {
	try {
	slackApp.client.chat.postMessage({
		token: process.env.SLACK_BOT_TOKEN,
		channel: channel,
		text: message,
	})
	}
	catch (err) {
		console.log(`Failed to send Slack message "${message}" to ${channel}`)
	}
}
