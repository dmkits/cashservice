var startTime = new Date().getTime();                                                                       console.log("SERVER STARTING...");

function getStartupParams() {
    var startupParams = {};
    if (process.argv.length == 0) {
        startupParams.mode = 'production';
        startupParams.port = 8080;
        return startupParams;
    }
    for (var i = 2; i < process.argv.length; i++) {
        if (process.argv[i].indexOf('-p:') == 0) {
            var port = process.argv[i].replace("-p:", "");
            if (port > 0 && port < 65536) {
                startupParams.port = port;
            }
        } else if (process.argv[i].charAt(0).toUpperCase() > 'A' && process.argv[i].charAt(0).toUpperCase() < 'Z') {
            startupParams.mode = process.argv[i];
        } else if (process.argv[i].indexOf('-log:') == 0) {
            var logParam = process.argv[i].replace("-log:", "");
            if (logParam.toLowerCase() == "console") {
                startupParams.logToConsole = true;
            }
        }
    }
    if (!startupParams.port)startupParams.port = 8080;
    if (!startupParams.mode)startupParams.mode = 'production';
    return startupParams;
}
var startupParams = getStartupParams();
module.exports.startupParams = startupParams;
module.exports.startupMode = startupParams.mode;

var log = require('winston');                                                                               log.info('winston...', new Date().getTime() - startTime);//test
module.exports.log=log;
if (!startupParams.logToConsole) {
    log.add(log.transports.File, {filename: 'history.log', level: 'debug', timestamp: true});
    log.remove(log.transports.Console);
}

var fs = require('fs');

var express = require('express');                                                                           log.info('express...', new Date().getTime() - startTime);//test
var bodyParser = require('body-parser');                                                                    log.info('body-parser...', new Date().getTime() - startTime);//test
var cookieParser = require('cookie-parser');                                                                log.info('cookie-parser...', new Date().getTime() - startTime);//test

var port = startupParams.port;
var app = express(),
    httpServer = require('http').Server(app);                                                               log.info('http...', new Date().getTime() - startTime);//test
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use('/', express.static('public'));
app.use(function (req, res, next) {                                                                         log.info("req:",req.method,req.path,"params=",req.query,{});//log.info("req.headers=",req.headers,"req.cookies=",req.cookies,{});
    next();
});
var path = require('path');                                                                                 log.info('path...', new Date().getTime() - startTime);//test
global.appPagesPath= path.join(__dirname,'/../pages/','');

var sysConfigFilePath='./'+startupParams.mode+'.cfg',
    sysConfig, sysConfigErr;
function loadSysConfig(){
    log.info('tryLoadConfiguration...', new Date().getTime() - startTime);//test
    try {
        var sSysConfig = fs.readFileSync(sysConfigFilePath);
        sysConfig = JSON.parse(sSysConfig);
        sysConfigErr = null;
    } catch (e) {
        sysConfigErr = "Failed to load configuration! Reason:" + e;
    }
}
module.exports.setAndStoreSysConfig=function(newSysConfig,callback){
    sysConfig=newSysConfig;
    fs.writeFile(sysConfigFilePath, JSON.stringify(sysConfig), function(err,success){
        callback((err)?{storeErr:err}:null,success);
    })
};
loadSysConfig();
module.exports.loadSysConfig=loadSysConfig;
module.exports.getSysConfig= function(){ return sysConfig; };
module.exports.getSysConfigErr= function(){ return sysConfigErr; };

var database = require('./database');                                                                       log.info('./dataBase...', new Date().getTime() - startTime);//test
if(!sysConfigErr) database.dbConnect();                                                                     log.info('database.dbConnect...', new Date().getTime() - startTime);//test
require('./procUniCashserver');                                                                             log.info('./procUniCashserver...', new Date().getTime() - startTime);//test

require('./sysadmin')(app,httpServer);

httpServer.listen(port, function(err){
    console.log("SERVER RUNS with startup parameters",startupParams);
    log.info("SERVER RUNS with startup parameters",startupParams, new Date().getTime() - startTime);
});                                                                                                         log.info("SERVER STARTED", new Date().getTime() - startTime);
