// Copyright IBM Corp. 2016,2018. All Rights Reserved.
// Node module: loopback-connector-grpc

'use strict';

const assert = require('assert');
const should = require('should');
const loopback = require('loopback');
const path = require('path');
const protoFile = path.join(__dirname, './fixtures/note.proto');

describe('grpc connector', function() {
  const server = require('./fixtures/server');
  let inst;

  before(function() {
    inst = server();
  });

  after(function() {
    inst.forceShutdown();
  });

  describe('grpc client generation', function() {
    it('generates client from local grpc spec - .proto file',
      function(done) {
        const ds = createDataSource(protoFile);
        ds.on('connected', function() {
          ds.connector.should.have.property('clients');
          done();
        });
      });
  });

  describe('models', function() {
    describe('models without remotingEnabled', function() {
      let ds;
      before(function(done) {
        ds = createDataSource(protoFile);
        ds.on('connected', function() {
          done();
        });
      });

      it('creates models', function(done) {
        const NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        (typeof NoteService.findById).should.eql('function');
        (typeof NoteService.find).should.eql('function');
        (typeof NoteService.create).should.eql('function');
        done();
      });

      it('supports model methods', function(done) {
        const NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        NoteService.create({title: 't1', content: 'c1'},
          function(err, result) {
            should.not.exist(err);
            done();
          });
      });

      it('supports model methods returning a Promise', function() {
        const NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        return NoteService.findById({id: 1}).then(function(res) {
          res.should.have.properties({title: 't1', content: 'c1'});
        });
      });
    });
  });

  describe('gRPC invocations', function() {
    let ds, NoteService;

    before(function(done) {
      ds = createDataSource(protoFile, true);
      ds.on('connected', function() {
        NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        done();
      });
    });

    it('invokes the NoteService', function(done) {
      NoteService.create({title: 't2', content: 'c2'}, function(err, result) {
        result.id.should.eql(2);
        done();
      });
    });
  });
});

function createDataSource(spec, remotingEnabled) {
  return loopback.createDataSource('grpc', {
    connector: require('../index'),
    spec: spec,
    remotingEnabled: remotingEnabled,
  });
}
