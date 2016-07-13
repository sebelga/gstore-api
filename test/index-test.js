/*jshint -W030 */

'use strict';

var chai    = require('chai');
var expect  = chai.expect;
var sinon   = require('sinon');
var path    = require('path');

var gstore    = require('gstore-node');
var gstoreApi = require('../lib');

var errorsHandler = require('../lib/errorsHandler');

var apiRoute = {
    get :  function() {return true;},
    post:  function() {return true;},
    put:   function() {return true;},
    patch: function() {return true;},
    delete:function() {return true;}
};

var router = {
    name: 'router',
    route : function() {
        return apiRoute;
    }
};

function Datastore() {
    this.key = () => {};
}

gstore.connect(new Datastore());

gstoreApi.init({
    contexts : {
        public: '/public',
        private: '/private'
    },
    router : router
});

describe('Datastore API', function() {
    var schema;
    var Model;
    var req;
    var res;

    var entity = {
        plain : () => {
            return {id:123}
        }
    };

    var apiDefaultSettings = {
        path : '/users'
    };

    beforeEach('Init Model and Schema', function() {
        sinon.spy(router, 'route');

        gstore.models       = {};
        gstore.modelSchemas = {};

        schema = new gstore.Schema({
            title : {type:'string'}
        }, {
            queries : {
                simplifyResult : false
            }
        });

        Model = gstore.model('BlogPost', schema);

        req = {params:{id:123, anc0ID:'ancestor1', anc1ID:'ancestor2'}, body:{title:'Blog Title'}};
        res = {
            status:() => {
                return {json:() => {}}
            },
            json:() => {}
        };

        sinon.spy(res, 'json');
        sinon.spy(errorsHandler, 'rpcError');
        sinon.spy(entity, 'plain');
    });

    afterEach(function() {
        router.route.restore();
        res.json.restore();
        errorsHandler.rpcError.restore();
        entity.plain.restore();
    });

    describe('init()', () => {
        it('should throw an error is no settings passed', () => {
            var fn1 = () => gstoreApi.init();
            var fn2 = () => gstoreApi.init('string');

            expect(fn1).throw(Error);
            expect(fn2).throw(Error);
        });

        it('should throw an error is no router passed or not an Express router', () => {
            var fn1 = () => gstoreApi.init({});
            var fn2 = () => gstoreApi.init({router:function() {}});

            expect(fn1).throw(Error);
            expect(fn2).throw(Error);
        });

        it('should merge settings passed', () => {
            var settings = {
                contexts : {
                    public:'/public',
                    private : '/private'
                },
                router: router
            };

            gstoreApi.init(settings);

            expect(gstoreApi.defaultSettings).deep.equal(settings);
        });
    });

    describe('constructor', () => {
        it('should throw an error if no defaultContext set', () => {
            delete require.cache[path.resolve('lib/index.js')];
            var gstoreApi = require('../lib');

            let fn = () => new gstoreApi(Model, {path:'/users'});

            expect(fn).throw(Error);
        });

        it('should throw error if no model, settings or router passed', () => {
            let fn1 = () => new gstoreApi();
            let fn2 = () => new gstoreApi({});
            let fn3 = () => new gstoreApi({}, {});

            expect(fn1).throw(Error);
            expect(fn2).throw(Error);
            expect(fn3).throw(Error);
        });

        it('should throw an error if path is not a String', () => {
            let fn = () => new gstoreApi(Model, {path:{}});

            expect(fn).throw(Error);
        });

        it('should set its Model', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            expect(dsApi.Model).equal(Model);
        });

        it('should create path if not passed', () => {
            var dsApi = new gstoreApi(Model);

            expect(dsApi.settings.path).equal('/blog-posts');
        });

        it('should read settings from the Model Schema', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            expect(dsApi.settings.simplifyResult).be.false;
        });

        it('should read settings from general settings', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', simplifyResult:'123'}, router);

            expect(dsApi.settings.simplifyResult).equal('123');
        });
    });

    describe('list()', () => {
        var entities = [{id:123}];

        beforeEach(function() {
            sinon.stub(Model, 'list', function(settings, cb) {
                var args = [];
                for (var i = 0; i < arguments.length; i++) {
                    args.push(arguments[i]);
                }
                cb       = args.pop();
                settings = args.length > 0 ? args[0] : undefined;

                return cb(null, entities);
            });
        });

        afterEach(function() {
            Model.list.restore();
        });

        it('should read from general settings', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', simplifyResult:true}, router);

            dsApi.list(req, res);

            expect(Model.list.getCall(0).args[0]).deep.equal({simplifyResult:true});
            expect(res.json.getCall(0).args[0]).equal(entities);
        });

        it('should read options', () => {
            var settings = {
                path:'/users',
                op : {
                    list : {
                        options : {simplifyResult:true}
                    }
                }
            };
            var dsApi = new gstoreApi(Model, settings, router);

            dsApi.list(req, res);

            expect(Model.list.getCall(0).args[0]).deep.equal({simplifyResult:true});
        });

        it('should add ancestors to query', () => {
            var settings1 = {
                path:'/users',
                ancestors : 'Dad'
            };
            var dsApi1 = new gstoreApi(Model, settings1, router);

            var settings2 = {
                path:'/users',
                ancestors : ['GrandFather', 'Dad']
            };
            var dsApi2 = new gstoreApi(Model, settings2, router);

            var settings3 = {
                path:'/users',
                ancestors : ['GrandFather', 'Dad', 'Other']
            };
            var dsApi3 = new gstoreApi(Model, settings3, router);

            dsApi1.list(req, res);
            dsApi2.list(req, res);
            dsApi3.list(req, res);

            expect(Model.list.getCall(0).args[0]).deep.equal({simplifyResult:false, ancestors:['Dad', 'ancestor1']});
            expect(Model.list.getCall(1).args[0]).deep.equal({simplifyResult:false, ancestors:['GrandFather', 'ancestor1', 'Dad', 'ancestor2']});
            expect(Model.list.getCall(2).args[0]).deep.equal({simplifyResult:false, ancestors:['GrandFather', 'ancestor1', 'Dad', 'ancestor2']});
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    list : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.list, 'fn');
            var dsApi = new gstoreApi(Model, settings, router);

            dsApi.list(req, res);

            expect(settings.op.list.fn.called).be.true;
        });

        it('should deal with error', () => {
            var error = {code:500, message:'Houston we got a problem'};

            Model.list.restore();
            sinon.stub(Model, 'list', function(settings, cb) {
                return cb(error);
            });

            var dsApi = new gstoreApi(Model, {path:'/users'});
            dsApi.list(req, res);
            var args = errorsHandler.rpcError.getCall(0).args;
            expect(args[0]).equal(error);
            expect(args[1]).equal(res);
        });
    });

    describe('get()', () => {
        beforeEach(function() {
            sinon.stub(Model, 'get', function(id, cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(null, entity);
            });
        });

        afterEach(function() {
            Model.get.restore();
        });

        it('should call get on Model', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            dsApi.get(req, res);

            expect(Model.get.getCall(0).args[0]).deep.equal(123);
            expect(res.json.getCall(0).args[0]).deep.equal(entity);
        });

        it('should pass ancestors param', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', ancestors:'Dad'});

            dsApi.get(req, res);

            expect(Model.get.getCall(0).args[1]).deep.equal(['Dad', 'ancestor1']);
        });

        it('should set simplifyResult from settings', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', simplifyResult:true}, router);

            dsApi.get(req, res);

            expect(res.json.getCall(0).args[0]).deep.equal(entity.plain());
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    get : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.get, 'fn');
            var dsApi = new gstoreApi(Model, settings, router);

            dsApi.get(req, res);

            expect(settings.op.get.fn.called).be.true;
        });

        it('should read options', () => {
            var settings = {
                path:'/users',
                op : {
                    get : {
                        options : {readAll:true, simplifyResult:true}
                    }
                }
            };

            var dsApi = new gstoreApi(Model, settings, router);

            dsApi.get(req, res);

            expect(entity.plain.called).be.true;
            expect(entity.plain.getCall(0).args[0]).deep.equal({readAll:true});
        });

        it('should deal with error', () => {
            var error = {code:500, message:'Houston we got a problem'};
            Model.get.restore();
            sinon.stub(Model, 'get', function(settings, cb) {
                return cb(error);
            });

            var dsApi = new gstoreApi(Model, {path:'/users'});
            dsApi.get(req, res);

            var args = errorsHandler.rpcError.getCall(0).args;
            expect(args[0]).equal(error);
            expect(args[1]).equal(res);
        });
    });

    describe('create()', () => {
        var entity;

        schema = new gstore.Schema({
            title : {type:'stirng'}
        }, {
            queries : {
                simplifyResult : false
            }
        });

        Model = gstore.model('Blog', schema);

        var namespace = {Model: Model};

        beforeEach(function() {
            entity = new Model(req.body);

            sinon.stub(entity, 'save', function(cb) {
                return cb(null, entity);
            });

            sinon.stub(entity, 'plain').returns(0);

            sinon.stub(namespace, 'Model', function() {
                return entity;
            });

            namespace.Model.sanitize = function() {};
        });

        afterEach(function() {
            entity.save.restore();
            entity.plain.restore();
            namespace.Model.restore();
        });

        it('should call save on Model', () => {
            var dsApi = new gstoreApi(namespace.Model, {path:'/users'});

            dsApi.create(req, res, entity);

            expect(entity.save.called).be.true;
            expect(res.json.called).be.true;
            expect(entity.plain.called).be.false;
        });

        it('should pass ancestors param', () => {
            var dsApi = new gstoreApi(namespace.Model, {path:'/users', ancestors:['GrandFather', 'Dad']});

            dsApi.create(req, res);

            expect(namespace.Model.getCall(0).args[2]).deep.equal(['GrandFather', 'ancestor1', 'Dad', 'ancestor2']);
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    create : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.create, 'fn');
            var dsApi = new gstoreApi(namespace.Model, settings, router);

            dsApi.create(req, res);

            expect(settings.op.create.fn.called).be.true;
        });

        it('should read options', () => {
            var settings = {
                path:'/users',
                op : {
                    create : {
                        options : {readAll:true, simplifyResult:true}
                    }
                }
            };

            var dsApi = new gstoreApi(namespace.Model, settings, router);

            dsApi.create(req, res);

            expect(entity.plain.called).be.true;
            expect(entity.plain.getCall(0).args[0]).deep.equal({readAll:true});
        });

        it('should deal with error', () => {
            entity.save.restore();
            var error = {code:500, message:'Houston we got a problem'};

            sinon.stub(entity, 'save', function(cb) {
                return cb(error);
            });

            var dsApi = new gstoreApi(namespace.Model, {path:'/users'});
            dsApi.create(req, res);

            var args = errorsHandler.rpcError.getCall(0).args;
            expect(args[0]).equal(error);
            expect(args[1]).equal(res);
        });
    });

    describe('updatePatch()', () => {
        beforeEach(function() {
            sinon.stub(Model, 'update', function(id, data, cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(null, entity);
            });
        });

        afterEach(function() {
            Model.update.restore();
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    updatePatch : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.updatePatch, 'fn');
            var dsApi = new gstoreApi(Model, settings);

            dsApi.updatePatch(req, res);

            expect(settings.op.updatePatch.fn.called).be.true;
        });

        it('should call update()', () => {
            var dsApi = new gstoreApi(Model);
            sinon.spy(dsApi, 'update');

            dsApi.updatePatch(req, res);

            expect(dsApi.update.getCall(0).args.length).equal(3);
            expect(dsApi.update.getCall(0).args[0]).equal(req);
            expect(dsApi.update.getCall(0).args[1]).equal(res);
            expect(dsApi.update.getCall(0).args[2]).not.exist;
        });

        it('should pass options', () => {
            var dsApi = new gstoreApi(Model, {
                op : {
                    updatePatch : {
                        options : {readAll:true, simplifyResult:true}
                    }
                }
            });
            sinon.spy(dsApi, 'update');

            dsApi.updatePatch(req, res);

            expect(dsApi.update.getCall(0).args.length).equal(3);
            expect(dsApi.update.getCall(0).args[2]).deep.equal({readAll:true, simplifyResult:true});
        });
    });

    describe('updateReplace()', () => {
        beforeEach(function() {
            sinon.stub(Model, 'update', function(id, data, cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(null, entity);
            });
        });

        afterEach(function() {
            Model.update.restore();
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    updateReplace : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.updateReplace, 'fn');
            var dsApi = new gstoreApi(Model, settings);

            dsApi.updateReplace(req, res);

            expect(settings.op.updateReplace.fn.called).be.true;
        });

        it('should call update()', () => {
            var dsApi = new gstoreApi(Model);
            sinon.spy(dsApi, 'update');

            dsApi.updateReplace(req, res);

            expect(dsApi.update.getCall(0).args.length).equal(3);
            expect(dsApi.update.getCall(0).args[0]).equal(req);
            expect(dsApi.update.getCall(0).args[1]).equal(res);
            expect(dsApi.update.getCall(0).args[2]).deep.equal({replace:true});
        });

        it('should pass options', () => {
            var dsApi = new gstoreApi(Model, {
                op : {
                    updateReplace : {
                        options : {readAll:true, simplifyResult:true}
                    }
                }
            });
            sinon.spy(dsApi, 'update');

            dsApi.updateReplace(req, res);

            expect(dsApi.update.getCall(0).args[2]).deep.equal({replace:true, readAll:true, simplifyResult:true});
        });
    });

    describe('update()', () => {
        beforeEach(function() {
            sinon.stub(Model, 'update', function(id, data, cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(null, entity);
            });
        });

        afterEach(function() {
            Model.update.restore();
        });

        it('should call update on Model', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            dsApi.update(req, res);

            expect(Model.update.getCall(0).args[0]).equal(123);
        });

        it('should pass ancestors param', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', ancestors:'Dad'});

            dsApi.update(req, res);

            expect(Model.update.getCall(0).args[2]).deep.equal(['Dad', 'ancestor1']);
        });

        it('should set simplifyResult from settings', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', simplifyResult:true}, router);

            dsApi.update(req, res);

            expect(res.json.getCall(0).args[0]).deep.equal(entity.plain());
        });

        it('should read options', () => {
            var dsApi = new gstoreApi(Model);

            dsApi.update(req, res, {replace:true, readAll:true, simplifyResult:true});

            expect(entity.plain.called).be.true;
            expect(entity.plain.getCall(0).args[0]).deep.equal({readAll:true});
            expect(Model.update.getCall(0).args[5]).deep.equal({replace:true});
        });

        it('should deal with error', () => {
            var error = {code:500, message:'Houston we got a problem'};
            Model.update.restore();
            sinon.stub(Model, 'update', function(id, data, cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(error);
            });

            var dsApi = new gstoreApi(Model, {path:'/users'});
            dsApi.update(req, res);

            var args = errorsHandler.rpcError.getCall(0).args;
            expect(args[0]).equal(error);
            expect(args[1]).equal(res);
        });
    });

    describe('delete()', () => {
        beforeEach(function() {
            sinon.stub(Model, 'delete', function(id, cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(null, {success:true});
            });
        });

        afterEach(function() {
            Model.delete.restore();
        });

        it('should call delete on Model', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            dsApi._delete(req, res);

            expect(Model.delete.getCall(0).args[0]).equal(123);
            expect(res.json.getCall(0).args[0].success).be.true;
        });

        it('should pass ancestors param', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', ancestors:['GranDad', 'Dad']});

            dsApi._delete(req, res);

            expect(Model.delete.getCall(0).args[1]).deep.equal(['GranDad', 'ancestor1', 'Dad', 'ancestor2']);
        });

        it('should set success to false if no entity deleted', () => {
            Model.delete.restore();
            sinon.stub(Model, 'delete', function(id, cb) {
                return cb(null, {success:false});
            });
            var dsApi = new gstoreApi(Model, {path:'/users', simplifyResult:true}, router);

            dsApi._delete(req, res);

            expect(res.json.getCall(0).args[0].success).be.false;
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    delete : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.delete, 'fn');
            var dsApi = new gstoreApi(Model, settings, router);

            dsApi._delete(req, res);

            expect(settings.op.delete.fn.called).be.true;
        });

        it('should deal with error', () => {
            var error = {code:500, message:'Houston we got a problem'};
            Model.delete.restore();
            sinon.stub(Model, 'delete', function(id, cb) {
                return cb(error);
            });

            var dsApi = new gstoreApi(Model, {path:'/users'});
            dsApi._delete(req, res);

            var args = errorsHandler.rpcError.getCall(0).args;
            expect(args[0]).equal(error);
            expect(args[1]).equal(res);
        });
    });

    describe('deleteAll()', () => {
        var result = {};
        beforeEach(function() {
            sinon.stub(Model, 'deleteAll', function(cb) {
                let args = Array.prototype.slice.apply(arguments);
                cb = args.pop();
                return cb(null, result);
            });
        });

        afterEach(function() {
            Model.deleteAll.restore();
        });

        it('should call delete on Model', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            dsApi.deleteAll(req, res);

            expect(Model.deleteAll.called).be.true;
            expect(res.json.getCall(0).args[0]).equal(result);
        });

        it('should pass ancestors param', () => {
            var dsApi = new gstoreApi(Model, {path:'/users', ancestors:'Dad'});

            dsApi.deleteAll(req, res);

            expect(Model.deleteAll.getCall(0).args[0]).deep.equal(['Dad', 'ancestor1']);
        });

        it('should execute action from settings', () => {
            var settings = {
                path:'/users',
                op : {
                    deleteAll : {
                        fn : () => true
                    }
                }
            };
            sinon.spy(settings.op.deleteAll, 'fn');
            var dsApi = new gstoreApi(Model, settings, router);

            dsApi.deleteAll(req, res);

            expect(settings.op.deleteAll.fn.called).be.true;
        });

        it('should deal with error', () => {
            var error = {code:500, message:'Houston we got a problem'};
            Model.deleteAll.restore();
            sinon.stub(Model, 'deleteAll', function(cb) {
                return cb(error);
            });

            var dsApi = new gstoreApi(Model, {path:'/users'});
            dsApi.deleteAll(req, res);

            var args = errorsHandler.rpcError.getCall(0).args;
            expect(args[0]).equal(error);
            expect(args[1]).equal(res);
        });
    });

    describe('routes', () => {
        beforeEach(function() {
            sinon.spy(apiRoute, 'get');
            sinon.spy(apiRoute, 'post');
            sinon.spy(apiRoute, 'put');
            sinon.spy(apiRoute, 'patch');
            sinon.spy(apiRoute, 'delete');
        });

        afterEach(function() {
            apiRoute.get.restore();
            apiRoute.post.restore();
            apiRoute.put.restore();
            apiRoute.patch.restore();
            apiRoute.delete.restore();
        });

        it('--> define 6 operations', () => {
            var dsApi = new gstoreApi(Model, apiDefaultSettings);

            expect(router.route.callCount).equal(6);
            expect(apiRoute.delete.callCount).equal(1);
        });

        it('--> define all 7 operations if deleteAll exec set to "true"', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                op:{deleteAll:{exec:true}}
            });

            expect(router.route.callCount).equal(7);
            expect(apiRoute.delete.callCount).equal(2);
        });

        it('--> no define any operations', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                op : {
                    list:          {exec: false},
                    get:           {exec: false},
                    create:        {exec: false},
                    updatePatch:   {exec: false},
                    updateReplace: {exec: false},
                    delete:        {exec: false}
                }
            });

            expect(router.route.callCount).equal(0);
        });

        it('should set path', () => {
            var dsApi = new gstoreApi(Model, {path:'/users'});

            expect(router.route.getCall(0).args[0]).equal('/public/users');
            expect(router.route.getCall(1).args[0]).equal('/public/users/:id');
        });

        it('should add ancestors to path (1)', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                ancestors : ['GrandFather', 'Dad']
            });

            expect(router.route.getCall(1).args[0]).equal('/public/grand-father/:anc0ID/dad/:anc1ID/users/:id');
        });

        it('should add ancestors to path (2)', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                ancestors : ['grand-Father', 'MyDad-1']
            });

            expect(router.route.getCall(1).args[0]).equal('/public/grand-father/:anc0ID/my-dad-1/:anc1ID/users/:id');
        });

        it('should add prefix to path', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                op : {
                    list: {path:{prefix:'/myprefix'}},
                    get:  {path:{prefix:'/myprefix'}}
                }
            });
            expect(router.route.getCall(0).args[0]).equal('/myprefix/users');
            expect(router.route.getCall(1).args[0]).equal('/myprefix/users/:id');
        });

        it('should allow array of prefixes', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                op : {
                    list: {path:{prefix:['/myprefix1', '/myprefix2']}},
                    get:  {path:{prefix:['/myprefix1', '/myprefix2']}}
                }
            });
            expect(router.route.getCall(0).args[0]).equal('/myprefix1/users');
            expect(router.route.getCall(1).args[0]).equal('/myprefix2/users');
            expect(router.route.getCall(2).args[0]).equal('/myprefix1/users/:id');
            expect(router.route.getCall(3).args[0]).equal('/myprefix2/users/:id');
        });

        it('should add sufix to path', () => {
            var dsApi = new gstoreApi(Model, {
                path:'/users',
                op : {
                    list: {path:{sufix:'/mysufix'}},
                    get:  {path:{sufix:'/mysufix'}}
                }
            });
            expect(router.route.getCall(0).args[0]).equal('/public/users/mysufix');
            expect(router.route.getCall(1).args[0]).equal('/public/users/:id/mysufix');
        });

        it('should add LIST middelware', () => {
            var middelware = () => true;
            var settings = {
                path:'/users',
                op : {
                    list:   {middelware: middelware},
                }
            };

            new gstoreApi(Model, settings);

            var args = apiRoute.get.getCall(0).args;
            expect(args[0][0]).equal(middelware);
        });

        it('should add GET middelware', () => {
            var middelware = () => true;
            var settings = {
                path:'/users',
                op : {
                    get: {middelware: middelware}
                }
            };

            new gstoreApi(Model, settings);

            var args = apiRoute.get.getCall(1).args;
            expect(args[0][0]).equal(middelware);
        });

        it('should add CREATE middelware', () => {
            var middelware = () => true;
            var settings = {
                path:'/users',
                op : {
                    create: {middelware: middelware}
                }
            };

            new gstoreApi(Model, settings);

            var args = apiRoute.post.getCall(0).args;
            expect(args[0][0]).equal(middelware);
        });

        it('should add UPDATE middelware', () => {
            var middelware = () => true;
            var settings = {
                op : {
                    updatePatch: {middelware: middelware},
                    updateReplace: {middelware: middelware}
                }
            };

            new gstoreApi(Model, settings);

            var args1 = apiRoute.patch.getCall(0).args;
            var args2 = apiRoute.put.getCall(0).args;
            expect(args1[0][0]).equal(middelware);
            expect(args2[0][0]).equal(middelware);
        });

        it('should add DELETE middelware', () => {
            var middelware = () => true;
            var settings = {
                path:'/users',
                op : {
                    delete: {middelware: middelware}
                }
            };

            new gstoreApi(Model, settings);

            var args = apiRoute.delete.getCall(0).args;
            expect(args[0][0]).equal(middelware);
        });

        it('should add DELETE_ALL middelware', () => {
            var middelware = () => true;
            var settings = {
                path:'/users',
                op : {
                    deleteAll: {exec:true, middelware: middelware}
                }
            };

            new gstoreApi(Model, settings);

            var args = apiRoute.delete.getCall(1).args;
            expect(args[0][0]).equal(middelware);
        });
    });
});
