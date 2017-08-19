"use strict";

var http = require('http'),
    url = require('url')
    ,querystring = require('querystring');

var logger = require('appium-logger');
logger = logger.getLogger('Appium');
var testwaServer = {};

var host ='localhost';
var port = 8008;
var path = '/attp/client';


testwaServer.SendDataNativeApp =  function(replyData, portal = 'localhost:8008/attp/client'){
    let portalURL  = url.parse(portal);
    var content = JSON.stringify(replyData);
    var options = {
        host: portalURL.hostname,
        port: portalURL.port,
        path: portalURL.pathname,
        method: 'POST',
        header: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': content.length
        }
    };
    var req_testwa = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(data) {
            logger.debug(" waHeart beating!");
        });
    });

    req_testwa.write(content);
    req_testwa.end();
};


testwaServer.SendStartStatus =  function(datas, deviceid, testcaselogId, testwaport, res){
    var start_path = path + '/' + deviceid + '/' + testcaselogId + '/' + testwaport;
    logger.debug("===start_path: "+start_path);
    var content = JSON.stringify(datas);
    var options = {
        host: host,
        port: port,
        path: start_path,
        method: 'POST',
        header: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': content.length
        }
    };
    var req_testwa = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(data) {
            logger.debug("waHeart beating!");
        });
    });

    req_testwa.write(content);
    req_testwa.end();
};

testwaServer.SendDataWebview =  function(datas,res){

    var content = JSON.stringify(datas);
    var options = {
        host: host,
        port: port,
        path: path,
        method: 'POST',
        header: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': content.length
        }
    };
    var req_testwa = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(data) {
            logger.debug("test webview case is ok!");
        });
    });

    req_testwa.write(content);
    req_testwa.end();
};

module.exports = testwaServer;