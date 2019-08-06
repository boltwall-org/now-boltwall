/**
 * IMPORTANT: This is a file created by the now-boltwall builder.
 * The builder will make this file as the entrypoint and import the
 * user defined one as the `protectedRoute`
 */

const express = require('express')
const cors = require('cors')
var bodyParser = require('body-parser')
const { boltwall, TIME_CAVEAT_CONFIGS } = require('boltwall')

let protectedRoute = require('./_entrypoint')

const router = express.Router()

const app = express()

// middleware
app.use(cors())
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.use('*', (req, res, next) => {
  console.log('boltwall:', boltwall())
  console.log('protectedRoute:', protectedRoute)
  console.log('here is the original url:', req.originalUrl)
  console.log('here is the path:', req.path)
  console.log('and here is the req.url:', req.url)
  console.log('and here is the base:', req.baseUrl)
  next()
})
app.use('/', boltwall(TIME_CAVEAT_CONFIGS))

router.use(protectedRoute)

app.use('*/protected', router)

module.exports = app
