# API Generator for Google Datastore Entities

[![npm version](https://badge.fury.io/js/gstore-api.svg)](https://badge.fury.io/js/gstore-api) [![Build Status](https://travis-ci.org/sebelga/gstore-api.svg?branch=master)](https://travis-ci.org/sebelga/gstore-api) [![Coverage Status](https://coveralls.io/repos/github/sebelga/gstore-api/badge.svg?branch=master)](https://coveralls.io/github/sebelga/gstore-api?branch=master)  

**datastore-api** is a NodeJS tool to generate RESTful APIs to interact with Google Datastore entities.  
It is built on top of [gcloud-node](https://github.com/GoogleCloudPlatform/gcloud-node) and the [gstore-node](https://github.com/sebelga/gstore-node) library with its Entities Modeling definition.

----------

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Motivation](#motivation)
- [Installation](#installation)
- [What do I get from it?](#what-do-i-get-from-it)
- [Getting Started](#getting-started)
  - [settings](#settings)
- [Create an API for an Entity](#create-an-api-for-an-entity)
  - [settings (optional)](#settings-optional)
    - [path](#path)
    - [ancestors](#ancestors)
    - [operations](#operations)
    - [list() operation - Link Header](#list-operation---link-header)
    - [operation settings](#operation-settings)
      - [handler](#handler)
      - [middleware](#middleware)
      - [exec](#exec)
      - [options](#options)
      - [path](#path-1)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation
While I was coding the [gstore-node](https://github.com/sebelga/gstore-node) library I was working on a REST API for a mobile project. I found myself copying a lot of the same code to create all the routes and controllers needed to manage my Datastore entities. So I decided to create this small utility to help generate all the REST routes for CRUD operations on the Google Datastore entities.

## Installation

 ```
 npm install gstore-api --save
 ```

## What do I get from it?

With just 6 lines of code (3 being a one time config), generate a full API (with data type & value validation) for a Datastore entity kind.  
See the doc for all the information about [gstore-node Model creation](https://sebelga.gitbooks.io/gstore-node/content/model/creation.html).

```js
const router = require('express').Router();
const gstoreApi = require('gstore-api')();
const apiBuilder = gstoreApi.express(router);

// import gstore-node Model
const BlogPost = require('./blog-post.model');

// create api
const blogPostApì = apiBuilder.create(BlogPost);

// add it to your Express app
app.use('/api/v1', blogPostApi);

/**
 * This will generate the following API
 */

// GET /api/v1/blog-posts -- list all BlogPost
// GET /api/v1/blog-posts/:id -- get one BlogPost
// POST /api/v1/blog-posts -- create a BlogPost
// PATCH /api/v1/blog-posts/:id -- update a BlogPost (merging new data with old one)
// PUT /api/v1/blog-posts/:id -- update a BlogPost (replacing old data with new one)
// DELETE /api/v1/blog-posts/:id -- delete a BlogPost

```

-----

## Getting Started

### settings

```js
const gstoreApi = require('gstore-api')({ ...settings });
```

You can require gstore-api with or without settings. Those settings are **optional**, only define what you need. You only need to define them once for all your apis.  
You will be able to override those settings or define them later when you [create a Model api](#create-an-api-for-an-entity).

The settings object has the following properties:

```js
{
    host: { string } // default: ---> auto generated (see below)
    contexts: { object } // default: { public: '', private: '' }
    readAll: { boolean } // default: false
    showKey: { boolean } // default: false
}
```

**host**  
The host of your API. It is needed to set the \<Link\> Header in the Response object when listing the entities.  
This \<Link\> Header contains the next *pageCursor* for pagination.  
If you don't specify the host, it will be auto-generated with the information coming in the Request object: `req.protocol + '://' + req.get('host') + req.originalUrl` 

**context**  
Contexts is an objects with 2 properties: "**public**" and "**private**" that specify a prefix for the routes to be generated.
gstoreApi considers that "GET" calls (that don't mutate the resource) are *public* and all others (POST, PUT, PATCH, DELETE) are *private*.

Its default value is an object that does not add any prefix to any route.

```js
{
    public  : '',
    private : '',
}
```

But for example if you require gstoreApi whit those settings:

```js
const gstoreApi = require('gstore-api')({
    contexts : {
        'public'  : '',
        'private' : '/private'
    }
});
```

...and you've defined an Auth middleware in your router for all routes containing '/private'

```js
router.use('/private/', yourAuthMiddleware);
```

Then all the POST, PUT, PATCH and DELETE routes will automatically be routed through your Auth middleware.  

Of course you could also leave the default contexts and then manually add a prefix to your API path ([see below](#path)) like this: `{ path: '/private/user' }` for example.

**readAll**  

Override the Model Schema property parameter **read** \([here](https://sebelga.gitbooks.io/gstore-node/content/schema/other-paremeters.html#read)\) to return all the properties of the entities. This setting can be overriden **on each operation** later.

**showKey**  
Adds a "__key" property to the entity data with the complete Key from the Datastore. This setting can be overriden **on each operation** later.

-----

## Create an API for an Entity

You build an api with the "create" methods from the Express api builder.

```js
apiBuilder.create(
    /* gstore-node Model */
    MyModel,
    /* optional -- configuration settings */
    settings,
);
```

**@Returns** -- the express Router.

Example
```js
// modules/blog/blog-post.router.js

const router = require('express').Router();
const gstoreApi = require('gstore-api')();
const apiBuilder = gstoreApi.express(router);

const BlogPost = require('./blog-post.model');

module.exports = apiBuilder.create(BlogPost);
```

You can then pass the api to your Express app routes.

```js
// routes.js

const blogPostRouter = require('./modules/blog/blog-post.router.js');

module.exports = (app) {
    app.use('/api/v1', blogPostRouter);
}
```

```js
// index.js

const express = require('express');
const app = express();

require('./routes')(app);
```

### settings (optional)

You can configure the api build by passing an optional object with the following parameters

```js
// Reminder: All the settings below are OPTIONAL. Just set what you need to tweak.

{
    /*
     * {string} -- if not specified will be auto-generated (see below)
     */
    path: '/end-point',
    /*
     * {string | Array} -- Ancestors of the model. Can be an Array, ex. ['GranDad', 'Dad']
     */
    ancestors : 'Dad',
    /*
     * {boolean} -- default to what you defined when you required gstore-api,
     * if not defined defaults to the Model "queries" settings,
     * and if not defined on Model, then defaults to "false"
     */
    readAll, true,
    /*
     * {boolean} -- default to what you defined when you required gstore-api,
     * if not defined defaults to the Model "queries" settings,
     * and if not defined on Model, then defaults to "false"
     */
    showKey, true,
    /*
     * {object} -- api operations configuration
     * see the settings available for each operation below (#operation settings)
     */
    operations : {
        list: {...},
        get: {...}
        create: {...},
        udpatePatch: {...}, // PATCH :id
        updateReplace: {...}, // PUT :id
        delete: {...},
        deleteAll: {...},
    }
}

```

#### path
Path to access the resource (our Model).  
If not set the path to the resource is **auto-generated** with the following rules:

- lowercase
- dash for camelCase
- pluralize entity Kind

```js
Example:

entity Kind        path
----------------------------
'BlogPost' --> '/blog-posts'  
'Query'    --> '/queries'
```

#### ancestors
You can pass here one or several ancestors (entity Kinds) for the Model. The conversion from the entity kind to the path generated follows the same rules as mentioned above.

```js
const Comment = require('./comment.model');

const commentApi = apiBuilder.create(Comment, { ancestors : 'BlogPost' });

// Routes generated (only showing the ones for GET):

GET /blog-posts/:anc0ID/comments
GET /blog-posts/:anc0ID/comments/:id
...

// You can now list all the user comments having for ancestor a BlogPost with id 123:
// GET /blog-posts/123/comments

// Ancestors can also be an Array
const commentApi = apiBuilder.create(Comment, { ancestors : ['Blog', 'BlogPost'] });

// This will generate the following routes

/blogs/:anc0ID/blog-posts/:anc1ID/comments
/blogs/:anc0ID/blog-posts/:anc1ID/comments/:id

// You can now list all the comments for a BlogPost with id 123,
// belonging to a Blog with id 'blog-fr' calling:
// GET /blog/blog-fr/blog-posts/123/comments

```

#### operations

Operations can be any of

- list (GET all entities) --> call the list() query shortcut on Model. [Documentation here](https://sebelga.gitbooks.io/gstore-node/content/queries/list.html).
- get  (GET one entity)
- create (POST new entity)
- updatePatch   (PATCH update entity) --> only update the properties sent
- updateReplace (PUT to update entity) --> replace all data for entity
- delete (DELETE one entity)
- deleteAll (DELETE all entities)

#### list() operation - Link Header  
The **list** operation adds a [Link Header](https://tools.ietf.org/html/rfc5988#page-6) (rel="next") with the link to the next page to fetch if there are more result.  
You can then pass a **pageCursor** query param to fetch the next page passing the pageCursor.  
Example: `GET /blog-posts?pageCursor=abcdef123456`  

To set the **limit** of the number of entities returned, [have a look at the documentation]((https://sebelga.gitbooks.io/gstore-node/content/queries/list.html)).

#### operation settings

Each operation can be configured with the following settings

```js
{
    /*
     * {function} -- custom handler for the operation
     */
    handler: someController.someMethod,
    /*
     * {function | Array} -- middleware or array of Express middleware
     */
    middleware: someMiddleware,
    /*
     * {boolean} -- defines if operation is executed (and the route created)
     * All operations default to "true" except "deleteAll" for security reason
     */
    exec: true,
    /*
     * {object} -- additional options
     */
    options: {
        /*
        * {boolean} -- default: whatever has been set on higher level
        * --> 1: gstore Model queries settings, 2: require() settings, 3: api settings, 4: operation settings)
        */
        readAll: false,
        /*
        * {boolean} -- default: whatever has been set on higher level
        * --> 1: gstore Model queries settings, 2: require() settings, 3: api settings, 4: operation settings)
        */
        showKey: false,
    },
    /*
     * {object} -- path configuration
     */
    path : {
        /*
        * {string | Array} -- prefix for the path.
        * Can also be an <Array> to generate several routes for the same resource
        */
        prefix  : 'additional-prefix',
        /*
        * {string} -- suffix for the path.
        */
        suffix  : 'additional-suffix',
    }
}
```

##### handler
Your own hanlder method for the route generated.  
Like any Express Router method, it receives the **request** and **response** arguments.

```js
function controllerMethod(req, res) {
    // Your own logic
}`
```

##### middleware
You can specify a custom middleware for any operation. You might want for example to specify a middleware to upload a file.

```js
const router = require('express').Router();
const gstoreApi = require('gstore-api')();
const apiBuilder = gstoreApi.express(router);

// Upload file with multer package
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

const Image = require('./image.model');
const imageController = require('./image.controller');

// Build API
const imageApi = apiBuilder.create(Image, {
	operations: {
		create: {
		    handler : imageController.create,  // your custom handler
		    middleware : upload.single('file'), // multer middleware
		},
        updatePatch: {
		    handler : imageController.update,  // your custom handler
		    middleware : upload.single('file'), // multer middleware
		},
        updateReplace: { exec: false }, // disable the PUT route
	}
});

// The following route will have the middleware added and call the custom Controller method
POST /images
PATCH /images/:id

```

##### exec
This property defines if the route for the operation is created (and therefore executed) or not. Defaults to **true** except for "*deleteAll*" that you must manually set to true for security reason.

##### options

- **readAll**: (default: false) in case you have defined some properties in your Schema with `read: false` ([see the doc](https://sebelga.gitbooks.io/gstore-node/content/schema/other-paremeters.html)), they won't show up in the response. If you want them in the response set this property to true.
- **showKey**: (default: false). If set to "true" adds a "__key" property to the entity(ies) returned with the Datastore Entity Key.

Additional options for the "list()" operation:  
There are some extra options that you can set to override any of the shortcut query "list" settings. [See the docs](https://sebelga.gitbooks.io/gstore-node/content/queries/list.html)

- **limit**
- **order**
- **select**
- **ancestors** -- except if already defined in api creation
- **filters**


##### path
You can add here some custom prefix or suffix to the path.  

If you pass an **\<Array\>** of prefix like this `['', '/private', '/some-other-route']`, this will create 3 endPoints to access your entity (with all the correspondig verbs).

```
/my-entity
/private/my-entity
/some-other-route/my-entity
```

You could have then 2 middlewares (on routes containing 'private' or 'some-other-route') that could add some data to the request. You will then have to define a custom handler (Controller method) to deal with these differents scenarios and customize the data saved or returned. For example: outputing more data if the user is authenticated.  

**Important**: this "path" setting will override the global "contexts" settings.

Example:

```js
// app.js

(...)

// Define an auth middleware on all 'private' routes

router.use('/private/', authMiddleware);

function authMiddleware(req, res, next) {
    const token = req.headers['x-access-token'];

    if (token) {
        // ... your logic to verify token

        req.body.__auth = { role: 'admin' }; // Add auth information to request body
        next();
    } else {
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });
    }
}

```

```js
// blogPost.router.js

const router = require('express').Router();
const gstoreApi = require('gstore-api')();
const apiBuilder = gstoreApi.express(router);

const BlogPost = require('./blog-post.model');
const blogPostController = require('./blog-post.controller');

// Generate API for BlogPost entities but with a special handler for the list()
module.exports = apiBuilder.create(BlogPost, {
    operations: {
        list: { handler: blogPostController.list }
    }
});

```

```js
// blogPost.controller.js

const BlogPost = require('./blog-post.model');

const list = (req, res) => {
    const settings = {};
    const isAdmin = req.body.__auth && req.body.__auth.role === 'admin';

    // Add the page cursor if passed by query params
    settings.start = req.query.pageCursor;

    // If the user is admin we override the list settings and show more data
    if (isAdmin) {
        /**
         * override the settings defined globally (see list() doc in gstore-node)
         */
        settings.filters = []; // remove all filters (show all)
        settings.select = undefined; // select all properties
        settings.readAll = true; // read all properties regardless of the *read* config in Model Schema.
        settings.showKey = true; // ads the complete entity Keys to the result
    }

    BlogPost.list(settings)
            .then((entities) => {
                res.json(entities);
            });
}

module.exports = {
    list,
};

```

