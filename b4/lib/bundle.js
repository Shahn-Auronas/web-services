/*
 * Book Bundle API
 * Using Q module to handle promises with its helper
 * methods for interoperating with different asynchronous
 * code-management approaches
 */
 'use strict';

 const Q = require('q'),
       request = require('request');

module.exports = function (config, app) {
	//create a new bundle with specific name with POST handler
	//curl -X POST http://localhost:3000/api/bundle?name=<name>
	app.post('/api/bundle', function (req, res) {
		//deferred object class provides methods for
		//working with the promise
		let deferred = Q.defer();
		request.post({
			url: config.b4db,
			json: {
				type: 'bundle',
				name: req.query.name,
				books: {}
			}
		}, function (err, couchRes, body) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve([couchRes, body]);
			}
		});
		deferred.promise.then(function (args) {
			let couchRes = args[0], 
			    body = args[1];
			res.json(couchRes.statusCode, body);
		}, function (err) {
			res.json(502, {
				error: 'bad_gateway',
				reson: err.code
			});
		});
	});
	//Express route to get a given bundle with id
	//curl -X POST http://localhost:3000/api/bundle/<id>
	app.get('/api/bundle/:id', function (req, res) {
		//nfcall === Node function call
		//nfcall: calls a node.js func with the given variadic args
		//returning a promise that is fulfilled if the func calls back
		//with a result or rejects if error
		Q.nfcall(request.get, config.b4db + '/' + req.params.id)
		    .then(function (args) {
			    let couchRes = args[0],
			        bundle = JSON.parse(args[1]);
			    res.json(couchRes.statusCode, bundle);
		    }, function (err) {
			    res.json(502, {
				    error: "bad_gateway",
				    reason: err.code
			    });
		    })
		    //force any unhandled rejected promises to throw
		    .done();
	});
	//Set the specified bundle's name with the specified name
	//curl -X PUT http://localhost:3000/api/bundle/<id>/name/<name>
	app.put('/api/bundle/:id/name/:name', function (req, res) {
		Q.nfcall(request.get, config.b4db + '/' + req.params.id)
			//start the promise chain
		    .then(function (args) {
		  	    let couchRes = args[0],
		  	        bundle = JSON.parse(args[1]);
		  	    if (couchRes.statusCode !== 200) {
		  		    return [couchRes, bundle];
		  	    }
		  	    //if 200 OK overwrite name field
		  	    bundle.name = req.params.name;
		  	    //PUT bundle doc back in CouchDB
		  	    return Q.nfcall(reques.put, {
                    url: config.b4db + '/' + req.params.id,
                    json: bundle
		  	    });
		    })
		    .then(function (args) {
		  	    let couchRes = args[0],
		  	        body = args[1];
		  	    res.json(couchRes.statusCode, body);
		    })
		    .catch(function (err) {
		  	    res.json(502, {
		  		    error: "bad_gateway",
		  		    reason: err.code
		  	    });
		    })
		    .done();
	});
	//put a book into a bundle by its id
	//curl  -X PUT http://localhost:3000/api/bundle/<id>/book/<pgid>
	app.put('/api/bundle/:id/book/:pgid', function (req, res) {
		let args,
		    couchRes,
		    bundle,
		    book;
		//grab the bundle from the b4 database
		Q.nfcall(request.get, config.b4db + '/' + req.params.id)
		    .then(function (args) {
		  	    couchRes = args[0];
		  	    bundle = JSON.parse(args[1]);
		  	    //fail fast if we can't retrieve the bundle
		  	    if (couchRes.statusCode !== 200) {
		  		    return [couchRes, bundle];
		  	    }
		  	    //look up the book by its Project Gutenberg ID
		  	    return Q.nfcall(request.get, config.bookdb + '/' + req.params.pgid);
		    })
		    .then(function (args) {
		  	    couchRes = args[0];
		  	    book = JSON.parse(args[1]);
		  	    //fail fast if we can't retrieve the book
		  	    if (couchRes.statusCode !== 200) {
		  		    return [couchRes, book];
		  	    }
		  	    bundle.books[book._id] = book.title;
		  	    //add the book to the bundle and put it back in CouchDB
		  	    return Q.nfcall(request.put, {
		  		    url: config.b4db + '/' + bundle._id,
		  		    json: bundle
		  	    });
		    })
		    .then(function (args) {
		  	    res.json(args[0].statusCode, args[1]);
		    })
		    .catch(function (err) {
		  	    res.json(502, {
		  		    error: "bad_gateway",
		  		    reason: err.code
		  	    });
		    })
		    .done();
	});
    //Remove a book from a bundle
    //curl -X DELETE http://localhost:3000/api/bundle/<id>/book/<pgid>
    app.del('/api/bundle/:id/book/:pgid', function (req, res) {
    	let args,
    	    couchRes,
    	    bundle;
    	Q.nfcall(request.get, config.b4db + '/' + req.params.id)
    	    .then(
    	    	function (args) {
                    couchRes = args[0],
                    bundle = JSON.parse(args[1]);
                    //fail fast if we can't retrieve the bundle
                    if (couchRes.statusCode !== 200) {
                    	res.json(couchRes.statusCode, bundle);
                    	return;
                    }     
                    //fail fast if bundle doesn't already have that book
                    if (!(req.params.pgid in bundle.books)) {
                    	res.json(409, {
                    		error: "conflict",
                    		reason: "Bundle does not contain that book."
                    	});
                    	return;
                    }
                    //remove the book from the bundle
                    delete bundle.books[req.params.pgid];
                    //put the updated bundle back in CouchDB
                    request.put({
                    	url: config.b4db + bundle._id,
                    	json: bundle
                    })
                    .pipe(res);
    		    })
                .catch(function (err) {
                	res.json(502, {
                		error: "bad_gateway",
                		reason: err.code
                	});
                });
    });
};