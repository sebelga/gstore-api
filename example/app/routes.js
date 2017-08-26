'use strict';

// import your gstore-api routes
const userRoutes = require('./modules/user').routes;

// import any other Express routes
const authRoutes = require('./modules/auth').routes;

// -----------------

const routes = (app) => {
    // gstore-api routes
    app.use('/api/v1', userRoutes); // we prefix our User API routes with '/api/v1'

    // other Express routes
    app.use(authRoutes);
};

module.exports = routes;
