'use strict';

const gstore = require('gstore-node');
const bcrypt = require('bcrypt-nodejs');
const S = require('string');

const schema = new gstore.Schema({
    createdOn: { default: gstore.defaultValues.NOW, excludeFromIndexes: true, read: false, write: false },
    email: { type: 'string', validate: 'isEmail' },
    firstname: { type: 'string' },
    lastname: { type: 'string' },
    modifiedOn: { default: gstore.defaultValues.NOW, excludeFromIndexes: true, read: false },
    password: {
        type: 'string',
        required: true,
        excludeFromIndexes: true,
        read: false, // we set "read" to false to not return the password in our queries
    },
    username: { type: 'string' },
    profilePict: { type: 'object', excludeFromIndexes: true, write: false },
});

// -----custom methods
// We add a custom method to our User Schema
// that will allow us to authenticate the user
schema.method('verifyPassword', verifyPassword);

// -----pre hooks
// Before we save a new User or when we update a User, we will hash its password
// before saving it to the Datastore
schema.pre('save', hashPassword);

// ------------------------

function hashPassword() {
    const _this = this;

    if (this.password === null || typeof this.password === 'undefined') {
        // No password field, we can exit and proceed with saving
        return Promise.resolve();
    } else if (S(this.password).isEmpty()) {
        // empty password are not allowed
        return Promise.reject({
            code: 422,
            message: 'Password cannot be empty.',
        });
    }

    return new Promise((resolve, reject) => {
        bcrypt.genSalt(5, (err, salt) => {
            if (err) {
                return reject(err);
            }

            return bcrypt.hash(_this.password, salt, null, (errorHash, hash) => {
                if (errorHash) {
                    return reject(errorHash);
                }

                // "this" refers to the gstore Entity instance
                _this.password = hash;

                return resolve();
            });
        });
    });
}

function verifyPassword(password) {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, this.password, (err, isMatch) => {
            if (err) {
                return reject(err);
            }
            return resolve(isMatch);
        });
    });
}

module.exports = gstore.model('User', schema);
