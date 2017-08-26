'use strict';


const bodyParser = require('body-parser');

const router = require('express').Router();

const auth = require('./authentication');

router.post('/auth/login', bodyParser.json(), auth.login);

module.exports = router;
