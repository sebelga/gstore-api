# gstore-api App example

Small application to demostrate how to use gstore-api

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Launch the app](#launch-the-app)
- [What does it do](#what-does-it-do)
- [Test the API](#test-the-api)
  - [List all users](#list-all-users)
  - [Get a user](#get-a-user)
  - [Create a user](#create-a-user)
  - [Update a user](#update-a-user)
  - [Delete a user](#delete-a-user)
  - [Delete ALL users](#delete-all-users)
- [User login (auth)](#user-login-auth)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Launch the app

1. Install the dependencies

```js
npm install
```

2. Create a file named ".env" at the root of the example folder.  
Put inside the file these 2 environment variables:

```
GCLOUD_PROJECT=name-of-your-project
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your/credentials.json
```

3. Launch the server (better with nodemon). Inside the example folder run:  

```js
NODE_ENV=development nodemon app/server.js
```

## What does it do

- It will generate an API to list, create, update and delete Users
- Create an /auth/login route to log a user in

Once the server is launched you can access it at `http://localhost:3007`.

## Test the API

To test the API I recommend [Postman](https://www.getpostman.com/) but any API tool will do.

### List all users

`GET /api/v1/users`

### Get a user

`GET /api/v1/users/{id}`

### Create a user

`POST /api/v1/users`

Here you can either just pass a raw JSON object with the following properties (don't forget to set the "Content-type" Header to "application/json":  

- username (required)
- password (required)
- firstname
- lastname
- email

Or you can create user by **uploadding a profile picture** (simulated in the modules/user/user.controller.js) by setting the body type of the Request to *form-data*.  
You can now pass a "profilePict" property of type **File**.

- username (required)
- password (required)
- profilePict (*File* type)
- firstname
- lastname
- email

### Update a user

`PATCH /api/v1/users/{id}`

Modify the properties of a specific User. 
Like with "create" above you can either update the user by sending a raw JSON object, or also by uploading a file (through form-data fields).

### Delete a user

`DELETE /api/v1/users/{id}`

Delete a User at the specific id.

### Delete ALL users

`DELETE /api/v1/users`

Delete all the users in the Datastore.

## User login (auth)

The demo application also shows you how you can login a user with the following route:  

```js
POST /auth/login
```

and by passing a JSON object in the body of the request

```js
{
    "username": "john",
    "password": "your-password"
}
```

If the username and password are correct you should receive a dummy token back.
