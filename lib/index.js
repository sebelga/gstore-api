'use strict';

const is            = require('is');
const extend        = require('extend');
const errorsHandler = require('./errorsHandler');
const arrify        = require('arrify');
const S             = require('string');
const pluralize     = require('pluralize');

const OPERATIONS = ['list', 'get', 'create', 'updatePatch', 'updateReplace', 'delete', 'deleteAll'];

class DatastoreApi {
    /**
     * DatastoreApi constructor
     * Model is an gstore-node Model definition
     * settings is an object with the following properties
     {
         path:'/users',
         simplifyResult: true, // (optional) default true
         operations : {     // (optional)
             list:   {}, // see createRoutes() below for the properties of each operation
             get:    {},
             create: {},
             update: {},
             delete: {},
             deleteAll : {}
         }
     }
     */
    constructor(Model, settings) {
        this._validate(Model, settings);

        let schemaSettings = {
            simplifyResult : Model.schema.options.queries.simplifyResult
        };

        this.Model    = Model;
        this.settings = extend(true, {}, this.constructor.defaultSettings, schemaSettings, settings);

        /**
         * If no path passed, create automatically accorind to entityKind from Model
         * It automatically pluralize the path
         * ex : entityKind = 'BlogPost' ---> path = 'blog-posts'
         */
        if (!this.settings.hasOwnProperty('path')) {
            let path = pathFromEntityKind(this.Model.entityKind);

            this.settings.path = '/' + path;
        }

        createRoutes(this);
    }

    /**
     * Init gstoreApi with global settings
     {
         router : expressRouterInstance,
         contexts : { // (optional)
             public : '',
             private : '/private',
         }
     }
     */
    static init(settings) {
        if (!settings || !is.object(settings)) {
            throw new Error('Settings must be an object');
        }

        if (!settings.router || settings.router.name !== 'router') {
            throw new Error('Router missing or wrong type.');
        }

        this.defaultSettings = {
            host : '',
            contexts: {
                public  : '',
                private : ''
            },
            simplifyResult: true
        };

        this.defaultSettings        = extend(true, this.defaultSettings, settings);
        this.defaultSettings.router = settings.router; // need to re-write because extend loose reference
    }

    _validate(Model, settings) {
        if (!Model) {
            throw new Error('Model missing');
        }

        if (!this.constructor.defaultSettings) {
            throw new Error('You must initialize datastore-api before creating instances.');
        }

        if (settings && settings.hasOwnProperty('path') && !is.string(settings.path)) {
            throw new Error('Path must be a string');
        }
    }

    list(req, res) {
        let _this      = this;
        let listConfig = this.settings.op && this.settings.op.hasOwnProperty('list') ? this.settings.op.list : {};

        if (listConfig.fn) {
            listConfig.fn(req, res);
        } else {
            let options   = listConfig.options || {};
            let simplify  = options.hasOwnProperty('simplifyResult') ? options.simplifyResult : this.settings.simplifyResult;
            let ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
            let settings  = {
                simplifyResult:simplify
            };

            if (ancestors) {
                settings.ancestors = ancestors;
            }

            this.Model.list(settings, (err, result) => {
                if (err) {
                    return errorsHandler.rpcError(err, res);
                }
                if (result.nextPageCursor) {
                    // var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
                    res.set('Link', '<' + _this.settings.host + req.originalUrl + '?pageCursor=' + result.nextPageCursor + '>; rel=next');
                }
                res.json(result.entities);
            });
        }
    }

    get(req, res) {
        var _this     = this;
        let getConfig = this.settings.op && this.settings.op.hasOwnProperty('get') ? this.settings.op.get : {};

        if (getConfig.fn) {
            getConfig.fn(req, res);
        } else {

            let options   = getConfig.options || {};
            let ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
            let args      = ancestors ? [req.params.id, ancestors, onEntity] : [req.params.id, onEntity];

            this.Model.get.apply(this.Model, args);

            //////////

            function onEntity(err, entity) {
                if (err) {
                    return errorsHandler.rpcError(err, res);
                }

                let plainOptions = {
                    readAll:options.readAll || false
                }

                let simplify = options.hasOwnProperty('simplifyResult') ? options.simplifyResult : _this.settings.simplifyResult;

                res.json(simplify ? entity.plain(plainOptions) : entity);
            }
        }
    }

    create(req, res, temp) {
        let _this        = this;
        let createConfig = this.settings.op && this.settings.op.hasOwnProperty('create') ? this.settings.op.create : {};

        if (createConfig.fn) {
            createConfig.fn(req, res);
        } else {
            let data      = this.Model.sanitize(req.body);
            let ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
            let model     = ancestors ? new this.Model(data, null, ancestors) : new this.Model(data);
            let options   = createConfig.options || {};

            model.save((err, entity) => {
                if (err) {
                    return errorsHandler.rpcError(err, res);
                }

                let plainOptions = {
                    readAll:options.readAll || false
                };

                let simplify = options.hasOwnProperty('simplifyResult') ? options.simplifyResult : _this.settings.simplifyResult;

                res.json(simplify ? entity.plain(plainOptions) : entity);
            });
        }
    }

    updatePatch(req, res) {
        let updateConfig = this.settings.op && this.settings.op.hasOwnProperty('updatePatch') ? this.settings.op.updatePatch : {};
        if (updateConfig.fn) {
            updateConfig.fn(req, res);
        } else {
            this.update(req, res, updateConfig.options);
        }
    }

    updateReplace(req, res) {
        let updateConfig = this.settings.op && this.settings.op.hasOwnProperty('updateReplace') ? this.settings.op.updateReplace : {};
        if (updateConfig.fn) {
            updateConfig.fn(req, res);
        } else {
            let options = updateConfig.options || {};
            options.replace = true;
            this.update(req, res, options);
        }
    }

    update(req, res, options) {
        options = typeof options === 'undefined' ? {} : options;

        let _this     = this;
        let data      = this.Model.sanitize(req.body);
        let ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
        let args      = ancestors ? [req.params.id, data, ancestors, onUpdate] : [req.params.id, data, null, onUpdate];

        if (options.replace === true) {
            args.splice(3, 0, null, null, {replace:true});
        }

        this.Model.update.apply(this.Model, args);

        /////////

        function onUpdate(err, entity) {
            if (err) {
                return errorsHandler.rpcError(err, res);
            };

            let plainOptions = {
                readAll:options.readAll || false
            };

            let simplify = options.hasOwnProperty('simplifyResult') ? options.simplifyResult : _this.settings.simplifyResult;

            res.json(simplify ? entity.plain(plainOptions) : entity);
        }
    }

    _delete(req, res) {
        let deleteConfig = this.settings.op && this.settings.op.hasOwnProperty('delete') ? this.settings.op.delete : {};

        if (deleteConfig.fn) {
            deleteConfig.fn(req, res);
        } else {
            let _this     = this;
            let ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
            let args      = ancestors ? [req.params.id, ancestors, onDelete] : [req.params.id, onDelete];

            this.Model.delete.apply(this.Model, args);

            //////////

            function onDelete(err, result) {
                if (err) {
                    return errorsHandler.rpcError(err, res);
                }

                if (result.success) {
                    res.json({
                        success : true,
                        message : _this.Model.entityKind + ' "' + req.params.id + '" deleted successfully.'
                    });
                } else {
                    res.json({
                        success : false,
                        message : 'Could not delete entity. ' + _this.Model.entityKind + ' "' + req.params.id + '" not found'
                    });
                }
            }
        }
    }

    deleteAll(req, res) {
        let deleteAllConfig = this.settings.op && this.settings.op.hasOwnProperty('deleteAll') ? this.settings.op.deleteAll : {};

        if (deleteAllConfig.fn) {
            deleteAllConfig.fn(req, res);
        } else {
            let ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
            let args      = ancestors ? [ancestors, onDelete] : [onDelete];

            this.Model.deleteAll.apply(this.Model, args);

            //////////

            function onDelete(err, result) {
                if (err) {
                    return errorsHandler.rpcError(err, res);
                }
                res.json(result);
            }
        }
    }
}

/**
 * Function that loops through each of the operation and creates it
 * Each operation can be customized in the settings with an object:
 * create : {
                exec:       true, // default true except for "deleteAll"" wich defaults to false
                middelware: myMiddelware.method,
                fn:         myController.method,
                path : {
                    prefix: 'some-prefix',
                    suffix:  'some-suffix'
                }
            }
 */
function createRoutes(self) {
    let settings   = self.settings;
    let router     = self.constructor.defaultSettings.router;
    let pathWithId = ['get', 'updatePatch', 'updateReplace',  'delete'];

    OPERATIONS.forEach((op) => {
        let config = settings.op && settings.op[op] ? settings.op[op] : {};

        if (config.exec === false || (op === 'deleteAll' && config.exec !== true)) {
            // For security reason deleteAll must be explicitly set to true
            return;
        }

        let prefix = '';
        if (isPublic(op)) {
            prefix = settings.contexts.public;
        } else {
            prefix = settings.contexts.private;
        }
        prefix = config && config.path && config.path.prefix ? config.path.prefix : prefix;

        let prefixs    = arrify(prefix);
        let suffix      = config && config.path && config.path.suffix ? config.path.suffix : '';
        let middelware = config.middelware ? [config.middelware] : null;
        let ancestors  = settings.hasOwnProperty('ancestors') ? arrify(settings.ancestors) : undefined;

        let paths = [];
        prefixs.forEach((prefix) => {
            if (ancestors) {
                ancestors.forEach((ancestor, index) => {
                    prefix += '/' + pathFromEntityKind(ancestor) + '/:anc' + index + 'ID';
                });
            }
            let path = pathWithId.indexOf(op) < 0 ? prefix + settings.path + suffix : prefix + settings.path + '/:id' + suffix;
            paths.push(path);
        });

        let verb   = verbAction(op, config.options);
        let method = op === 'delete' ? '_delete' : op;

        if (middelware) {
            paths.forEach((path) => {
                router.route(path)[verb](middelware, self[method].bind(self));
            });
        } else {
            paths.forEach((path) => {
                router.route(path)[verb](self[method].bind(self));
            });
        }
    });

    function isPublic(op) {
        switch (op) {
            case 'list':
            case 'get':
                return true;
            default:
                return false;
        }
    }

    function verbAction(op, options) {
        options = typeof options === 'undefined' ? {} : options;
        switch (op) {
            case 'list':
            case 'get':
                return 'get';
            case 'create':
                return 'post';
            case 'updatePatch':
                return 'patch';
            case 'updateReplace':
                return 'put';
            case 'delete':
            case 'deleteAll':
                return 'delete';
        }
    }
}

/**
 * Build Ancestors Array from request params and ancestors setting
 * Ex: for a route /blog/nameblog/blogpost/123 and ancestor setting 'Blog'
 * ---> returns array ['Blog', 'nameblog']
 */
function ancestorsFromParams(params, ancestors) {
    if (!ancestors) {
        return null;
    }

    let arr   = [];
    ancestors = arrify(ancestors);

    ancestors.forEach((ancestor, index) => {
        let id = 'anc' + index + 'ID';
        if (!params[id]) {
            return;
        }
        arr = arr.concat([ancestor, params[id]])
    });

    return arr;
}

function pathFromEntityKind(entityKind) {
    let path = entityKind.substr(0,1).toLowerCase() + entityKind.substr(1);
    path     = S(path).dasherize().s;
    path     = pluralize(path, 2);

    return path;
}

module.exports = DatastoreApi;
