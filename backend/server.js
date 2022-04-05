require("dotenv").config()
const fetch = require("node-fetch")
var express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const jp = require("jsonpath")
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioClient = require("twilio")(accountSid, authToken)
const { App } = require("@slack/bolt")
const { google } = require("googleapis")

let client, googleSheets, spreadsheetId, timeToTeams

//Initialize SocketIO, Slack, Google Sheets, and Twilio
const app = express()
app.use(bodyParser.json())
app.use(cors("*"))

app.listen(process.env.API_PORT, () => {
	console.log(`API Server started on port ${process.env.API_PORT}`)
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
})()

/////////////////////////////////////////////////////////////////////////////////////////////////////
var timeToMatch

fetch("https://www.thebluealliance.com/api/v3/event/2022pncmp/matches/simple", {
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
		teams.forEach(function (teamGroup) {
			teamGroup.forEach(function (team, index) {
				teamGroup[index] = teamGroup[index].split("frc")[1]
			})
		})
		matchNums = jp.query(data, "$.*.match_number")
		timeToTeams = new Map()
		for (let i = 0; i < times.length; i++) {
			timeToTeams.set(times[i], teams[2 * i].concat(teams[2 * i + 1]))
		}
		timeToMatch = new Map()
		for (let i = 0; i < matchNums.length; i++) {
			timeToMatch.set(times[i], matchNums[i])
		}
	})
	.catch((err) => {
		console.log(`Failed to get match listings from TBA`)
		slackMessage("U01AEHK9K6Y", "Failed to get match listings from TBA")
	})

app.post("/join", (req, res) => {
	;(async () => {
		try {
			let data
			data = await googleSheets.spreadsheets.values.batchGet({
				auth: auth,
				spreadsheetId: spreadsheetId,
				majorDimension: "COLUMNS",
				ranges: process.env.SHEET_SCOUT_RANGE,
			})
			ids = JSON.parse(data.data.valueRanges[0].values[0]).activeIds
			ids.push(req.body.id)
			await googleSheets.spreadsheets.values.update({
				auth,
				spreadsheetId,
				range: process.env.SHEET_SCOUT_RANGE,
				valueInputOption: "USER_ENTERED",
				resource: {
					values: [[`{ "activeIds": [${ids}] }`]],
				},
			})
		} catch (err) {
			console.log(`Failed to add scout ${req.body.id} to the active list`)
			slackMessage(
				"U01AEHK9K6Y",
				`Failed to add scout ${req.body.id} to the active list`
			)
			res.json({ success: false })
			return
		}
		res.json({ success: true })
	})()
})

app.post("/leave", (req, res) => {
	;(async () => {
		try {
			let data
			data = await googleSheets.spreadsheets.values.batchGet({
				auth: auth,
				spreadsheetId: spreadsheetId,
				majorDimension: "COLUMNS",
				ranges: process.env.SHEET_SCOUT_RANGE,
			})
			ids = JSON.parse(data.data.valueRanges[0].values[0]).activeIds
			if (!ids.includes(req.body.id)) {
				res.json({ success: false })
				return
			}
			ids.splice(ids.indexOf(req.body.id), 1)
			await googleSheets.spreadsheets.values.update({
				auth,
				spreadsheetId,
				range: process.env.SHEET_SCOUT_RANGE,
				valueInputOption: "USER_ENTERED",
				resource: {
					values: [[`{ "activeIds": [${ids}] }`]],
				},
			})
		} catch (err) {
			console.log(
				`Failed to remove scout ${req.body.id} from active list`
			)
			slackMessage(
				"U01AEHK9K6Y",
				`Failed to remove scout ${req.body.id} from active list`
			)
			res.json({ success: false })
			return
		}
		res.json({ success: true })
	})()
})

app.post("/verify", (req, res) => {
	;(async () => {
		try {
			let data
			data = await googleSheets.spreadsheets.values.batchGet({
				auth: auth,
				spreadsheetId: spreadsheetId,
				majorDimension: "COLUMNS",
				ranges: process.env.SHEET_VALIDID_RANGE,
			})
			success = JSON.parse(
				data.data.valueRanges[0].values
			).validIds.includes(req.body.id)
		} catch (err) {
			console.log(`Failed to get valid scout Id ${req.body.id}`)
			slackMessage(
				"U01AEHK9K6Y",
				`Failed to get valid scout Id ${req.body.id}`
			)
			res.json({ success: false })
			return
		}
		res.json({
			success: success,
		})
	})()
})

//for testing:
// const data = require("./testRes.json")
// times = jp.query(data, "$.*.predicted_time")
// times = times.map((time) => roundTime(time * 1000))
// teams = jp.query(data, "$.*.*.*.team_keys")
// teams.forEach(function (teamGroup) {
// 	teamGroup.forEach(function (team, index) {
// 		teamGroup[index] = teamGroup[index].split("frc")[1]
// 	})
// })
// matchNums = jp.query(data, "$.*.match_number")
// timeToTeams = new Map()
// for (let i = 0; i < times.length; i++) {
// 	timeToTeams.set(times[i], teams[2 * i].concat(teams[2 * i + 1]))
// }
// timeToMatch = new Map()
// for (let i = 0; i < matchNums.length; i++) {
// 	timeToMatch.set(times[i], matchNums[i])
// }

//Check if the current time is time to alert for a match.
setInterval(function () {
	currentTime = roundTime(new Date().getTime()) + 120
	if (timeToTeams.has(currentTime)) {
		;(async () => {
			try {
				const matchNum = timeToMatch.get(currentTime)
				const matchTeams = timeToTeams.get(currentTime)
				let data = await googleSheets.spreadsheets.values.batchGet({
					auth: auth,
					spreadsheetId: spreadsheetId,
					majorDimension: "COLUMNS",
					ranges: process.env.SHEET_PRIORITY_RANGE,
				})

				let teamPriorityList = []

				data.data.valueRanges[0].values[0].forEach(function (entry) {
					entry = entry.split("  ")
					teamPriorityList.push(entry[0])
				})

				data = await googleSheets.spreadsheets.values.batchGet({
					auth: auth,
					spreadsheetId: spreadsheetId,
					majorDimension: "COLUMNS",
					ranges: process.env.SHEET_SCOUT_RANGE,
				})
				const activeScouts = JSON.parse(
					data.data.valueRanges[0].values[0]
				).activeIds

				teamPriorityList.forEach((team) => {
					if (matchTeams.includes(team)) {
						if (activeScouts.length > 0) {
							twilioClient.messages.create({
								to: "+1" + activeScouts[0],
								from: process.env.TWILIO_NUMBER,
								body: `For match ${matchNum}, you will be scouting team ${team}`,
							})
							// console.log(
							// 	activeScouts[0],
							// 	`For match ${matchNum}, you will be scouting team ${team}`
							// )
							activeScouts.shift()
						}
					}
				})

				while (activeScouts.length > 0) {
					twilioClient.messages.create({
						to: "+1" + activeScouts[0],
						from: process.env.TWILIO_NUMBER,
						body: `For match ${matchNum}, you can take a break!`,
					})
					// console.log(
					// 	activeScouts[0],
					// 	`For match ${matchNum}, you can take a break!`
					// )
					activeScouts.shift()
				}

			} catch (err) {
				console.log(`Failed to send match notifications`)
				slackMessage(
					"U01AEHK9K6Y",
					"Failed to send match notifications"
				)
				timeToTeams.set(currentTime, matchTeams)
			}
		})()
		timeToTeams.delete(currentTime)
	}
}, 30000)

/////////////////////////////////////////////////////////////////////////////////////////////////////

//Helpful functions
function roundTime(timestamp) {
	return Math.floor(new Date(timestamp / 60000) * 60000) / 1000
}

async function slackMessage(channel, message) {
	try {
		slackApp.client.chat.postMessage({
			token: process.env.SLACK_BOT_TOKEN,
			channel: channel,
			text: message,
		})
	} catch (err) {
		console.log(`Failed to send Slack message "${message}" to ${channel}`)
	}
}
