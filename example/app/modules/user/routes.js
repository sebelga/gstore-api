'use strict';

const multer = require('multer');
const router = require('express').Router();
const gstoreApi = require('gstore-api')(); // import unique instance of gstoreApi

// model & controller
const User = require('./user.model');
const user = require('./user.controller');

// Configure Multer file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Tell the gstore-api instance to use our Express router
const apiBuilder = gstoreApi.express(router);

// Settings for our API routes
const settings = {
    operations: {
        create: {
            middleware: [upload.single('profilePict')], // Add a middleware to this route ("multer" file upload)
            handler: user.create, // custom handler for the "Create User" route ("POST /users")
        },
        // udpatePatch: { middleware: [upload.single('profilePict')], handler: user.update },
        updatePatch: { middleware: [upload.single('profilePict')], handler: user.update },
        // updateReplace: { exec: false },
        deleteAll: { exec: true }, // we enable the "DELETE ALL" route. (disabled by default)
    },
};

// Generate API
const routes = apiBuilder.create(User, settings);

module.exports = routes;

/**
 * gstore-api routes generated
 * ---------------------------
 * GET /users --> GET all users
 * GET /users/{id} --> GET a unique user
 * POST /users --> create a User
 * PUT /users/{id} --> Update (and replace) a User at a specific id
 * PATCH /users/{id} --> Update a User at a specific id
 * DELETE /users/{id} --> Delete specific User
 * DELETE /users --> Delete ALL Users
 */
