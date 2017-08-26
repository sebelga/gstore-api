'use strict';

const User = require('../user').User;

const login = (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (typeof username === 'undefined') {
        return res.status(403).json({ message: 'Username is missing' });
    }

    return User.findOne({ username })
        .then((user) => {
            // "user" is a gstore entity instance
            // we call the cusom method in its schema
            return user.verifyPassword(password)
                .then((match) => {
                    if (!match) {
                        return res.status(403).json({ message: 'Authentication failed' });
                    }

                    // Authentication success
                    const token = '1234'; // // Here you would probably generate a Json Web Token

                    return res.json({ token });
                });
        })
        .catch((err) => {
            if (err.code === 404) {
                return res.status(403).json({
                    message: 'Authentication failed',
                });
            }

            return res.status(400).json({ message: err.message || 'Server login error.' });
        });
};

module.exports = { login };
