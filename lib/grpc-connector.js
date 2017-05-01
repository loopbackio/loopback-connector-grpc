'use strict';

var fs = require('fs');
var path = require('path');
var url = require('url');
var debug = require('debug')('loopback:connector:grpc');
var VERSION = require('../package.json').version;
var grpc = require('grpc');
var utils = require('./utils');

/**
 * Export the initialize method to loopback-datasource-juggler
 * @param {DataSource} dataSource The dataSource object
 * @param callback
 */

exports.initialize = function initializeDataSource(dataSource, callback) {
  var settings = dataSource.settings || {};

  var connector = new GRPCConnector(settings);

  dataSource.connector = connector;
  dataSource.connector.dataSource = dataSource;
  if (!settings.lazyConnect) {
    connector.connect(callback);
  } else {
    process.nextTick(function() {
      if (callback) callback();
    });
  }
};

/**
 * The GRPCConnector constructor
 * @param {Object} settings The connector settings
 * @constructor
 */
function GRPCConnector(settings) {
  settings = settings || {};

  this.settings = settings;
  this.spec = settings.spec;

  if (debug.enabled) {
    debug('Settings: %j', settings);
  }

  this._models = {};
  this.DataAccessObject = function() {
    // Dummy function
  };
}

/**
 * Parse grpc specification, setup client and export client
 * @param {Function} callback function
 * @prototype
 */

GRPCConnector.prototype.connect = function(cb) {
  var self = this;

  if (!self.spec) {
    process.nextTick(function() {
      cb(new Error('No grpc specification provided'));
    });
    return;
  }

  debug('Loading proto file: %s', self.spec);
  self.proto = grpc.load(self.spec);

  var services = utils.discoverServices(this.proto);
  var host = this.settings.host || this.settings.hostname || 'localhost';
  var port = this.settings.port || 50051;
  var url = this.settings.url || (host + ':' + port);

  var credentials;
  if (typeof this.settings.security === 'object' &&
    this.settings.security != null) {
    var rootCerts = fs.readFileSync(this.settings.security.rootCerts);
    var key = this.settings.security.key &&
      fs.readFileSync(this.settings.security.key);
    var cert = this.settings.security.cert &&
      fs.readFileSync(this.settings.security.cert);
    credentials = grpc.credentials.createSsl(rootCerts, key, cert);
  } else {
    credentials = grpc.credentials.createInsecure();
  }

  self.clients = [];
  services.forEach(function(service) {
    self.clients.push({
      name: service.name,
      service: service.client,
      client: new service.client(url, credentials),
    });
  });

  self.setupDataAccessObject();
  process.nextTick(function() {
    cb(null, self.clients);
  });
};

// Parse grpc specification, setup client and export client

GRPCConnector.prototype.setupDataAccessObject = function() {
  var self = this;
  if (this.grpcParsed && this.DataAccessObject) {
    return this.DataAccessObject;
  }

  this.grpcParsed = true;

  this.clients.forEach(function(c) {
    var client = c.client;
    var methods = utils.discoverMethods(c.service);
    for (var m in methods) {
      debug('Adding method: %s.%s', c.name, m);
      self.DataAccessObject[m] = createMethod(c.client, m, methods[m],
        self.settings.remotingEnabled);
    }
  });

  return this.DataAccessObject;
};

function createMethod(client, name, method, remoting) {
  var fn = function() {
    return client[name].apply(client, arguments);
  };

  if (!remoting) return fn;

  fn.accepts = [];
  fn.shared = true;

  var req = method.resolvedRequestType;
  var res = method.resolvedResponseType;
  var options = method.options || {};

  for (var p in req) {
    var f = req[p];
    console.log(f);
    var type = utils.proto2jsonType(f.type.name, f.repeated);
    fn.accepts.push({
      arg: f.name,
      type: type,
      required: f.required,
      http: {source: 'query'},
    });
  }

  fn.returns = {arg: 'data', type: 'object', root: true};

  options = utils.parseHttpOptions(options);
  fn.http = {
    verb: options.method || 'post',
    path: options.path || ('/' + method.name),
  };

  debug(fn);
  return fn;
}

