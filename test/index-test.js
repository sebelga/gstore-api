/* eslint-env mocha */

'use strict';

const chai = require('chai');
const sinon = require('sinon');
const path = require('path');
const extend = require('extend');
const gstore = require('gstore-node');
let gstoreApi = require('../lib')();

require('sinon-as-promised');

const errorsHandler = require('../lib/errorsHandler');

const expect = chai.expect;
const assert = chai.assert;
const apiRoute = {
    get() { return true; },
    post() { return true; },
    put() { return true; },
    patch() { return true; },
    delete() { return true; },
};
const router = {
    name: 'router',
    route() {
        return apiRoute;
    },
};

let apiBuilder = gstoreApi.express(router);

function Datastore() {
    this.key = () => {};
}

gstore.connect(new Datastore());

describe('Datastore API', () => {
    let schema;
    let Model;
    let req;
    let res;

    const entity = {
        plain: () => ({ id: 123 }),
    };

    const apiDefaultSettings = {
        path: '/users',
    };

    beforeEach('Init Model and Schema', () => {
        sinon.spy(router, 'route');

        gstore.models = {};
        gstore.modelSchemas = {};

        schema = new gstore.Schema({
            title: { type: 'string' },
        }, {
            queries: {
                showKey: true,
            },
        });

        Model = gstore.model('BlogPost', schema);

        req = {
            params: { id: 123, anc0ID: 'ancestor1', anc1ID: 'ancestor2' },
            query: {},
            body: { title: 'Blog Title' },
            get: () => 'http://localhost',
            originalUrl: '',
        };

        res = {
            status: () => ({ json: () => {}, send: () => {} }),
            set: () => {},
            json: () => {},
        };

        sinon.spy(res, 'json');
        sinon.spy(errorsHandler, 'rpcError');
        sinon.spy(entity, 'plain');
    });

    afterEach(() => {
        router.route.restore();
        res.json.restore();
        errorsHandler.rpcError.restore();
        entity.plain.restore();
    });

    describe('express()', () => {
        it('should throw Error if not passing router', () => {
            const fun = () => gstoreApi.express();

            expect(fun).throw();
        });
    });

    describe('api create()', () => {
        it('should throw error if no model, settings or router passed', () => {
            const fn1 = () => apiBuilder.create();
            const fn2 = () => apiBuilder.create({});
            const fn3 = () => apiBuilder.create({}, {});

            expect(fn1).throw(Error);
            expect(fn2).throw(Error);
            expect(fn3).throw(Error);
        });

        it('should throw an error if path is not a String', () => {
            const fn = () => apiBuilder.create(Model, { path: {} });

            expect(fn).throw(Error);
        });

        it('should set its Model', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            expect(routerRef.__gstoreApi.Model).equal(Model);
        });

        it('should create path if not passed', () => {
            const routerRef = apiBuilder.create(Model);

            expect(routerRef.__gstoreApi.settings.path).equal('/blog-posts');
        });

        it('should read settings from the Model Schema', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            expect(routerRef.__gstoreApi.settings.showKey).equal(Model.schema.options.queries.showKey);
        });

        it('should read settings from general settings', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', simplifyResult: '123' });

            expect(routerRef.__gstoreApi.settings.simplifyResult).equal('123');
        });
    });

    describe('list()', () => {
        const entities = [{ id: 123 }];

        beforeEach(() => {
            sinon.stub(Model, 'list').resolves({ entities });
        });

        afterEach(() => {
            Model.list.restore();
        });

        it('should read from general settings', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', showKey: false });

            return routerRef.__gstoreApi.list(req, res)
                        .then(() => {
                            expect(Model.list.getCall(0).args[0]).deep.equal({ showKey: false });
                            expect(res.json.getCall(0).args[0]).equal(entities);
                        });
        });

        it('should set Link Header if nextPageCursor', () => {
            Model.list.restore();
            sinon.stub(Model, 'list').resolves({
                nextPageCursor: 'abc123',
            });
            sinon.spy(res, 'set');
            const routerRef = apiBuilder.create(Model);

            return routerRef.__gstoreApi.list(req, res)
                        .then(() => {
                            expect(res.set.called).equal(true);
                            expect(res.set.getCall(0).args[0]).equal('Link');

                            res.set.restore();
                        });
        });

        it('should add start setting if pageCursor in request query', () => {
            req.query.pageCursor = 'abcd1234';
            const routerRef = apiBuilder.create(Model);

            routerRef.__gstoreApi.list(req, res);

            expect(Model.list.getCall(0).args[0]).deep.equal({ showKey: true, start: 'abcd1234' });
        });

        it('should read options', () => {
            const settings = {
                path: '/users',
                operations: {
                    list: {
                        options: {
                            showKey: false,
                            limit: 13,
                            order: { property: 'title', descending: true },
                            select: 'name',
                            ancestors: ['MyDad'],
                            filters: ['paid', true],
                        },
                    },
                },
            };
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi.list(req, res);

            expect(Model.list.getCall(0).args[0]).deep.equal(settings.operations.list.options);
        });

        it('should add ancestors to query', () => {
            const settings1 = {
                path: '/users',
                ancestors: 'Dad',
                operations: {
                    list: {
                        options: {
                            ancestors: ['MyDad'],
                        },
                    },
                },
            };
            const dsApi1 = apiBuilder.create(Model, settings1).__gstoreApi;

            const settings2 = {
                path: '/users',
                ancestors: ['GrandFather', 'Dad'],
            };
            const dsApi2 = apiBuilder.create(Model, settings2).__gstoreApi;

            const settings3 = {
                path: '/users',
                ancestors: ['GrandFather', 'Dad', 'Other'],
            };
            const dsApi3 = apiBuilder.create(Model, settings3).__gstoreApi;

            dsApi1.list(req, res);
            dsApi2.list(req, res);
            dsApi3.list(req, res);

            expect(Model.list.getCall(0).args[0])
                .deep.equal({ showKey: true, ancestors: ['Dad', 'ancestor1'] });
            expect(Model.list.getCall(1).args[0])
                .deep.equal({ showKey: true, ancestors: ['GrandFather', 'ancestor1', 'Dad', 'ancestor2'] });
            expect(Model.list.getCall(2).args[0])
                .deep.equal({ showKey: true, ancestors: ['GrandFather', 'ancestor1', 'Dad', 'ancestor2'] });
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    list: {
                        handler: () => true,
                    },
                },
            };
            sinon.spy(settings.operations.list, 'handler');
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi.list(req, res);

            expect(settings.operations.list.handler.called).equal(true);
        });

        it('should deal with error', () => {
            const error = { code: 500, message: 'Houston we got a problem' };

            Model.list.restore();
            sinon.stub(Model, 'list').rejects(error);

            const routerRef = apiBuilder.create(Model, { path: '/users' });
            routerRef.__gstoreApi.list(req, res)
                    .then(() => {
                        const args = errorsHandler.rpcError.getCall(0).args;
                        expect(args[0]).equal(error);
                        expect(args[1]).equal(res);
                    });
        });
    });

    describe('get()', () => {
        beforeEach(() => {
            sinon.stub(Model, 'get').resolves(entity);
        });

        afterEach(() => {
            Model.get.restore();
        });

        it('should call get on Model', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            return routerRef.__gstoreApi.get(req, res)
                    .then(() => {
                        expect(Model.get.getCall(0).args[0]).deep.equal(123);
                        expect(res.json.getCall(0).args[0]).deep.equal(entity.plain());
                    });
        });

        it('should pass ancestors param', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', ancestors: 'Dad' });

            return routerRef.__gstoreApi.get(req, res)
                    .then(() => {
                        expect(Model.get.getCall(0).args[1]).deep.equal(['Dad', 'ancestor1']);
                    });
        });

        it('should set simplifyResult from settings', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', simplifyResult: true });

            return routerRef.__gstoreApi.get(req, res)
                        .then(() => {
                            expect(res.json.getCall(0).args[0]).deep.equal(entity.plain());
                        });
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    get: {
                        handler: () => true,
                    },
                },
            };
            sinon.spy(settings.operations.get, 'handler');
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi.get(req, res);

            expect(settings.operations.get.handler.called).equal(true);
        });

        it('should read options', () => {
            const settings = {
                path: '/users',
                operations: {
                    get: {
                        options: { readAll: true, showKey: false },
                    },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            return routerRef.__gstoreApi.get(req, res)
                        .then(() => {
                            expect(entity.plain.called).equal(true);
                            expect(entity.plain.getCall(0).args[0]).deep.equal({ readAll: true, showKey: false });
                        });
        });

        it('should deal with error', () => {
            const error = { code: 500, message: 'Houston we got a problem' };
            Model.get.restore();
            sinon.stub(Model, 'get').rejects(error);

            const routerRef = apiBuilder.create(Model, { path: '/users' });
            return routerRef.__gstoreApi.get(req, res)
                        .then(() => {
                            const args = errorsHandler.rpcError.getCall(0).args;
                            expect(args[0]).equal(error);
                            expect(args[1]).equal(res);
                        });
        });
    });

    describe('create()', () => {
        let myEntity;

        schema = new gstore.Schema({
            title: { type: 'stirng' },
        }, {
            queries: {
                simplifyResult: false,
            },
        });

        Model = gstore.model('Blog', schema);

        const namespace = { Model };

        beforeEach(() => {
            myEntity = new Model(req.body);

            sinon.stub(myEntity, 'save').resolves(myEntity);
            sinon.stub(myEntity, 'plain').returns(0);
            sinon.stub(namespace, 'Model').returns(myEntity);

            namespace.Model.sanitize = function sanitize() {};
        });

        afterEach(() => {
            myEntity.save.restore();
            namespace.Model.restore();
        });

        it('should call save on Model', () => {
            const routerRef = apiBuilder.create(namespace.Model, { path: '/users' });

            return routerRef.__gstoreApi.create(req, res)
                    .then(() => {
                        expect(myEntity.save.called).equal(true);
                        expect(res.json.called).equal(true);
                        expect(myEntity.plain.called).equal(true);
                    });
        });

        it('should pass ancestors param', () => {
            const routerRef = apiBuilder.create(namespace.Model, { path: '/users', ancestors: ['GrandFather', 'Dad'] });

            routerRef.__gstoreApi.create(req, res);

            expect(namespace.Model.getCall(0).args[2]).deep.equal(['GrandFather', 'ancestor1', 'Dad', 'ancestor2']);
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    create: {
                        handler: () => true,
                    },
                },
            };
            sinon.spy(settings.operations.create, 'handler');
            const routerRef = apiBuilder.create(namespace.Model, settings);

            routerRef.__gstoreApi.create(req, res);

            expect(settings.operations.create.handler.called).equal(true);
        });

        it('should read options', () => {
            const settings = {
                path: '/users',
                operations: {
                    create: {
                        options: { readAll: true, showKey: false },
                    },
                },
            };

            const routerRef = apiBuilder.create(namespace.Model, settings);

            return routerRef.__gstoreApi.create(req, res)
                        .then(() => {
                            expect(myEntity.plain.called).equal(true);
                            expect(myEntity.plain.getCall(0).args[0]).deep.equal({ readAll: true, showKey: false });
                        });
        });

        it('should deal with error', () => {
            myEntity.save.restore();
            const error = { code: 500, message: 'Houston we got a problem' };

            sinon.stub(myEntity, 'save').rejects(error);

            const routerRef = apiBuilder.create(namespace.Model, { path: '/users' });
            return routerRef.__gstoreApi.create(req, res)
                        .then(() => {
                            const args = errorsHandler.rpcError.getCall(0).args;
                            expect(args[0]).equal(error);
                            expect(args[1]).equal(res);
                        });
        });

        it('should return 500 if uploading file without handler', () => {
            const req2 = extend(true, {}, req);
            req2.file = new Buffer('string');
            sinon.spy(res, 'status');

            const routerRef = apiBuilder.create(namespace.Model);
            routerRef.__gstoreApi.create(req2, res);

            expect(res.status.called).equal(true);
            expect(res.status.getCall(0).args[0]).equal(500);
        });
    });

    describe('updatePatch()', () => {
        beforeEach(() => {
            sinon.stub(Model, 'update').resolves(entity);
        });

        afterEach(() => {
            Model.update.restore();
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    updatePatch: { handler: () => true },
                },
            };
            sinon.spy(settings.operations.updatePatch, 'handler');
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi.updatePatch(req, res);

            expect(settings.operations.updatePatch.handler.called).equal(true);
        });

        it('should call update()', () => {
            const routerRef = apiBuilder.create(Model);
            sinon.spy(routerRef.__gstoreApi, 'update');

            routerRef.__gstoreApi.updatePatch(req, res);

            expect(routerRef.__gstoreApi.update.getCall(0).args.length).equal(3);
            expect(routerRef.__gstoreApi.update.getCall(0).args[0]).equal(req);
            expect(routerRef.__gstoreApi.update.getCall(0).args[1]).equal(res);
            assert.isUndefined(routerRef.__gstoreApi.update.getCall(0).args[2]);
        });

        it('should pass options', () => {
            const routerRef = apiBuilder.create(Model, {
                operations: {
                    updatePatch: {
                        options: { readAll: true, simplifyResult: true },
                    },
                },
            });
            sinon.spy(routerRef.__gstoreApi, 'update');

            routerRef.__gstoreApi.updatePatch(req, res);

            expect(routerRef.__gstoreApi.update.getCall(0).args.length).equal(3);
            expect(routerRef.__gstoreApi.update.getCall(0).args[2]).deep.equal({ readAll: true, simplifyResult: true });
        });
    });

    describe('updateReplace()', () => {
        beforeEach(() => {
            sinon.stub(Model, 'update').resolves(entity);
        });

        afterEach(() => {
            Model.update.restore();
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    updateReplace: {
                        handler: () => true,
                    },
                },
            };
            sinon.spy(settings.operations.updateReplace, 'handler');
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi.updateReplace(req, res);

            expect(settings.operations.updateReplace.handler.called).equal(true);
        });

        it('should call update()', () => {
            const routerRef = apiBuilder.create(Model);
            sinon.spy(routerRef.__gstoreApi, 'update');

            routerRef.__gstoreApi.updateReplace(req, res);

            expect(routerRef.__gstoreApi.update.getCall(0).args.length).equal(3);
            expect(routerRef.__gstoreApi.update.getCall(0).args[0]).equal(req);
            expect(routerRef.__gstoreApi.update.getCall(0).args[1]).equal(res);
            expect(routerRef.__gstoreApi.update.getCall(0).args[2]).deep.equal({ replace: true });
        });

        it('should pass options', () => {
            const routerRef = apiBuilder.create(Model, {
                operations: {
                    updateReplace: {
                        options: { readAll: true, simplifyResult: true },
                    },
                },
            });
            sinon.spy(routerRef.__gstoreApi, 'update');

            routerRef.__gstoreApi.updateReplace(req, res);

            expect(routerRef.__gstoreApi.update.getCall(0).args[2]).deep.equal({ replace: true, readAll: true, simplifyResult: true });
        });
    });

    describe('update()', () => {
        beforeEach(() => {
            sinon.stub(Model, 'update').resolves(entity);
        });

        afterEach(() => {
            Model.update.restore();
        });

        it('should call update on Model', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            routerRef.__gstoreApi.update(req, res);

            expect(Model.update.getCall(0).args[0]).equal(123);
        });

        it('should pass ancestors param', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', ancestors: 'Dad' });

            routerRef.__gstoreApi.update(req, res);

            expect(Model.update.getCall(0).args[2]).deep.equal(['Dad', 'ancestor1']);
        });

        it('should read "showKey" from settings', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', showKey: false });

            return routerRef.__gstoreApi.update(req, res)
                    .then(() => {
                        expect(res.json.getCall(0).args[0]).deep.equal(entity.plain());
                        expect(entity.plain.getCall(0).args[0]).deep.equal({ readAll: false, showKey: false });
                    });
        });

        it('should read options', () => {
            const routerRef = apiBuilder.create(Model);

            return routerRef.__gstoreApi.update(req, res, { replace: true, readAll: true, showKey: false })
                        .then(() => {
                            expect(entity.plain.called).equal(true);
                            expect(entity.plain.getCall(0).args[0]).deep.equal({ readAll: true, showKey: false });
                            expect(Model.update.getCall(0).args[5]).deep.equal({ replace: true });
                        });
        });

        it('should deal with error', () => {
            const error = { code: 500, message: 'Houston we got a problem' };
            Model.update.restore();
            sinon.stub(Model, 'update').rejects(error);

            const routerRef = apiBuilder.create(Model, { path: '/users' });

            return routerRef.__gstoreApi.update(req, res)
                        .then(() => {
                            const args = errorsHandler.rpcError.getCall(0).args;
                            expect(args[0]).equal(error);
                            expect(args[1]).equal(res);
                        });
        });
    });

    describe('delete()', () => {
        beforeEach(() => {
            sinon.stub(Model, 'delete').resolves({ success: true });
        });

        afterEach(() => {
            Model.delete.restore();
        });

        it('should call delete on Model', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            return routerRef.__gstoreApi._delete(req, res)
                        .then(() => {
                            expect(Model.delete.getCall(0).args[0]).equal(123);
                            expect(res.json.getCall(0).args[0].success).equal(true);
                        });
        });

        it('should pass ancestors param', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', ancestors: ['GranDad', 'Dad'] });

            routerRef.__gstoreApi._delete(req, res);

            expect(Model.delete.getCall(0).args[1]).deep.equal(['GranDad', 'ancestor1', 'Dad', 'ancestor2']);
        });

        it('should set success to false if no entity deleted', () => {
            Model.delete.restore();
            sinon.stub(Model, 'delete').resolves({ success: false });
            const routerRef = apiBuilder.create(Model, { path: '/users', simplifyResult: true });

            return routerRef.__gstoreApi._delete(req, res)
                        .then(() => {
                            expect(res.json.getCall(0).args[0].success).equal(false);
                        });
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    delete: {
                        handler: () => true,
                    },
                },
            };
            sinon.spy(settings.operations.delete, 'handler');
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi._delete(req, res);

            expect(settings.operations.delete.handler.called).equal(true);
        });

        it('should deal with error', () => {
            const error = { code: 500, message: 'Houston we got a problem' };
            Model.delete.restore();
            sinon.stub(Model, 'delete').rejects(error);

            const routerRef = apiBuilder.create(Model, { path: '/users' });
            return routerRef.__gstoreApi._delete(req, res)
                        .then(() => {
                            const args = errorsHandler.rpcError.getCall(0).args;
                            expect(args[0]).equal(error);
                            expect(args[1]).equal(res);
                        });
        });
    });

    describe('deleteAll()', () => {
        const result = {};
        beforeEach(() => {
            sinon.stub(Model, 'deleteAll').resolves(result);
        });

        afterEach(() => {
            Model.deleteAll.restore();
        });

        it('should call delete on Model', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            return routerRef.__gstoreApi.deleteAll(req, res)
                        .then(() => {
                            expect(Model.deleteAll.called).equal(true);
                            expect(res.json.getCall(0).args[0]).equal(result);
                        });
        });

        it('should pass ancestors param', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users', ancestors: 'Dad' });

            routerRef.__gstoreApi.deleteAll(req, res);

            expect(Model.deleteAll.getCall(0).args[0]).deep.equal(['Dad', 'ancestor1']);
        });

        it('should execute action from settings', () => {
            const settings = {
                path: '/users',
                operations: {
                    deleteAll: {
                        handler: () => true,
                    },
                },
            };
            sinon.spy(settings.operations.deleteAll, 'handler');
            const routerRef = apiBuilder.create(Model, settings);

            routerRef.__gstoreApi.deleteAll(req, res);

            expect(settings.operations.deleteAll.handler.called).equal(true);
        });

        it('should deal with error', () => {
            const error = { code: 500, message: 'Houston we got a problem' };
            Model.deleteAll.restore();
            sinon.stub(Model, 'deleteAll').rejects(error);

            const routerRef = apiBuilder.create(Model, { path: '/users' });
            return routerRef.__gstoreApi.deleteAll(req, res)
                        .then(() => {
                            const args = errorsHandler.rpcError.getCall(0).args;
                            expect(args[0]).equal(error);
                            expect(args[1]).equal(res);
                        });
        });
    });

    describe('routes', () => {
        beforeEach(() => {
            sinon.spy(apiRoute, 'get');
            sinon.spy(apiRoute, 'post');
            sinon.spy(apiRoute, 'put');
            sinon.spy(apiRoute, 'patch');
            sinon.spy(apiRoute, 'delete');
        });

        afterEach(() => {
            apiRoute.get.restore();
            apiRoute.post.restore();
            apiRoute.put.restore();
            apiRoute.patch.restore();
            apiRoute.delete.restore();
        });

        it('--> define 6 operations', () => {
            /* eslint-disable no-unused-vars */
            const routerRef = apiBuilder.create(Model, apiDefaultSettings);

            expect(router.route.callCount).equal(6);
            expect(apiRoute.delete.callCount).equal(1);
        });

        it('--> define all 7 operations if deleteAll exec set to "true"', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                operations: { deleteAll: { exec: true } },
            });

            expect(router.route.callCount).equal(7);
            expect(apiRoute.delete.callCount).equal(2);
        });

        it('--> no define any operations', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                operations: {
                    list: { exec: false },
                    get: { exec: false },
                    create: { exec: false },
                    updatePatch: { exec: false },
                    updateReplace: { exec: false },
                    delete: { exec: false },
                },
            });

            expect(router.route.callCount).equal(0);
        });

        it('should set path', () => {
            const routerRef = apiBuilder.create(Model, { path: '/users' });

            expect(router.route.getCall(0).args[0]).equal('/users');
            expect(router.route.getCall(1).args[0]).equal('/users/:id');
        });

        it('should add ancestors to path (1)', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                ancestors: ['GrandFather', 'Dad'],
            });

            expect(router.route.getCall(1).args[0]).equal('/grand-fathers/:anc0ID/dads/:anc1ID/users/:id');
        });

        it('should add ancestors to path (2)', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                ancestors: ['grand-Father', 'MyDad-1'],
            });

            expect(router.route.getCall(1).args[0]).equal('/grand-fathers/:anc0ID/my-dad-1S/:anc1ID/users/:id');
        });

        it('should add prefix to path', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                operations: {
                    list: { path: { prefix: '/myprefix' } },
                    get: { path: { prefix: '/myprefix' } },
                },
            });
            expect(router.route.getCall(0).args[0]).equal('/myprefix/users');
            expect(router.route.getCall(1).args[0]).equal('/myprefix/users/:id');
        });

        it('should allow array of prefixes', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                operations: {
                    list: { path: { prefix: ['/myprefix1', '/myprefix2'] } },
                    get: { path: { prefix: ['/myprefix1', '/myprefix2'] } },
                },
            });
            expect(router.route.getCall(0).args[0]).equal('/myprefix1/users');
            expect(router.route.getCall(1).args[0]).equal('/myprefix2/users');
            expect(router.route.getCall(2).args[0]).equal('/myprefix1/users/:id');
            expect(router.route.getCall(3).args[0]).equal('/myprefix2/users/:id');
        });

        it('should add suffix to path', () => {
            const routerRef = apiBuilder.create(Model, {
                path: '/users',
                operations: {
                    list: { path: { suffix: '/mysufix' } },
                    get: { path: { suffix: '/mysufix' } },
                },
            });
            expect(router.route.getCall(0).args[0]).equal('/users/mysufix');
            expect(router.route.getCall(1).args[0]).equal('/users/:id/mysufix');
        });

        it('should add LIST middleware', () => {
            const middleware = () => true;
            const settings = {
                path: '/users',
                operations: {
                    list: { middleware },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            const args = apiRoute.get.getCall(0).args;
            expect(args[0]).equal(middleware);
        });

        it('should add GET middleware', () => {
            const middleware = () => true;
            const settings = {
                path: '/users',
                operations: {
                    get: { middleware },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            const args = apiRoute.get.getCall(1).args;
            expect(args[0]).equal(middleware);
        });

        it('should add CREATE middleware', () => {
            const middleware = () => true;
            const settings = {
                path: '/users',
                operations: {
                    create: { middleware },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            const args = apiRoute.post.getCall(0).args;
            expect(args[1]).equal(middleware);
        });

        it('should add UPDATE middleware', () => {
            const middleware = () => true;
            const settings = {
                operations: {
                    updatePatch: { middleware },
                    updateReplace: { middleware },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            const args1 = apiRoute.patch.getCall(0).args;
            const args2 = apiRoute.put.getCall(0).args;
            expect(args1[1]).equal(middleware);
            expect(args2[1]).equal(middleware);
        });

        it('should add DELETE middleware', () => {
            const middleware = () => true;
            const settings = {
                path: '/users',
                operations: {
                    delete: { middleware },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            const args = apiRoute.delete.getCall(0).args;
            expect(args[0]).equal(middleware);
        });

        it('should add DELETE_ALL middleware', () => {
            const middleware = () => true;
            const settings = {
                path: '/users',
                operations: {
                    deleteAll: { exec: true, middleware },
                },
            };

            const routerRef = apiBuilder.create(Model, settings);

            const args = apiRoute.delete.getCall(1).args;
            expect(args[0]).equal(middleware);
        });
    });

    describe('should allow settings()', () => {
        // it('should throw an error if no settings (or settings not object) passed', () => {
        //     const fn1 = () => apiapiRef.default();
        //     const fn2 = () => apiapiRef.default('string');

        //     expect(fn1).throw(Error);
        //     expect(fn2).throw(Error);
        // });

        it('and override defaults', () => {
            delete require.cache[path.resolve('lib/index.js')];

            const settings = {
                host: 'http://api.my-host.com/',
                contexts: {
                    public: '/public',
                    private: '/private',
                },
                readAll: true,
                showKey: true,
            };

            // apiapiRef.default(settings);
            /* eslint-disable */
            gstoreApi = require('../lib')(settings);
            /* eslint-enable */
            apiBuilder = gstoreApi.express(router);

            const routerRef = apiBuilder.create(Model);
            expect(routerRef.__gstoreApi.settings).deep.equal(Object.assign(settings, { path: '/blog-posts' }));
        });
    });
});
