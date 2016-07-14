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
  - [Initiate](#initiate)
- [Create a REST API for an Entity](#create-a-rest-api-for-an-entity)
  - [Basic](#basic)
  - [Additional settings](#additional-settings)
    - [path](#path)
    - [ancestors](#ancestors)
    - [op](#op)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation
While I was working on the [gstore-node](https://github.com/sebelga/gstore-node) library I was building a REST API
for a mobile project. I found myself copying a lot of the same code over and over to create all the routes and controllers needed to manage my Datastore entities. So I decided to create this small utility to help me generate all the REST routes for CRUD operations on the Google Datastore entities.

## Installation

 ```
 npm install gstore-api --save
 ```

## What do I get from it

**Without** gstoreApi


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

```
// server.js

var gstoreApi = require('datastore-api');

gstoreApi.init({
	router : router // Express Router instance
});

```

The next file is all you need to have a REST API for a "BlogPost" Datastore Entity

```
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

### Initiate

Before using gstoreApi you need to initiate the library with `gstoreApi.init({...settings})`
The settings is an object with the following properties:

- router
- simplifyResult // (optional) default: true
- contexts // (optional)

**router**
The Express Router instance

**simplifyResult**
Define globally if the response format is simplified or not. See explanation in [gstore-node docs](https://github.com/sebelga/gstore-node#queries)

**context**
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


## Create a REST API for an Entity

### Basic
To its simplest form, to create an API for a Model you just need to create a new instance of the gstoreApi and pass the Model.

```
var gstoreApi = require('gstore-api');
var Model     = require('../models/my-model');

new gstoreApi(Model);
```

### Additional settings

If you need some fine-tuning, the gstoreApi constructor has a second parameter where you can configure the following settings

```
// NOTE: All the settings below are OPTIONAL. You only need to set the one you need to tweak.

{
	path: '/end-point', // if not specified will be automatically generated (see below)
	ancestors : 'Dad', // can also ben an array ['GranDad', 'Dad']
	op : {
		list : {
			fn         : someController.someMethod,
			middelware : someMiddelware,
			exec       : true, (default true)
			options    : {
				simplifyResult : true,  (default to settings in init())
				readAll        : false, (default false)
			},
			path : {
				prefix : 'additional-prefix' // can also be an <Array>.
				sufix  : 'additional-sufix' // not sure why I added this feature, but it's there :)
			}
		},
		get           : {...}  // same as above
		create        : {...},
		udpatePatch   : {...}, // PATCH verb
		updateReplace : {...}, // PUT verb
		delete        : {...},
		deleteAll     : {...}  // exec defaults to false (for security)

	}
}

```

#### path
If you don't pass the path for the resource it will be **auto-generated** with the following rules:

- lowercase
- dash for camelCase
- pluralize the entity Kind

```
Example:

entity Kind        path
----------------------------
'BlogPost' --> '/blog-posts'
'Query'    --> '/queries'
```


#### ancestors
You can set here one or several ancestors (Entity Kinds) for the current Model. The path that is generated follows the same rules as the path setting above.

```
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

- list (GET all entities)
- get  (GET one entity)
- create (POST new entity)
- updatePatch   (PATCH update entity) --> only update the properties sent in body
- updateReplace (PUT to update entity) --> replace all data for entity
- delete (DELETE one entity)
- deleteAll (DELETE all entities)

They all have the **same configuration settings** with the following properties


**fn**
Controller function to call. If you don't pass it it will default to get and return the entity from Google Datastore.

**middelware**
You can specify a custom middelware for any operation. You might want, for example, to add a middleware to upload files.

```
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
		    fn : imageController.create  // Add a custom logic just for this POST
		}
	}
});

// The following will have the middelware added and call the custom controller method
POST /images

```

**exec**
You define with this property to execute or not this operation on the entity Model. Defaults to **true** except for "*deleteAll*" operation that you must manually set to true for security reason.

**options**

- **simplifyResult**: for the list() operation it will forward this setting to the Model.list() action. For get, create, and update(s) operations it will call entity.plain() on the response.
- **readAll**: (default: false) in case you have set the **read setting** on some of your Schema's properties to false ([see the doc](https://github.com/sebelga/gstore-node#read)), these won't show up in the response data unless you set "readAll" to true.

**path**
You can add here some custom prefix or suffix to the path.
Important: This will override the settings from the global "contexts".

