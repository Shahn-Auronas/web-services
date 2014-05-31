#!/usr/bin/env node --harmony

'use strict';

const express = require('express'),
      morgan = require('morgan'),
      app = express();
//middleware is logger set to dev mode to log requests coming in
app.use(morgan('dev'));
//handle GET requests to the /api/:name path :name (named route parameter)
app.get('/api/:name', function (req, res) {
	//send back JSON object with hello key set to name parameter
	res.json(200, { 'hello': req.params.name });
});
app.listen(3000, function () {
	console.log('Let us get this started.');
});