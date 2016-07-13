'use strict';

function rpcError(err, res) {

    if (err.hasOwnProperty('code')) {
        if (err.code === 404 && !err.hasOwnProperty('message')) {
            err.message = 'Not found';
        }
        return res.status(err.code).json({
            code:err.code,
            message:err.message
        });
    }

    res.status(500).json({
        message     : err.message
    });
};


exports.rpcError = rpcError;