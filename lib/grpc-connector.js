// Copyright IBM Corp. 2016,2020. All Rights Reserved.
// Node module: loopback-connector-grpc
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const fs = require('fs');
const debug = require('debug')('loopback:connector:grpc');
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const utils = require('./utils');

/**
 * Export the initialize method to loopback-datasource-juggler
 * @param {DataSource} dataSource The dataSource object
 * @param callback
 */

exports.initialize = function initializeDataSource(dataSource, callback) {
  const settings = dataSource.settings || {};

  const connector = new GRPCConnector(settings);

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
  const self = this;

  if (!self.spec) {
    process.nextTick(function() {
      cb(new Error('No grpc specification provided'));
    });
    return;
  }

  debug('Loading proto file: %s', self.spec);
  const pkgDef = protoLoader.loadSync(self.spec, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  self.proto = grpc.loadPackageDefinition(pkgDef);

  const services = utils.discoverServices(this.proto);
  const host = this.settings.host || this.settings.hostname || 'localhost';
  const port = this.settings.port || 50051;
  const url = this.settings.url || (host + ':' + port);

  let credentials;
  if (typeof this.settings.security === 'object' &&
    this.settings.security != null) {
    const rootCerts = fs.readFileSync(this.settings.security.rootCerts);
    const key = this.settings.security.key &&
      fs.readFileSync(this.settings.security.key);
    const cert = this.settings.security.cert &&
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
  const self = this;
  if (this.grpcParsed && this.DataAccessObject) {
    return this.DataAccessObject;
  }

  this.grpcParsed = true;

  this.clients.forEach(function(c) {
    const client = c.client;
    const methods = utils.discoverMethods(c.service);
    for (const m in methods) {
      debug('Adding method: %s.%s', c.name, m);
      self.DataAccessObject[m] = createMethod(c.client, m, methods[m],
        self.settings.remotingEnabled);
    }
  });

  return this.DataAccessObject;
};

function createMethod(client, name, method, remoting) {
  const fn = function() {
    const args = [].slice.call(arguments);
    const lastArg = args.length ? args[args.length - 1] : undefined;
    let callback = typeof lastArg === 'function' ? lastArg : undefined;

    if (callback) {
      client[name].apply(client, arguments);
    } else {
      callback = utils.createPromiseCallback();
      args.push(callback);
      client[name].apply(client, args);
      return callback.promise;
    }
  };

  if (!remoting) return fn;

  fn.accepts = [];
  fn.shared = true;

  const req = method.resolvedRequestType;
  const res = method.resolvedResponseType;
  let options = method.options || {};

  for (const p in req) {
    const f = req[p];
    console.log(f);
    const type = utils.proto2jsonType(f.type.name, f.repeated);
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

