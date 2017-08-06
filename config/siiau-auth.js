const axios = require('axios')
const promosify = require('pify')
const parseString = promosify(require('xml2js').parseString)

module.exports = {
  getUserInfo (userCode, userPass) {
    const authUrl = `http://tas09.siiau.udg.mx/WebServiceLogon/WebServiceLogon?invoke=valida&codigo=${userCode}&nip=${userPass}&key=UdGSIIAUWebServiceValidaUsuario`

    return axios.get(authUrl)
    .then((res) => parseString(res.data))
    .then((res) => new Promise((resolve, reject) => {
      let response = res['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns1:validaResponse'][0]['return'][0]['_']
      if (response === '0') resolve(null)
      else {
        let user = response.split(',')
        resolve({
          type: user[0],
          code: user[1],
          name: user[2],
          campus: user[3],
          career: user[4]
        })
      }
    }))
  }
}
