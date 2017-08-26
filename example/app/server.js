/* eslint-disable global-require, import/no-dynamic-require */

'use strict';

/**
 * load local .env file in "development" environment
 * Make sure you set launch the server with: NODE_ENV=development node app/server.js
 *
 * For "dotenv" to work, you first need to create a ".env" file inside the "example" folder with the following 2 lines
 *
 * GCLOUD_PROJECT=your-project-id
 * GOOGLE_APPLICATION_CREDENTIALS=path-to-credentials-file.json
 *
 * INFO: "path-to-credentials-file.json" is absolute, so is something like:
 * /Users/john/projects/.../your-credential-file.json
 */

if (process.env.NODE_ENV === 'development') {
    require('dotenv').config();
}

const logger = require('winston');
const app = require('./index');
const db = require('./db');

// Initi datastore
db.connectDatastore();

app.listen(3007, (err) => {
    if (err) {
        logger.error('Unable to listen for connections', err);
        process.exit(10);
    }

    logger.info('server is listening on http://127.0.0.1:3007');
});
