# API Generator for Google Datastore Entities

**datastore-api** is a NodeJS Express routes helper to build RESTful APIs to interact with Google Datastore entities.
It is built on top of the [gstore-node](https://github.com/sebelga/gstore-node) library and its Entities Modeling pattern.

----------

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Motivation](#motivation)
- [Installation](#installation)
- [What do I get from it](#what-do-i-get-from-it)
- [Getting started](#getting-started)
  - [Initiate library](#initiate-library)
- [Create an Entity API](#create-an-entity-api)
  - [settings](#settings)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation
While I was coding the [gstore](https://github.com/sebelga/gstore-node) library I was working on an REST API
for a mobile project. I found myself copying a lot of the same code to create all the routes and controllers needed to manage my Datastore entities. So I decided to create this small utility to help me create all the REST routes for CRUD operations over the Google Datastore entities.

## Installation

 ```
 npm install gstore-api --save
 ```

## What do I get from it

**Without** gstoreApi


```js
// blogPost.routes.js

var BlogPostController = require('../controllers/blogPost.controller');

function BlogPostRoutes(router) {

	// Public routes
	router.route('/blog-posts')
			.get(BlogPostController.list);

	router.route('/blog-posts/:id')
			.get(BlogPostController.get);

	// Private routes behind an auth middelware
	router.route('/private/blog-posts')
			.post(BlogPostController.create)
			.delete(BlogPostController.deleteAll);

	router.route('/private/blog-posts/:id')
			.patch(BlogPostController.updatePatch)
			.put(BlogPostController.updateReplace)
			.delete(BlogPostController.delete);
}

module.exports = BlogPostRoutes;

```

```js
// blogPost.controller.js

// BlogPost is a Datastools Model
var BlogPost = require('../models/blogPost');

/*
	Note: for the sake of brevity we won't deal with the errors
*/

function list(req, res) {
	BlogPost.list(function(err, result) {
		res.json(result.entities);
	})
}

function get(req, res) {
	BlogPost.get(req.params.id, function(err, entity) {
		res.json(entity.plain());
	});
}

function create(req, res) {
	var data     = BlogPost.sanitize(req.body);
	var blogPost = new BlogPost(data);

	blogPost.save(function(err, entity){
		res.json(entity.plain());
	});
}

function updatePatch(req, res) {
	var data = BlogPost.sanitize(req.body);

	BlogPost.update(req.params.id, data, function(err, entity){
		res.json(entity.plain());
	});
}

function updateReplace(req, res) {
	var data = BlogPost.sanitize(req.body);

	BlogPost.update(req.params.id, data, null, null, null, {replace:true}, function(err, entity){
		res.json(entity.plain());
	});
}

function deleteResource(req, res) {
	BlogPost.delete(req.params.id, function(err, result){
		if (result.success) {
			res.send('Entity deleted successfully');
		} else {
			res.send('Entity to delete not found.');
		}
	});
}

function deleteAll(req, res) {
	BlogPost.deleteAll(function(err){
		res.send('All BlogPost deleted successfully');
	});
}

module.exports = {
	list:          list,
	get:           get,
	create:        create,
	updatePatch:   updatePatch,
	updateReplace: updateReplace,
	delete:        deleteResource,
	deleteAll:     deleteAll
};

```

**With** gstoreApi

```js
// server.js

var gstoreApi = require('datastore-api');

gstoreApi.init({
	router : router // Express Router instance
});

```

The next file is all you need to have a full CRUD REST API of a [gstore-node BlogPost Model](https://github.com/sebelga/gstore-node#model)

```js
// lib
var gstoreApi = require('gstore-api');

// Model (gstore-node)
var BlogPost = require('../models/blogPost');

module.exports = function() { 
	// --> REST API for Model
	new datastoreApi(BlogPost);
}

```


## Getting started

### Initiate library

Before using gstoreApi you need to initiate the library with `gstoreApi.init({...settings})`
The settings is an object with the following properties:

- router
- host (optional)
- simplifyResult(optional) default: true
- contexts (optional)

**router**  
The Express Router instance

**host**  
Specify the host of your API. It is needed to create the \<Link\> Header in the Model.list() response that contains the next pageCursor. If you don't specify it will be auto-generated with the info in the request  
`req.protocol + '://' + req.get('host') + req.originalUrl` 

**simplifyResult**  
Define globally if the response format is simplified or not. See explanation in [gstore-node docs](https://github.com/sebelga/gstore-node#queries)

**context**  
Contexts is an objects with 2 properties: "**public**" and "**private**" that specify a suffix for the routes to be generated.
gstoreApi considers that "GET" calls (that don't mutate the resource) are *public* and all others (POST, PUT, PATCH, DELETE) are *private*.

Its default value is an object that does not add any suffix to any route.

```js
{
	public  : '',
	private : ''
}
```

But for example if you initiate gstoreApi like this

```js
gstoreApi.init({
	router : router,
	contexts : {
		'public'  : '',
		'private' : '/private'
	}
});
```

And you defined an Auth middelware

```js
router.use('/private/', yourAuthMiddelware);
```

Then all the POST, PUT, PATCH and DELETE routes will automatically be routed through your Auth middelware.


## Create an Entity API

To its simplest form, to create an API for a Model you just need to create a new instance of the gstoreApi with the Model.

```js
var gstoreApi = require('gstore-api');
var Model     = require('../models/my-model');

new gstoreApi(Model);
```

### settings

If you need some fine-tuning, the gstoreApi constructor has a second parameter where you can configure the following settings

```js
// NOTE: All the settings below are OPTIONAL. Just define what you need to tweak.

{
	path: '/end-point', // if not specified will be automatically generated (see below)
	ancestors : 'Dad', // can also ben an array ['GranDad', 'Dad']
	op : {
		list          : {...op setting see below},
		get           : {...}
		create        : {...},
		udpatePatch   : {...}, // PATCH :id
		updateReplace : {...}, // PUT :id
		delete        : {...},
		deleteAll     : {...}

	}
}

```

#### path
If not set the path to the resource is **auto-generated** with the following rules:

- start with lowercase
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
You can pass here one or several ancestors (entity Kinds) for the Model. The path create follows the same rules as mentioned above.

```js
// gstore-node Model
var Comment = require('./models/comment.model');

new gstoreApi(Comment, {
	ancestors : 'BlogPost'
});

// Generated the folowing Express 2 routes with their corresponding verbs:

/blog-posts/:anc0ID/comments
/blog-posts/:anc0ID/comments/:id


// To list all the comments entities with the ancestors path ['BlogPost', 123]
// you just need to make a call to

GET /blog-posts/123/comments

// You can pass an array
new gstoreApi(Comment, {
	ancestors : ['Blog', 'BlogPost']
});

// And generate the following routes

/blogs/:anc0ID/blog-posts/:anc1ID/comments
/blogs/:anc0ID/blog-posts/:anc1ID/comments/:id

```

#### op

Operations can be any of

- list (GET all entities) --> call the list() query shortcut on Model
- get  (GET one entity)
- create (POST new entity)
- updatePatch   (PATCH update entity) --> only update properties sent
- updateReplace (PUT to update entity) --> replace all data for entity
- delete (DELETE one entity)
- deleteAll (DELETE all entities)

The **list** operation calls the same method from the gstore-node shortcut query "list" as explained in the [documentation here](https://github.com/sebelga/gstore-node#list).


##### op settings

Each operation has the **same configuration settings** with the following properties

```js
{
	fn         : someController.someMethod,
	middelware : someMiddelware,
	exec       : true, (default true)
	options    : {
		simplifyResult : true,  (default to settings passed in init())
		readAll        : false, (default false)
	},
	path : {
		prefix  : 'additional-prefix' // can also be an <Array>.
		suffix  : 'additional-suffix' // not sure why I added this feature, but it's there :)
	}
}
```


**fn**  
Custom Controller method to call. Like any Express Router method, it is passed the **request** and **response** object like this `function controllerMethod(req, res) {...}`


**middelware**  
You can specify a custom middelware for any operation. You might want for example to specify a middleware to upload a file.

```js
// Upload file with multer package
var multer  = require('multer');
var storage = multer.memoryStorage();
var upload  = multer({storage: storage});

// gstore-node model
var Image = require('./models/image.model');

// Image Controller
var imageController = require('./controllers/image.controller');

// Build API
new gstoreApi(Image, {
	op : {
		create : {
		    middelware : upload.single('file'),
		    fn : imageController.create  // Add a custom Controller for the POST
		}
	}
});

// The following will have the middelware added and call the custom Controller method
POST /images

```

**exec**  
This property defines if the route for the operation is created (and therefore executed) or not. Defaults to **true** except for "*deleteAll*" that you must manually set to true for security reason.

**options**  

- **simplifyResult**: for list operation it will pass this setting to the Model.list() action. And for get, create, and update(s) operation it will call entity.plain()
- **readAll**: (default: false) in case you have defined some properties in your Schema with read:false ([see the doc](https://github.com/sebelga/gstore-node#read)), they won't show up in the response. If you want them in the response set this property to true.

Extra options:  
**Only** for the "list" operation, there are some extra options that you can set to override any of the shortcut query "list" settings. [See the docs](https://github.com/sebelga/gstore-node#list)

- **limit**
- **order**
- **select**
- **ancestors** (except if you already defined them in init())
- **filters**

**path**  
You can add here some custom prefix or suffix to the path.  

If you pass an **\<Array\>** of prefix like this `['', '/private', '/some-other-route']`, this will create 3 endPoints to access your entity and so let you define 3 different middelwares if needed. You will then have to define a custom Controller method (fn) to deal with these differents scenarios and customize the data saved or returned.

Important: The path setting that you set here will override global "contexts" settings.

