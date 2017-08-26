'use strict';

const express = require('express');

const app = express();

// routes
require('./routes')(app);

module.exports = app;
