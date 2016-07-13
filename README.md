# API Generator for Google Datastore Entities

**datastore-api** is a NodeJS Express routes helper to build RESTful APIs to interact with Google Datastore entities.
It is built on top of the [gstore-node](https://github.com/sebelga/gstore-node) library with its Entities Model design.

----------

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation
While I was coding the [gstore](https://github.com/sebelga/gstore-node) library I was working on an REST API
for a mobile project. I found myself copying a lot of the same code to create all the routes and controllers needed to
manage my Datastore entities. So I decided to create this small utility to help quickly build REST routes for CRUD
operations on Google Datastore entities and at the same time leave the door opened for more complex logic in the controllers.

## Installation

 ```
 npm install gstore-api --save
 ```

## What do I get from it

---> **Without** gstoreApi


```
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

```
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
	list:      list,
	get:       get,
	create:    create,
	update:    update,
	delete:    deleteResource,
	deleteAll: deleteAll
};

```

---> **With** gstoreApi

```
// server.js

var gstoreApi = require('datastore-api');

gstoreApi.init({
	router : router // Express Router instance
});

```

The next file is all you need to have a full CRUD REST API of a [gstore-node BlogPost Model](https://github.com/sebelga/gstore-node#model)

```
// lib
var gstoreApi = require('gstore-api');

// Model (gstore-node)
var BlogPost = require('../models/blogPost');

// --> REST API for Model
module.exports = function() { new datastoreApi(BlogPost); }

```


## Getting started

### Initiate library

Before using gstoreApi you need to initiate the library with `gstoreApi.init({...settings})`
The settings is an object with the following properties:

- router // Express Router instance
- contexts // (optional) sets the context for "public" and "private" methods

**router** property  
The Express Router instance

**context** property  
Contexts is an objects with 2 properties: "**public**" and "**private**" that specify a sufix for the routes to be generated.
gstoreApi considers that "GET" calls (that don't mutate the resource) are *public* and all others (POST, PUT, PATCH, DELETE) are *private*.

Its default value is an object that does not add any sufix to any route.

```
{
	public  : '',
	private : ''
}
```

But for example if you initiate gstoreApi like this

```
gstoreApi.init({
	router : router,
	contexts : {
		'public'  : '',
		'private' : '/private'
	}
});
```

And you defined an Auth middelware

```
router.use('/private/', yourAuthMiddelware);
```

Then all the POST, PUT, PATCH and DELETE routes will automatically be routed through your Auth middelware.


## Create an Entity API

To its simplest form, to create an API for a Model you just need to create a new instance of the gstoreApi with the Model.

```
var gstoreApi = require('gstore-api');
var Model     = require('../models/my-model');

new gstoreApi(Model);
```

### settings

But if you need more fine-tuning, the gstoreApi constructor has a "settings" parameter with the following interface

```
{
	path: '/end-point', // if not specified will be automatically generated (see below)
	ancestors : 'Dad', // can also ben an array ['GranDad', 'Dad']
	op : {
		list : {
			fn         : someController.someMethod,
			middelware : someMiddelware,
			exec       : true, // execute or no this operation
			path : {
				prefix : 'additional-prefix' // can also be an <Array>.
				sufix  : 'additional-sufix' // not sure why I added this feature, but it's there :)
			}
		},
		get           : {...}  // same as above
		create        : {...},
		udpatePatch   : {...}, // PATCH :id
		updateReplace : {...}, // PUT :id
		delete        : {...},
		deleteAll     : {...}  // exec defaults to false (for security)

	}
}

```


