/*
 * Book Bundle API
 */
 'use strict';

 const Q = require('q'),
       request = require('request');

module.exports = function (config, app) {
	//create a new bundle with specific name
	//curl -X POST http://localhost:3000/api/bundle?name=<name>
	app.post('/api/bundle', function (req, res) {
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
				deferred.resolved([couchRes, body]);
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
	//Get a given bundle
	//curl -X POST http://localhost:3000/api/bundle/<id>
	app.get('/api/bundle/:id', function (req, res) {
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
				error: 'bad_gateway',
				reason: err.code
			});
		}).done();
	});
	//Set the specified bundle's name with the specified name
	//curl -X PUT http://localhost:3000/api/bundle/<id>/name/<name>
	app.put('/api/bundle/:id/name/:name', function (req, res) {
		Q.nfcall(request.get, config.b4db + '/' + req.params.id)
		  .then(function (args) {
		  	let couchRes = args[0],
		  	    bundle = JSON.parse(args[1]);
		  	if (couchRes.statusCode !== 200) {
		  		return [couchRes, bundle];
		  	}
		  	bundle.name = req.params.name;
		  	return Q.nfcall(reques.put, {
                url: config.b4db + '/' + req.params.id,
                json: bundle
		  	});
		  }).then(function (args) {
		  	let couchRes = args[0],
		  	    body = args[1];
		  	res.json(couchRes.statusCode, body);
		  }).catch(function (err) {
		  	res.json(502, {
		  		error: 'bad_gateway',
		  		reason: err.code
		  	});
		  }).done();
	});
	//put a book into a bundle by its id
	//curl  -X PUT http://localhost:3000/api/bundle/<id>/book/<pgid>
	app.put('/api/bundle/:id/book/:pgid', function (req, res) {
		//denodeify: creates a promise-returning function from
		//a node.js style function, binding it with the variadic args
		let get = Q.denodeify(request.get),
		    put = Q.denodeify(reques.put);
		//generator function is converted into a deffered function
		//to reduce nested callbacks
		Q.async(function* () {
			let args,
			    couchRes,
			    bundle,
			    book;
			//grab the bundle from the b4 database
			args = yield get(config.b4db + req.params.id);
			couchRes = args[0];
			bundle = JSON.parse(args[1]);
			//fail fast if we cannot retrieve the bundle
			if (couchRes.statusCode !== 200) {
				res.json(couchRes.statusCode, bundle);
				return;
			}
			//look up the book by its Project Gutenberge ID
			args = yield get(config.bookdb + req.params.pgid);
			couchRes = args[0];
			book = JSON.parse(args[1]);
			//fail fast if we cannot retrieve the book
			if (couchRes.statusCode !== 200) {
				res.json(couchRes.statusCode, book);
				return;
			}
			//add the book to the bundle and put it back in CouchDB
			bundle.books[book._id] = book.title;
			args = yield put({
				url: config.b4db + bundle._id,
				json: bundle
			});
			res.json(args[0].statusCode, args[1]);
		})().catch(function (err) {
			res.json(502, {
				error: 'bad_gateway',
				reason: err.code
			});
		});
	});
    //Remove a book from a bundle
    //curl -X DELETE http://localhost:3000/api/bundle/<id>/book/<pgid>
    app.del('/api/bundle/:id/book/:pgid', function (req, res) {
    	Q.async(function* () {
    		let args = yield Q.nfcall(request, config.b4db + req.params.id),
    		    couchRes = args[0],
    		    bundle = JSON.parse(args[1]);
    		//fail fast if we don't retrieve the bundle
    		if (couchRes.statusCode !== 200) {
    			res.json(couchRes.statusCode, bundle);
    			return;
    		}
    		//fail if the bundle doesn't already have that book
            if (!(req.params.pgid in bundle.books)) {
            	res.json(409, {
            		error: 'conflict',
            		reason: 'Bundle does not contain that book.'
            	});
            	return;
            }
            //remove the book from the bundle
            delete bundle.books[req.params.pgid];
            //put the updated bundle in CouchDB
            request.put({
            	url: config.b4db + bundle._id,
            	json: bundle
            }).pipe(res);
    	})().catch(function (err) {
    		res.json(502, {
    			error: 'bad_gateway',
    			reason: err.code
    		});
    	});
    });
};