'use strict';

var chai   = require('chai');
var expect = chai.expect;
var sinon  = require('sinon');

var errorsHandler = require('../lib/errorsHandler');

describe('errorsHandler', () => {
    describe('rpcError', () => {
        var rpcError  = errorsHandler.rpcError;
        var Status    = function() {
            this.json = function() {};
        };
        var res;
        var spyJson;

        beforeEach(() => {
            spyJson = {
                json : sinon.spy()
            };

            res = {
                status : function() {
                    return spyJson;
                }
            };

            sinon.spy(res, 'status');
        });

        afterEach(() => {
            res.status.restore();
        });

        it('404 --> should set message to "not found" NO message passed', () => {
            rpcError({code : 404}, res);

            expect(res.status.getCall(0).args[0]).equal(404);
            expect(res.status().json.getCall(0).args[0]).deep.equal({code:404, message : 'Not found'});
        });

        it('404 --> should set message to message passed', () => {
            rpcError({code : 404, message:'Houston we got a problem'}, res);

            expect(res.status().json.getCall(0).args[0]).deep.equal({code:404, message : 'Houston we got a problem'});
        });

        it('should set message to code and message passed', () => {
            rpcError({code : 304, message:'Not allowed'}, res);

            expect(res.status.getCall(0).args[0]).equal(304);
            expect(res.status().json.getCall(0).args[0]).deep.equal({code:304, message : 'Not allowed'});
        });

        it('should set code to 500 if no code passed', () => {
            rpcError({message:'Something went really bad'}, res);

            expect(res.status.getCall(0).args[0]).equal(500);
            expect(res.status().json.getCall(0).args[0]).deep.equal({message : 'Something went really bad'});
        });
    });
});