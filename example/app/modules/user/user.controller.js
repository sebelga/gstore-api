'use strict';

const logger = require('winston');
const User = require('./user.model');

/**
 * Express Route handler to create a User
 * @param {*} req -- Express request
 * @param {*} res -- Express response
 */
const create = (req, res) => {
    // Always sanitize data coming from the client
    const userData = User.sanitize(req.body);

    const user = new User(userData);
    const validation = user.validate();

    // Make sure we don't have any validation error
    // before uploading any file
    if (!validation.success) {
        return onError(validation.errors);
    }

    if (req.file) {
        // If we have a file, we upload it first
        return uploadFile(req.file)
            .then(saveUser);
    }

    return saveUser();

    // ---------

    function saveUser(profilePict) {
        // In case we uploaded a file, we add the data to our user
        if (profilePict) {
            user.profilePict = profilePict;
        }

        return user.save()
            .then(entity => res.json(entity.plain()))
            .catch(onError);
    }

    function onError(err) {
        res.status(400).json(err);
    }
};

/**
 * Express Route handler to update a User (PATCH)
 * @param {*} req -- Express request
 * @param {*} res -- Express response
 */
const update = (req, res) => {
    const userData = User.sanitize(req.body);

    if (req.file) {
        // If we have a file, we upload it first
        return uploadFile(req.file)
            .then(updateUser);
    }

    return updateUser();

    // ---------

    function updateUser(profilePict) {
        if (profilePict) {
            userData.profilePict = profilePict;
        }

        return User.update(req.params.id, userData)
            .then(entity => res.json(entity.plain()))
            .catch(err => res.status(400).json(err));
    }
};

/**
 * Function to upload a file to the server/cloud/...
 * It would probably be inside a "file utiliy" module
 *
 * @param {*} file -- file to upload
 */
function uploadFile(file) {
    // here comes the logic to upload the file...
    const fileSize = (file.buffer.length / (1024 * 1024)).toFixed(2);
    logger.info(`...uploading file: ${file.originalname}. Size: ${fileSize}MB`);

    // For Demo we just resolve with dummy data
    return Promise.resolve({
        imageUrl: 'https://image-uploaded-url/users/1234/profile.jpg',
        bucket: 'user-profile-bucket',
    });
}

module.exports = {
    create,
    update,
};
