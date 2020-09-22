// Copyright IBM Corp. 2016,2020. All Rights Reserved.
// Node module: loopback-connector-grpc
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const debug = require('debug')('loopback:connector:grpc');
const ServiceClient = require('@grpc/grpc-js').ServiceClient;

/**
 * @private
 *
 * Discover an array services from the loaded proto object
 * @param {Function[]} services
 * @param {object} proto
 */
function introspectServices(services, proto) {
  for (const pkg in proto) {
    const pkgDef = proto[pkg];
    for (const i in pkgDef) {
      if (typeof pkgDef[i] === 'function' && pkgDef[i].service) {
        // Found a grpc service
        debug('Service: %s %s', i);
        services.push({
          name: i,
          client: pkgDef[i],
        });
      }
      // Recurse into the package
      if (pkgDef[i].constructor === Object) {
        introspectServices(services, proto[i]);
      }
    }
  }
}

/**
 * @public
 *
 * Discover an array services from the loaded proto object
 * @param {object} proto
 * @returns {Function[]} services discovered
 */
function discoverServices(proto) {
  const services = [];
  introspectServices(services, proto);
  return services;
}

function discoverMethods(service) {
  const descriptor = service.service;
  const methods = {};
  for (const d in descriptor) {
    debug('Method: %s', d);
    methods[d] = descriptor[d];
  }
  return methods;
}

/**
 * Parse gRPC http annotations
 * https://github.com/googleapis/googleapis/blob/master/google/api/http.proto
 *
 * @param {object} options `{"(google.api.http).post": "/notes"}`
 * @param {string} key annotation name
 * @returns {method: 'post', path: '/notes'}
 */
function parseHttpOptions(options, key) {
  const properties = {};
  key = key || 'google.api.http';
  const verbs = ['get', 'put', 'post', 'delete', 'patch', 'head'];
  if (key in options) {
    /*
     option (google.api.http) = {
     put: "/v1/messages/{message_id}"
     body: "message"
     };
     */
    const http = options[key];
    for (const v in http) {
      if (verbs.indexOf(v) !== -1) {
        properties.method = v;
        properties.path = http[v];
        break;
      }
    }
  } else {
    /*
     option (google.api.http).get = "/v1/messages/{message_id}/{sub.subfield}";
     */
    const prefix = '(' + key + ').';
    for (const i in options) {
      if (i.indexOf(prefix) === 0) {
        const p = i.substring(prefix.length);
        if (verbs.indexOf(p) !== -1) {
          properties.path = options[i];
          properties.method = p;
        } else {
          properties[p] = options[i];
        }
      }
    }
  }
  return properties;
}

function proto2jsonType(protoType, repeated) {
  // https://developers.google.com/protocol-buffers/docs/proto3#json
  const mapping = {
    message: 'object',
    enum: 'string',
    map: 'object',
    repeated: 'array',
    bool: 'boolean',
    string: 'string',
    bytes: 'string',
    int32: 'number',
    fixed32: 'number',
    uint32: 'number',
    int64: 'string',
    fixed64: 'string',
    uint64: 'string',
    float: 'number',
    double: 'number',
    Any: 'object',
    Timestamp: 'date',
    Duration: 'string',
    Struct: 'object',
    ListValue: 'array',
    Value: 'any',
    NullValue: null,
  };
  const type = mapping[protoType] || protoType || 'string';
  if (repeated) {
    return [type];
  } else {
    return type;
  }
}

function createPromiseCallback() {
  let cb;
  const promise = new Promise(function(resolve, reject) {
    cb = function(err, data) {
      if (err) return reject(err);
      return resolve(data);
    };
  });
  cb.promise = promise;
  return cb;
}

exports.discoverServices = discoverServices;
exports.discoverMethods = discoverMethods;
exports.parseHttpOptions = parseHttpOptions;
exports.proto2jsonType = proto2jsonType;
exports.createPromiseCallback = createPromiseCallback;
