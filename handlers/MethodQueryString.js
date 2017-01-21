(function() {
	const url = require("url"),
		querystring = require('querystring')
	module.exports = (ignoreBodyErrors) => {
		return function MethodQueryString(request,response,next) {
			if(request.url) {
				let parsed = url.parse(querystring.unescape(request.url),true);
				if(parsed.query.method) {
					request.method = parsed.query.method.toUpperCase();
					if(request.method==="POST" || request.method==="PUT") {
						try {
							request.body = JSON.parse(parsed.query.body);
						} catch(e) {
							if(!ignoreBodyErrors) {
								response.writeHead(400);
								response.end("Bad Request");
							}
						}
					}
				} else {
					parsed.query.method = "GET";
				}
			}
			return next;
		}
	};
}).call(this);