(function() {
	module.exports = function(imports) {
		const Dexterous = imports.Dexterous;
		Dexterous.URLContentType = function(request,response,next) {
			if(request.url) {
				const i = request.url.lastIndexOf(".");
				if(i>0) {
					const types = {
							".js": "application/javascript"
						},
						ext = request.url.substring(i);
					let type = types[ext];;
					if(type) {
						response.setHeader("Content-Type",type);
					}
				}
			}
			return next;
		}
		Dexterous.static = function(root) {
			return function(request,response,next) {
				const r = require,
					url = r("url"),
					path = r("path"),
					fs = r("fs");
				if(!request.url) {
					return next;
				}
				const uri = url.parse(request.url).pathname,
				filename = path.join(process.cwd()+(root && root.length>0 ? "/"+root : ""),uri);
				try {
					const data = fs.readFileSync(filename);
					response.writeHead(200);
					response.end(data);
				} catch(e) {
					return next;
				}
			}
		}
		Dexterous.virtual = function(alias,root) {
			return function(request,response,next) {
				const r = require,
					url = r("url"),
					path = r("path"),
					fs = r("fs");
				if(!request.url) {
					return next;
				}
				const uri = url.parse(request.url).pathname;
				if(uri.indexOf(alias)===0) {
					const filename = path.join(process.cwd()+uri.replace(alias,root));
					try {
						const data = fs.readFileSync(filename);
						response.writeHead(200);
						response.end(data);
					} catch(e) {
						return next;
					}
				}
			}
		}
		class DexterousServer extends Dexterous {
			constructor(server,options) {
				super(options);
				this.server = server;
			}
			listen(port,location) {
				const me = this;
				if(!me.server) {
					const r = require,
						protocol = (me.options.secure ? r("https") : r("http")),
						url = r("url"),
						path = r("path"),
						fs = r("fs"),
						WebSocket = r("ws"),
						os = r("os"),
						SocketServer = WebSocket.Server;
					me.server = protocol.createServer((request,response) => {
						const uri = url.parse(request.url).pathname;
						if(uri==="/dexterous.js") {
				    		const filename = path.join(process.cwd(), "/index.js");
							response.writeHead(200, { "Content-Type":"text/javascript","Access-Control-Allow-Origin":"*" });
							fs.readFile(filename,(err,data) => {
								response.end(data);
							});
						} else {
							me.onmessage(request,response);
						}
					});
					me.socket = new SocketServer({server:me.server});
					me.use(function *(request,response,next) {
						yield next;
						if(request.url) {
							const uri = url.parse(request.url).pathname,
							filename = path.join(process.cwd(),uri);
							fs.readFile(filename,(err,data) => {
								if(!err) {
									response.writeHead(200);
									response.end(data);
								} else {
									response.writeHead(404, "text/plain");
									response.end("Not Found");
								}
							});
						} else if(!response.getHeader("Status")){
							response.writeHead(501, "text/plain");
							response.end("Not Implemented");
						}
					});
				};
				return new Promise((resolve,reject) => {
					me.server.listen(port,location,() => { 
						 console.log("Dexterous listening on " + (me.options.secure ? "https" : "http") + "://" + (location ? location : "*") + ":" + port);
						 resolve();
					});
					me.socket.on("connection", (ws) => {
						ws.on("message",(message) => { 
							try {
								message = (typeof(message)==="string" ? JSON.parse(message) : message);
								message.headers || (message.headers={});
							} catch(e) {
								// ignore;
							}
							const response = me.createResponse(message,ws);
							me.onmessage(message,response);
						});
						ws.on("error",me.onerror);
					});
				});
			}
			broadcast(response) {
				const me = this;
				me.socket.clients.forEach((client,i) => {
					const message = me.createResponse(undefined,client);
					message.headers = response.headers;
					message.body = response.body;
					message.headers.sent = false;
					message.end();
				});
			}
		}
		return DexterousServer;
	}
}).call(this);