'use strict';

/**
 * The configuration of the Datastore comes from 2 environment variables
 * GCLOUD_PROJECT
 * GOOGLE_APPLICATION_CREDENTIALS
 *
 * See "server.js" for more info
 */

const gstore = require('gstore-node');
const datastore = require('@google-cloud/datastore')();

const connectDatastore = () => gstore.connect(datastore);

module.exports = {
    connectDatastore,
};
