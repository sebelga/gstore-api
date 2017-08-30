'use strict';

function rpcError(err, res) {
    if ({}.hasOwnProperty.call(err, 'code')) {
        const errorCode = typeof err.code !== 'number' ? 400 : err.code;

        if (errorCode === 404 && !{}.hasOwnProperty.call(err, 'message')) {
            err.message = 'Not found';
        }

        return res.status(errorCode).json({
            code: errorCode,
            message: err.message,
        });
    }

    return res.status(500).json({
        message: err.message,
    });
}

exports.rpcError = rpcError;
