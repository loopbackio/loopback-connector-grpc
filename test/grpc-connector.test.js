// Copyright IBM Corp. 2016,2020. All Rights Reserved.
// Node module: loopback-connector-grpc
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('should');
const loopback = require('loopback');
const path = require('path');
const protoFile = path.join(__dirname, './fixtures/note.proto');

describe('grpc connector', () => {
  const server = require('./fixtures/server');
  let inst;

  before(async () => {
    inst = await server('0.0.0.0:50000');
  });

  after(() => {
    if (inst != null) inst.forceShutdown();
  });

  describe('grpc client generation', () => {
    it('generates client from local grpc spec - .proto file',
      function(done) {
        const ds = createDataSource(protoFile);
        ds.on('connected', () => {
          ds.connector.should.have.property('clients');
          done();
        });
      });
  });

  describe('models', () => {
    describe('models without remotingEnabled', () => {
      let ds;
      before(function(done) {
        ds = createDataSource(protoFile);
        ds.on('connected', () => {
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

      it('supports model methods returning a Promise', () => {
        const NoteService = ds.createModel('NoteService', {}, {base: 'Model'});
        return NoteService.findById({id: 1}).then(function(res) {
          res.should.have.properties({title: 't1', content: 'c1'});
        });
      });
    });
  });

  describe('gRPC invocations', () => {
    let ds, NoteService;

    before(function(done) {
      ds = createDataSource(protoFile, true);
      ds.on('connected', () => {
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
    host: '127.0.0.1',
    port: 50000,
    remotingEnabled: remotingEnabled,
  });
}
