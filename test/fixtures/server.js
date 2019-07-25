// Copyright IBM Corp. 2016,2017. All Rights Reserved.
// Node module: loopback-connector-grpc

'use strict';

const path = require('path');
const PROTO_PATH = path.join(__dirname, './note.proto');
const debug = require('debug')('loopback:connector:grpc');
const grpc = require('grpc');

const notes = {};
let index = 0;

/**
 * Implements the SayHello RPC method.
 */
function create(call, callback) {
  debug('create', call.request);
  const note = call.request;
  index++;
  note.id = index;
  notes[index.toString()] = note;
  callback(null, note);
}

function findById(call, callback) {
  debug('findById', call.request);
  const id = call.request.id;
  const note = notes[id];
  callback(null, note);
}

function find(call, callback) {
  debug('find', call.request);
  const values = [];
  for (const i in notes) {
    values.push(notes[i]);
  }
  callback(null, {notes: values});
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
  const proto = grpc.load(PROTO_PATH);
  const server = new grpc.Server();
  server.addService(proto.demo.NoteService.service, {
    create: create,
    findById: findById,
    find: find,
  });
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  server.start();
  return server;
}

module.exports = main;

if (module === require.main) {
  main();
}
