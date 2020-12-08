require('dotenv').config()
const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const helmet = require('helmet')
const { NODE_ENV } = require('./config')
const winston = require('winston');
const { v4: uuid } = require('uuid');
const bodyParser = express.json()
const { isWebUri } = require('valid-url')

const app = express()

const morganOption = (NODE_ENV === 'production')
  ? 'tiny'
  : 'common';

app.use(morgan(morganOption))
app.use(helmet())
app.use(cors())
app.use(express.json());

// set up winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'info.log' })
  ]
});

if (NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

app.use(function validateBearerToken(req, res, next) {
  const apiToken = process.env.API_TOKEN
  const authToken = req.get('Authorization')

  if (!authToken || authToken.split(' ')[1] !== apiToken) {
    logger.error(`Unauthorized request to path: ${req.path}`)
    return res.status(401).json({ error: 'Unauthorized request' })
  }
  // move to the next middleware
  next()
})

const bookmarks = [
  { id: uuid(),
    title: 'Thinkful',
    url: 'https://www.thinkful.com',
    description: 'Think outside the classroom',
    rating: 5 },
  { id: uuid(),
    title: 'Google',
    url: 'https://www.google.com',
    description: 'Where we find everything else',
    rating: 4 },
  { id: uuid(),
    title: 'MDN',
    url: 'https://developer.mozilla.org',
    description: 'The only place to find web documentation',
    rating: 5 },
]


app.get('/', (req, res) => {
  res.send('Hello, world!')
})

app.get('/bookmarks', (req, res) => {
  res
    .json(bookmarks);
})

app.post(bodyParser, (req, res) => {
  for (const field of ['title', 'url', 'rating']) {
    if (!req.body[field]) {
      logger.error(`${field} is required`)
      return res.status(400).send(`'${field}' is required`)
    }
  }
  const { title, url, description, rating } = req.body
  if (!Number.isInteger(rating) || rating  < 0 || rating > 5) {
    logger.error(`Invalid rating '${rating}' supplied`)
    return res.status(400).send(`'rating' must be a number between 0 and 5`)
  }

  if (!isWebUri(url)) {
    logger.error(`Invalid url '${url} supplied`)
    return res.status(400).send(`'url' must be a valid URL`)
  }

  const bookmark = { id: uuid(), title, url, description, rating }

  bookmarks.push(bookmark)

  logger.info(`Bookmark with id ${bookmark.id} created.`)
  res.status(201).location(`http://localhost:8000/bookmarks/${bookmark.id}`).json(bookmark)
})


app.get('/bookmarks/:bookmark_id', (req, res) => {
  const { bookmark_id } = req.params
  const bookmark = bookmarks.find(c => c.id == bookmark_id);

  // make sure we found a card
  if (!bookmark) {
    logger.error(`Bookmark with id ${bookmark_id} not found.`);
    return res
      .status(404)
      .send('Bokokmark Not Found');
  }

  res.json(bookmark);
});

app.use(function errorHandler(error, req, res, next) {
  let response
  if (NODE_ENV === 'production') {
    response = { error: { message: 'server error' } }
  } else {
    console.error(error)
    response = { message: error.message, error }
  }
  res.status(500).json(response)
})

module.exports = app