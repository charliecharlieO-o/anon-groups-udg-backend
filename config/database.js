// mongo server host: 198.199.79.16
const DBHOST = '198.199.79.16'

// USER
// production: maskmobdevelopuser
// develop: maskmobdevelopuser
const USER = 'maskmobdevelopuser'
const PASSWORD = '123456'
const AUTH = `${USER}:${PASSWORD}`

// DB prduction name: maskmobproduction
// DB develop name: maskmobdevelop
const DBNAME = 'maskmobdevelop'

// DB production port: 2018
const PORT = '2018'

const CONNECT_URI = `mongodb://${AUTH}@${DBHOST}:${PORT}/${DBNAME}`

console.log('connect uri', CONNECT_URI)

module.exports = {
	"secret":"5edc4e87b66c1HellSpawner10a6e2aad057df237bb", // Change to something more secret
	database: CONNECT_URI
}
