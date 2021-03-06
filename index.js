const express = require('express')
const mariadb = require('mariadb')
const bp = require('body-parser')
const cors = require('cors')
const {OAuth2Client} = require('google-auth-library')
require('dotenv').config()
const api = express()
const port = 4000

const db = mariadb.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	connectionLimit: 5
})
api.use(bp.json())
api.use(bp.urlencoded({ extended: true }))
api.use(cors())

api.post('/tokensignin/', async (req, res) => {
	const id_token = req.body.id_token
	const client = new OAuth2Client(process.env.CLIENT_ID)
	try {
		const ticket = await client.verifyIdToken({
			idToken: id_token,
			audience: process.env.CLIENT_ID,
		})
		const payload = ticket.getPayload()
		const response = {
			client_correct: true,
			domain_user: false,
			new_user: false
		}
		if (payload.aud !== process.env.CLIENT_ID) response.client_correct = false
		if (payload.hd === process.env.DOMAIN) response.domain_user = true
		if ((await getUserBySub(payload.sub)).length === 0) {
			const userName = payload.name
			const eMail = payload.email
			const sub = payload.sub
			response.new_user = true
			await addUser(userName, eMail, sub)
		}
		res.status(200).json(response)
	} catch (error) {
		console.log(error)
	}
})

api.post('/results/', async (req, res) => {
	const eMail = req.body.eMail
	const gameID = req.body.gameID
	const gameSettings = req.body.gameSettings
	const gameResults = req.body.gameResults
	const deviceInfo = req.body.deviceInfo
	let conn
	try {
		conn = await db.getConnection()
		conn.query(`USE ${process.env.DB_NAME}`)
		const gameSettingsID = (await conn.query('INSERT INTO GameSettings SET Setting1 = ?, Setting2 = ?, Setting3 = ?, Setting4 = ?, Setting5 = ?',
			[gameSettings.Setting1 === undefined ? null : gameSettings.Setting1, gameSettings.Setting2 === undefined ? null : gameSettings.Setting2, gameSettings.Setting3 === undefined ? null : gameSettings.Setting3, gameSettings.Setting4 === undefined ? null : gameSettings.Setting4, gameSettings.Setting5 === undefined ? null : gameSettings.Setting5])).insertId
		const gameResultsID = (await conn.query('INSERT INTO GameResults SET Result1 = ?, Result2 = ?, Result3 = ?, Result4 = ?, Result5 = ?',
			[gameResults.Result1 === undefined ? null : gameResults.Result1, gameResults.Result2 === undefined ? null : gameResults.Result2, gameResults.Result3 === undefined ? null : gameResults.Result3, gameResults.Result4 === undefined ? null : gameResults.Result4, gameResults.Result5 === undefined ? null : gameResults.Result5])).insertId
		await conn.query('INSERT INTO GameRounds SET PlayerID = (SELECT ID FROM Players WHERE EMail = ?), GameID = ?, GameSettingsID = ?, GameResultsID = ?, DeviceInfo = ?, Date = ?',
			[eMail, gameID, gameSettingsID, gameResultsID, deviceInfo, new Date().toISOString().slice(0, 19).replace('T', ' ')])
	} catch (error) {
		console.log(error)
		res.status(500)
	} finally {
		if (conn) conn.end()
		res.end()
	}
})

api.get('/results/', async (req, res) => {
	const eMail = req.query['eMail']
	const gameID = req.query['gameID']
	let conn
	let r
	try {
		conn = await db.getConnection()
		conn.query(`USE ${process.env.DB_NAME}`)
		let baseQuery = 'SELECT GameRounds.ID, GameID, PlayerID, UserName, EMail, Setting1, Setting2, Setting3, Setting4, Setting5, Result1, Result2, Result3, Result4, Result5, DeviceInfo, Date FROM `GameRounds` INNER JOIN Players ON PlayerID = Players.ID INNER JOIN GameSettings ON GameSettingsID = GameSettings.ID INNER JOIN GameResults ON GameResultsID = GameResults.ID'
		if (eMail && gameID) {
			r = await conn.query(baseQuery + ' WHERE EMail = ? AND GameID = ?', [eMail, gameID])
		} else if (eMail) {
			r = await conn.query(baseQuery + ' WHERE EMail = ?', eMail)
		} else if (gameID) {
			r = await conn.query(baseQuery + ' WHERE GameID = ?', gameID)
		} else {
			r = await conn.query(baseQuery)
		}
		for (let a of r) {
			a.DeviceInfo = JSON.parse(a.DeviceInfo)
		}
	} catch (error) {
		console.log(error)
		res.status(500)
	} finally {
		if (conn) conn.end()
		res.send(r)
	}
})

const getUserBySub = async (sub) => {
	let conn
	try {
		conn = await db.getConnection()
		conn.query(`USE ${process.env.DB_NAME}`)
		const r = await conn.query('SELECT * FROM Players WHERE Sub = ?', sub)
		data = r.splice(r.indexOf('meta'), 1)
		return data
	} catch (error) {
		throw(error)
	} finally {
		if(conn) conn.end()
	}
}

const addUser = async (userName, eMail, sub) => {
	let conn
	try {
		conn = await db.getConnection()
		conn.query(`USE ${process.env.DB_NAME}`)
		const r = await conn.query('INSERT INTO Players SET UserName = ?, EMail = ?, Sub = ?', [userName, eMail, sub])
	} catch (error) {
		throw(error)
	} finally {
		if(conn) conn.end()
	}
}

api.listen(port, () => console.log(`Backend api listening at http://localhost:${port}`))