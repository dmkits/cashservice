var startDateTime=new Date(), startTime=startDateTime.getTime();                                            console.log('STARTING at ',startDateTime );//test
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
            if(logParam.toLowerCase() == "console"){
                startupParams.logToConsole = true;
            }
        }
    }
    if (!startupParams.port)startupParams.port = 8080;
    if (!startupParams.mode)startupParams.mode = 'production';
    return startupParams;
}
try{
    var ENV=process.env.NODE_ENV;                                                                           if(ENV=="development") console.log("START IN DEVELOPMENT MODE");
    var startupParams = getStartupParams();                                                                 console.log('Started with startup params:',startupParams);//test
    var path = require('path'), fs = require('fs'), dateformat =require('dateformat'),
        log = require('winston');
} catch(e){                                                                                                 console.log("FAILED START! Reason: ", e.message);
    return;
}
module.exports.startupParams = startupParams;
module.exports.startupMode = startupParams.mode;

var logDebug = (ENV=='development' || ENV=='debug');                                                        if(logDebug) console.log("DEBUG LOG ON");
module.exports.logDebug = logDebug;
if(startupParams.logToConsole){
    log.configure({
        transports:[
            new (log.transports.Console)({colorize: true,level:(logDebug)?'silly':'info',timestamp:function(){
                return dateformat(Date.now(), "yyyy-mm-dd HH:MM:ss.l");
            } })
        ]
    });
} else {
    var logDir= path.join(__dirname, '/../logs/');
    try {
        if(!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    }catch (e){                                                                                             console.log("FAILED START! Reason: Failed create log directory! Reason:"+ e.message);
        return;
    }
    var transports  = [];
    transports.push(new (require('winston-daily-rotate-file'))({
        name: 'file', datePattern: 'YYYY-MM-DD', filename: path.join(logDir,"log_%DATE%.log")
    }));
    log = new log.Logger({transports: transports,level:(logDebug)?'silly':'info', timestamp:function(){
        return dateformat(Date.now(),"yyyy-mm-dd HH:MM:ss.l");
    }});
}                                                                                                           log.info('STARTING at', startDateTime );//test
module.exports.log=log;

var express = require('express');                                                                           log.info('express...', new Date().getTime() - startTime);//test
var bodyParser = require('body-parser');                                                                    log.info('body-parser...', new Date().getTime() - startTime);//test
var cookieParser = require('cookie-parser');                                                                log.info('cookie-parser...', new Date().getTime() - startTime);//test

var port = startupParams.port;
var app = express(),
    httpServer = require('http').Server(app);                                                               log.info('http...', new Date().getTime() - startTime);//test
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true,limit: '50mb'}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.text({limit: '50mb'}));
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
