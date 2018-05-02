'use strict';

var assert = require('assert');
var should = require('should');
var loopback = require('loopback');
var path = require('path');
var protoFile = path.join(__dirname, './fixtures/note.proto');

describe('grpc connector', function() {
  var server = require('./fixtures/server');
  var inst;

  before(function() {
    inst = server();
  });

  after(function() {
    inst.forceShutdown();
  });

  describe('grpc client generation', function() {
    it('generates client from local grpc spec - .proto file',
      function(done) {
        var ds = createDataSource(protoFile);
        ds.on('connected', function() {
          ds.connector.should.have.property('clients');
          done();
        });
      });
  });

  describe('models', function() {
    describe('models without remotingEnabled', function() {
      var ds;
      before(function(done) {
        ds = createDataSource(protoFile);
        ds.on('connected', function() {
          done();
        });
      });

      it('creates models', function(done) {
        var NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        (typeof NoteService.findById).should.eql('function');
        (typeof NoteService.find).should.eql('function');
        (typeof NoteService.create).should.eql('function');
        done();
      });

      it('supports model methods', function(done) {
        var NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        NoteService.create({title: 't1', content: 'c1'},
          function(err, result) {
            should.not.exist(err);
            done();
          });
      });

      it('supports model methods returning a Promise', function() {
        var NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        return NoteService.findById({id: 1}).then(function(res) {
          res.should.have.properties({title: 't1', content: 'c1'});
        });
      });
    });
  });

  describe('gRPC invocations', function() {
    var ds, NoteService;

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
