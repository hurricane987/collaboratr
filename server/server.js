var express = require('express');
var shortid = require('shortid');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var users = {};
var messages = {};
var collabs = {};
const PORT = 8080;

app.use('/:id', express.static('site'));
app.get('/', function(req, res){
	res.statusCode = 302;
  	res.setHeader('Location', '/' + shortid.generate());
  	res.end();
});

io.on('connection', function(socket){
	socket.on('init', function(data){
		if(!users.hasOwnProperty(data.collabId)){
			users[data.collabId] = [];
		};
		if(!messages.hasOwnProperty(data.collabId)){
			messages[data.collabId] = [];
		};
		if(!collabs.hasOwnProperty(data.collabId)){
			collabs[data.collabId] = {};
		};
		io.sockets.emit('init#' + data.collabId, {users: users[data.collabId], 
												 messages: messages[data.collabId],
												 editor: collabs[data.collabId]});
	});

	//UPDATE CODEMIRROR IN REALTIME
	socket.on('CodeMirror', function(data){
		collabs[data.collabId].textarea = data.value;
		socket.broadcast.emit('CodeMirror#' + data.collabId, data.value);
	});

	socket.on('join', function(data) {
		var currentUsers = users[data.collabId];
		data.value.hasWritePermission = (currentUsers.length === 0);
		currentUsers.push(data.value);
		socket.collabUser = data;

		//UPDATE USERS LIST ON JOIN
		io.sockets.emit('refresh-users#' + data.collabId, currentUsers);

		//UPDATE MESSAGES ON JOIN
		if(currentUsers.length > 1){
			messages[data.collabId].push(data.value.name + ' is now chillin');
			io.sockets.emit('refresh-messages#' + data.collabId, messages[data.collabId]);
		}
	});
	
	//KEEP USERS LIST CURRENT
	socket.on('update-users', function (data) {
		if(!users.hasOwnProperty(data.collabId)){
			console.log('Something is very wrong...');
		}
		users[data.collabId] = data.value;
		io.sockets.emit('refresh-users#' + data.collabId, data.value);
	});

	//HANLDLES NEW MESSAGES
	socket.on('new-message', function(data) {
		messages[data.collabId].push(data.name + ": " + data.value);
		io.sockets.emit('new-message#' + data.collabId, {name: data.name, value: data.value});
	});

	//UPDATE MODE
	socket.on('update-mode', function(data){
		collabs[data.collabId].currentMode = data.value;
		messages[data.collabId].push('stynax mode: ' + data.value);
		io.sockets.emit('update-mode#' + data.collabId, data.value);
		io.sockets.emit('refresh-messages#' + data.collabId, messages[data.collabId]);
	});

	socket.on('disconnect', function() {
		var data = socket.collabUser;
		
		// If user was never set, exit
		if (!data) {
			return;
		}
		var currentUsers = users[data.collabId];
		var updatedUsers = [];
		var hasEditor = false;
		messages[data.collabId].push(data.value.name + ' has left!');
		if(currentUsers) {
			currentUsers.forEach(function(user){
			if (user.name !== data.value.name) {
				updatedUsers.push(user);
				if (user.hasWritePermission) {
						hasEditor = true;
					}
				};
			});
			if (updatedUsers.length === 0) {
				delete users[data.collabId];
				delete messages[data.collabId];
				delete collabs[data.collabId];
				return;
			}
			if (updatedUsers.length && hasEditor === false) {
				updatedUsers[0].hasWritePermission = true;
				messages[data.collabId].push(updatedUsers[0].name + ' is now the editor');
			}
			users[data.collabId] = updatedUsers;
			io.sockets.emit('refresh-messages#' + data.collabId, messages[data.collabId]);
			io.sockets.emit('refresh-users#' + data.collabId, updatedUsers);
		}
	});
});

http.listen(process.env.PORT || PORT, function(){
	console.log('listening on ' + process.env.PORT || PORT);
});