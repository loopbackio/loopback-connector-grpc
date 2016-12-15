/**
 * @private
 *
 * Discover an array services from the loaded proto object
 * @param {Function[]} services
 * @param {object} proto
 */
function introspectServices(services, proto) {
  for (var p in proto) {
    if (typeof proto[p] === 'function' && proto[p].service &&
      proto[p].service.className === 'Service') {
      // Found a grpc service
      services.push(proto[p]);
    }
    // Recurse into the package
    if (proto[p].constructor === Object) {
      introspectServices(services, proto[p]);
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
  var services = [];
  introspectServices(services, proto);
  return services;
}

function discoverMethods(service) {
  var descriptor = service.service;
  var methods = {};
  descriptor.children.forEach(function(c) {
    if (c.className === 'Service.RPCMethod') {
      methods[c.name] = c;
    }
  });
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
  var properties = {};
  key = key || 'google.api.http';
  var verbs = ['get', 'put', 'post', 'delete', 'patch', 'head'];
  if (key in options) {
    /*
     option (google.api.http) = {
     put: "/v1/messages/{message_id}"
     body: "message"
     };
     */
    var http = options[key];
    for (var v in http) {
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
    var prefix = ('(' + key + ').');
    for (var i in options) {
      if (i.indexOf(prefix) === 0) {
        var p = i.substring(prefix.length);
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
  var mapping = {
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
    NullValue: null
  };
  var type = mapping[protoType] || protoType || 'string';
  if (repeated) {
    return [type];
  } else {
    return type;
  }
}

exports.discoverServices = discoverServices;
exports.discoverMethods = discoverMethods;
exports.parseHttpOptions = parseHttpOptions;
exports.proto2jsonType = proto2jsonType;
