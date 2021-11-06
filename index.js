const express = require('express')
const mariadb = require('mariadb')
const bp = require('body-parser')
const cors = require('cors')
const axios = require('axios')
require('dotenv').config()
const api = express()
const port = 4000
const CLIENT_ID = '479916084496-dp7jkcmdb7k4evs23grf0sotrb0nfo5p.apps.googleusercontent.com'
const DOMAIN = 'student.pwr.edu.pl'

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
	try {
		const verification = await axios.get('https://oauth2.googleapis.com/tokeninfo?id_token=' + id_token)
		const response = {
			client_correct: true,
			domain_user:  false,
			new_user: false
		}
		if (verification.data.aud !== CLIENT_ID) response.client_correct = false
		if(verification.data.hd === DOMAIN) response.domain_user = true
		if ((await getUserBySub(verification.data.sub)).length === 0) {
			const userName = verification.data.name
			const eMail = verification.data.email
			const sub = verification.data.sub
			response.new_user = true
			await addUser(userName, eMail, sub)
		}
		res.status(200).json(response)
	} catch (error) {
		console.log(error)
	}
})

const getUserBySub = async (sub) => {
	let conn
	try {
		conn = await db.getConnection()
		conn.query('USE 20367_pwr1')
		const r = await conn.query(`SELECT * FROM Players WHERE Sub = ${sub}`)
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
		conn.query('USE 20367_pwr1')
		const r = await conn.query(`INSERT INTO Players(UserName, EMail, Sub) VALUES ('${userName}', '${eMail}', '${sub}')`)
	} catch (error) {
		throw(error)
	} finally {
		if(conn) conn.end()
	}
}

api.listen(port, () => console.log(`Backend api listening at http://localhost:${port}`))