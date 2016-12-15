var path = require('path');
var PROTO_PATH = path.join(__dirname, './note.proto');
var debug = require('debug')('loopback:connector:grpc');
var grpc = require('grpc');

var notes = {};
var index = 0;

/**
 * Implements the SayHello RPC method.
 */
function create(call, callback) {
  debug('create', call.request);
  var note = call.request;
  index++;
  note.id = index;
  notes[index.toString()] = note;
  callback(null, note);
}

function findById(call, callback) {
  debug('findById', call.request);
  var id = call.request.id;
  var note = notes[id];
  callback(null, note);
}

function find(call, callback) {
  debug('find', call.request);
  var values = [];
  for (var i in notes) {
    values.push(notes[i]);
  }
  callback(null, { notes: values });
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
  var proto = grpc.load(PROTO_PATH);
  var server = new grpc.Server();
  server.addProtoService(proto.demo.NoteService.service, {
    create: create,
    findById: findById,
    find: find,
  }
  );
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  server.start();
  return server;
}

module.exports = main;

if (module === require.main) {
  main();
}
