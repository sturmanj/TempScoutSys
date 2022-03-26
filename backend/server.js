require("dotenv").config()
const fetch = require("node-fetch")
var express = require("express")
const bodyParser = require('body-parser');
const cors = require('cors');
const jp = require("JSONpath")
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioClient = require("twilio")(accountSid, authToken)
const { App } = require("@slack/bolt")
const { google } = require("googleapis")

let client, googleSheets, spreadsheetId, timeToTeams

//Initialize SocketIO, Slack, Google Sheets, and Twilio
const app = express()
app.use(bodyParser.json());
app.use(cors());

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
	// list = await getTeamPriority()
	// console.log(list)
})()

/////////////////////////////////////////////////////////////////////////////////////////////////////
fetch("https://www.thebluealliance.com/api/v3/event/2022wimi/matches/simple", {
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
		teams.forEach(function(teamGroup) {
			teamGroup.forEach(function(team, index) {
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
		console.error(err)
	})

app.get('/join', (req, res) => {
	let ids
	(async () => {
		ids = await getActiveScoutIds()
		ids = ids.activeIds
		ids.push(req.body.id)
		insertData(process.env.SHEET_SCOUT_RANGE, `{ "activeIds": [${ids}] }`)
		res.json({success: true})
	})()
})

app.get('/leave', (req, res) => {
	let ids
	(async () => {
		ids = await getActiveScoutIds()
		ids = ids.activeIds
		ids.splice(ids.indexOf(ids), 1)
		insertData(process.env.SHEET_SCOUT_RANGE, `{ "activeIds": [${ids}] }`)
		res.json({success: true})
	})()
})

app.get('/verify', (req, res) => {
	let ids
	(async () => {
		ids = await getValidScoutIds()
		res.json({success: ids.validIds.includes(req.body.id)})
	})()
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
		console.log(timeToTeams.get(currentTime) + "   " + timeToMatch.get(currentTime))
		timeToTeams.delete(currentTime)
	}
}, 60000);

/////////////////////////////////////////////////////////////////////////////////////////////////////

//Helpful functions
function roundTime(timestamp) {
	return Math.floor(new Date(timestamp / 60000) * 60000) / 1000
}

async function getTeamPriority() {
	let data
	try {
		data = await googleSheets.spreadsheets.values.batchGet({
		auth: auth,
		spreadsheetId: spreadsheetId,
		majorDimension: "COLUMNS",
		ranges: process.env.SHEET_PRIORITY_RANGE,
	})
	}
	catch (err) {
		console.log("Failed to get Team Priority List")
	}

	teamPriorityList = []

	data.data.valueRanges[0].values[0].forEach(function (entry) {
		entry = entry.split("  ")
		teamPriorityList.push(entry[0])
	})

	return teamPriorityList
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

async function getValidScoutIds() {
	let data
	try {
		data = await googleSheets.spreadsheets.values.batchGet({
		auth: auth,
		spreadsheetId: spreadsheetId,
		majorDimension: "COLUMNS",
		ranges: process.env.SHEET_VALIDID_RANGE,
	})
	}
	catch (err) {
		console.log("Failed to get valid scout Ids")
	}

	return JSON.parse(data.data.valueRanges[0].values[0])
}

async function getActiveScoutIds() {
	let data
	try {
		data = await googleSheets.spreadsheets.values.batchGet({
		auth: auth,
		spreadsheetId: spreadsheetId,
		majorDimension: "COLUMNS",
		ranges: process.env.SHEET_SCOUT_RANGE,
	})
	}
	catch (err) {
		console.log("Failed to get active scout Ids")
	}

	return JSON.parse(data.data.valueRanges[0].values[0])
}

async function insertData(cell, text) {
    const client = await auth.getClient()
    const googleSheets = google.sheets({ version: "v4", auth: client })
    await googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: cell,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[text]]
        },
    })
}