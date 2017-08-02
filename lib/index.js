'use strict';

const is = require('is');
const bodyParser = require('body-parser');
const extend = require('extend');
const errorsHandler = require('./errorsHandler');
const arrify = require('arrify');
const S = require('string');
const pluralize = require('pluralize');

const OPERATIONS = ['list', 'get', 'create', 'updatePatch', 'updateReplace', 'delete', 'deleteAll'];

class ApiBuilder {
    constructor(Model, settings) {
        if (!Model) {
            throw new Error('Model missing');
        }

        if (settings && {}.hasOwnProperty.call(settings, 'path') && !is.string(settings.path)) {
            throw new Error('Path must be a string');
        }

        const modelSettings = {
            readAll: Model.schema.options.queries.readAll,
            showKey: Model.schema.options.queries.showKey,
        };

        this.Model = Model;
        this.settings = extend(true, {}, this.constructor.defaultSettings, modelSettings, this.constructor.overrides, settings);

        /**
         * If no path passed, auto generate path from Entity Kind
         * It automatically pluralize the path
         * ex : Entity Kind 'BlogPost' ---> path = 'blog-posts'
         */
        if (!{}.hasOwnProperty.call(this.settings, 'path')) {
            const path = pathFromEntityKind(this.Model.entityKind);

            this.settings.path = `/${path}`;
        }

        createRoutes(this);

        return this;
    }

    /**
     * Add override settings that take over the default settings
     * and the Model "queries" settings (for showKey and readAll)
     {
         readAll: true | false,
         showKey: true | false,
         contexts : { // (optional)
             public : '',
             private : '/private',
         }
     }
     */
    static setOverrides(settings) {
        this.overrides = Object.assign({}, settings);
    }

    list(req, res) {
        const opConfig = operationConfig(this.settings, 'list');

        // If a function is passed for "list" execute it
        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        const _this = this;
        const options = opConfig.options || {};
        const ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
        const settings = extend(true, {}, options);

        if (!{}.hasOwnProperty.call(settings, 'showKey')) {
            settings.showKey = this.settings.showKey;
        }

        if (ancestors) {
            settings.ancestors = ancestors;
        }

        if (req.query.pageCursor) {
            settings.start = req.query.pageCursor;
        }

        return this.Model.list(settings)
                            .then((response) => {
                                if (response.nextPageCursor) {
                                    /**
                                     * Add Link Header to response
                                     */
                                    let uri = _this.settings.host || `${req.protocol}://${req.get('host')}`;
                                    req.originalUrl = req.originalUrl.replace(/\?pageCursor=[^&]+/, '');
                                    uri += `${req.originalUrl}?pageCursor=${response.nextPageCursor}`;
                                    res.set('Link', `<${uri}>; rel="next"`);
                                }

                                return res.json(response.entities);
                            })
                            .catch(err => errorsHandler.rpcError(err, res));
    }

    get(req, res) {
        const opConfig = operationConfig(this.settings, 'get');

        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        const _this = this;
        const options = opConfig.options || {};
        const ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
        const args = ancestors ? [req.params.id, ancestors] : [req.params.id];

        return this.Model.get.apply(this.Model, args)
                            .then((entity) => {
                                const plainOptions = {
                                    readAll: typeof options.readAll === 'undefined' ? _this.settings.readAll : options.readAll,
                                    showKey: typeof options.showKey === 'undefined' ? _this.settings.showKey : options.showKey,
                                };

                                return res.json(entity.plain(plainOptions));
                            })
                            .catch(err => errorsHandler.rpcError(err, res));
    }

    create(req, res) {
        const _this = this;
        const opConfig = operationConfig(this.settings, 'create');

        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        if (req.file) {
            return res.status(500).send('File upload must be handle in custom handlers');
        }

        const data = this.Model.sanitize(req.body);
        const ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
        const model = ancestors ? new this.Model(data, null, ancestors) : new this.Model(data);
        const options = opConfig.options || {};

        return model.save()
                    .then((entity) => {
                        const plainOptions = {
                            readAll: typeof options.readAll === 'undefined' ? _this.settings.readAll : options.readAll,
                            showKey: typeof options.showKey === 'undefined' ? _this.settings.showKey : options.showKey,
                        };

                        res.location(`${req.path}/${entity.plain(plainOptions).id}`);
                        return res.status(201).json(entity.plain(plainOptions));
                    })
                    .catch(err => errorsHandler.rpcError(err, res));
    }

    updatePatch(req, res) {
        const opConfig = operationConfig(this.settings, 'updatePatch');

        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        return this.update(req, res, opConfig.options);
    }

    updateReplace(req, res) {
        const opConfig = operationConfig(this.settings, 'updateReplace');

        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        const options = opConfig.options || {};
        options.replace = true;
        return this.update(req, res, options);
    }

    update(req, res, options) {
        options = typeof options === 'undefined' ? {} : options;

        const _this = this;
        const data = this.Model.sanitize(req.body);
        const ancestors = ancestorsFromParams(req.params, this.settings.ancestors);

        let args = ancestors ? [req.params.id, data, ancestors] : [req.params.id, data, null];

        if (options.replace === true) {
            args = args.concat([null, null, { replace: true }]);
        }

        return this.Model.update.apply(this.Model, args)
                                .then((entity) => {
                                    const plainOptions = {
                                        readAll: typeof options.readAll === 'undefined' ? _this.settings.readAll : options.readAll,
                                        showKey: typeof options.showKey === 'undefined' ? _this.settings.showKey : options.showKey,
                                    };

                                    return res.json(entity.plain(plainOptions));
                                })
                                .catch(err => errorsHandler.rpcError(err, res));
    }

    _delete(req, res) {
        const opConfig = operationConfig(this.settings, 'delete');

        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        const _this = this;
        const ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
        const args = ancestors ? [req.params.id, ancestors] : [req.params.id];

        return this.Model.delete.apply(this.Model, args)
                                .then((response) => {
                                    if (response.success) {
                                        return res.json({
                                            success: true,
                                            message: `${_this.Model.entityKind} "${req.params.id}" deleted successfully.`,
                                        });
                                    }

                                    return res.json({
                                        success: false,
                                        message: `Could not delete entity. ${_this.Model.entityKind} "${req.params.id}" not found`,
                                    });
                                })
                                .catch(err => errorsHandler.rpcError(err, res));
    }

    deleteAll(req, res) {
        const opConfig = operationConfig(this.settings, 'deleteAll');

        if (opConfig.handler) {
            return opConfig.handler(req, res);
        }

        const ancestors = ancestorsFromParams(req.params, this.settings.ancestors);
        const args = ancestors ? [ancestors] : [];

        return this.Model.deleteAll.apply(this.Model, args)
                                    .then(response => res.json(response))
                                    .catch(err => errorsHandler.rpcError(err, res));
    }
}

ApiBuilder.defaultSettings = {
    contexts: {
        public: '',
        private: '',
    },
    readAll: false,
    showKey: false,
};

/**
 * ApiBuilder create
 * @param {*} Model  -- gstore-node Model
 * @param {*} settings -- configuration settings
 *
 * settings is an object with the following parameters
 {
     path:'/users', -- (optional) the path for the resource. If not passed will be autogenerated
     showKey: true | false -- (default false)
     readAll: true | false (default false)
     operations: {
         list: { ... },
         get: { ... },
         create: { ... },
         update: { ... },
         delete: { ... },
         deleteAll: { ... }
     }
 }
 */
// const create = (Model, settings) => new ApiBuilder(Model, settings);

/**
 * Express Api builder
 *
 * @param {Router} router -- Express Router
 */
const express = (router) => {
    if (!router) {
        throw new Error('Router missing or wrong type.');
    }

    ApiBuilder.engine = 'express';
    ApiBuilder.router = router;

    return {
        create: (Model, settings) => {
            const api = new ApiBuilder(Model, settings);
            router.__gstoreApi = api;
            return router;
        },
    };
};

/**
 * Function that loops through each of the operation and creates a route for it
 * Each operation can be customized in the settings with an object:
 * {
        exec: true, // default "true"" except for "deleteAll"" wich defaults to false
        middleware: someMiddlewareMethod,
        handler: someControllerMethod,
        path : {
            prefix: 'some-prefix',
            suffix: 'some-suffix',
        },
    }
 */
function createRoutes(self) {
    const settings = self.settings;
    const pathWithId = ['get', 'updatePatch', 'updateReplace', 'delete'];
    const verbWithBody = ['create', 'updatePatch', 'updateReplace'];
    const router = self.constructor.router;

    OPERATIONS.forEach((operation) => {
        const config = operationConfig(settings, operation);

        if (!executeOperation(operation, config)) {
            return;
        }

        const prefixes = getPrefixes(operation, config);
        const suffix = config && config.path && config.path.suffix ? config.path.suffix : '';
        const ancestors = {}.hasOwnProperty.call(settings, 'ancestors') ? arrify(settings.ancestors) : undefined;
        const paths = [];
        const verb = operationToVerb(operation);
        const method = operation === 'delete' ? '_delete' : operation;

        let middleware = verbWithBody.indexOf(method) >= 0 ? [bodyParser.json()] : [];
        middleware = config.middleware ? middleware.concat(arrify(config.middleware)) : middleware;

        prefixes.forEach((prefix) => {
            if (ancestors) {
                ancestors.forEach((ancestor, index) => {
                    prefix += `/${pathFromEntityKind(ancestor)}/:anc${index}ID`;
                });
            }
            const path = pathWithId.indexOf(operation) < 0 ? prefix + settings.path + suffix : `${prefix + settings.path}/:id${suffix}`;
            paths.push(path);
        });

        const args = middleware.concat([self[method].bind(self)]);
        paths.forEach((path) => {
            const route = router.route(path);
            route[verb].apply(route, args);
        });
    });

    /**
     * Check if the operation is active and should be executed (route created)
     * @param {*} operation -- the operation
     * @param {object} operationConfig -- config of the operation
     * @returns {boolean} -- active or not
     */
    function executeOperation(operation, operationConfig) {
        // For security reason deleteAll must be explicitly set to true
        if (operation === 'deleteAll') {
            return !!operationConfig.exec;
        }

        return operationConfig.exec !== false;
    }

    /**
     * Returns prefix(es) of the route for an operation
     * Plural because we can define several prefixes for a same Model Action
     * and thus several routes are created
     * @param {string} operation -- the operation
     * @param {object} config -- config of the operation
     * @returns {Array} -- the prefixes
     */
    function getPrefixes(operation, config) {
        let prefix = '';

        if (isPublic(operation)) {
            prefix = settings.contexts.public;
        } else {
            prefix = settings.contexts.private;
        }

        prefix = config && config.path && config.path.prefix ? config.path.prefix : prefix;

        return arrify(prefix);
    }

    function isPublic(operation) {
        switch (operation) {
            case 'list':
            case 'get':
                return true;
            default:
                return false;
        }
    }

    function operationToVerb(operation) {
        switch (operation) {
            case 'create':
                return 'post';
            case 'updatePatch':
                return 'patch';
            case 'updateReplace':
                return 'put';
            case 'delete':
            case 'deleteAll':
                return 'delete';
            default:
                return 'get';
        }
    }
}

function operationConfig(config, operation) {
    return config.operations && {}.hasOwnProperty.call(config.operations, operation) ? config.operations[operation] : {};
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

    let arr = [];
    ancestors = arrify(ancestors);

    ancestors.forEach((ancestor, index) => {
        const id = `anc${index}ID`;
        if (!params[id]) {
            return;
        }
        arr = arr.concat([ancestor, params[id]]);
    });

    return arr;
}

function pathFromEntityKind(entityKind) {
    let path = entityKind.substr(0, 1).toLowerCase() + entityKind.substr(1);
    path = S(path).dasherize().s;
    path = pluralize(path, 2);

    return path;
}

module.exports = (settings) => {
    if (settings) {
        ApiBuilder.setOverrides(settings);
    }

    return {
        express,
    };
};
