
var startTime = new Date().getTime();

function startupParams() {
    var app_params = {};
    if (process.argv.length == 0) {
        app_params.mode = 'production';
        app_params.port = 8080;
        return app_params;
    }
    for (var i = 2; i < process.argv.length; i++) {
        if (process.argv[i].indexOf('-p:') == 0) {
            var port = process.argv[i].replace("-p:", "");
            if (port > 0 && port < 65536) {
                app_params.port = port;
            }
        } else if (process.argv[i].charAt(0).toUpperCase() > 'A' && process.argv[i].charAt(0).toUpperCase() < 'Z') {
            app_params.mode = process.argv[i];
        } else if (process.argv[i].indexOf('-log:') == 0) {
            var logParam = process.argv[i].replace("-log:", "");
            if (logParam.toLowerCase() == "console") {
                app_params.logToConsole = true;
            }
        }
    }
    if (!app_params.port)app_params.port = 8080;
    if (!app_params.mode)app_params.mode = 'production';
    return app_params;
}

var app_params = startupParams();

var log = require('winston');

if (!app_params.logToConsole) {
    log.add(log.transports.File, {filename: 'somefile.log', level: 'debug', timestamp: true});
    log.remove(log.transports.Console);
}

module.exports.startupMode = app_params.mode;

var fs = require('fs');
log.info('fs...', new Date().getTime() - startTime);//test
var express = require('express');
log.info('express...', new Date().getTime() - startTime);//test

//var app = require('express').createServer();
var port = app_params.port;
var path = require('path');
log.info('path...', new Date().getTime() - startTime);//test
var bodyParser = require('body-parser');
log.info('body-parser...', new Date().getTime() - startTime);//test
var cookieParser = require('cookie-parser');
log.info('cookie-parser...', new Date().getTime() - startTime);//test
var request = require('request');
log.info('request...', new Date().getTime() - startTime);//test
var Buffer = require('buffer').Buffer;
log.info('buffer...', new Date().getTime() - startTime);//test
var iconv_lite = require('iconv-lite');
log.info('iconv-lite...', new Date().getTime() - startTime);//test
var parseString = require('xml2js').parseString;
log.info('xml2js...', new Date().getTime() - startTime);//test


var app = express();
var server = require('http').Server(app);
log.info('http...', new Date().getTime() - startTime);//test
var io = require('socket.io')(server);
log.info('socket.io...', new Date().getTime() - startTime);//test


app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use('/', express.static('public'));
var database = require('./dataBase');
log.info('./dataBase...', new Date().getTime() - startTime);//test
var ConfigurationError, DBConnectError;


tryLoadConfiguration();
function tryLoadConfiguration() {
    log.info('tryLoadConfiguration...', new Date().getTime() - startTime);//test
    try {
        database.loadConfig();
        ConfigurationError = null;
    } catch (e) {
        ConfigurationError = "Failed to load configuration! Reason:" + e;
    }
}
if (!ConfigurationError) tryDBConnect();
function tryDBConnect(postaction) {
    log.info('tryDBConnect...', new Date().getTime() - startTime);//test
    database.databaseConnection(function (err) {
        DBConnectError = null;
        if (err) {
            DBConnectError = "Failed to connect to database! Reason:" + err;
        }
        if (postaction)postaction(err);
        log.info('tryDBConnect DBConnectError=', DBConnectError);//test
    });
}


app.get("/sysadmin", function (req, res) {
    log.info('URL: /sysadmin');
    res.sendFile(path.join(__dirname, '/views', 'sysadmin.html'));
});
app.get("/sysadmin/app_state", function (req, res) {
    log.info('URL: /sysadmin/app_state');
    var outData = {};
    outData.mode = app_params.mode;
    if (ConfigurationError) {
        outData.error = ConfigurationError;
        res.send(outData);
        return;
    }
    outData.configuration = database.getDBConfig();
    if (DBConnectError)
        outData.dbConnection = DBConnectError;
    else
        outData.dbConnection = 'Connected';
    res.send(outData);
});
app.get("/sysadmin/startup_parameters", function (req, res) {
    log.info('URL: /sysadmin/startup_parameters');
    res.sendFile(path.join(__dirname, '/views/sysadmin', 'startup_parameters.html'));
});
app.get("/sysadmin/startup_parameters/load_app_config", function (req, res) {
    log.info('URL: /sysadmin/startup_parameters/get_app_config');
    tryLoadConfiguration();
    if (ConfigurationError) {
        res.send({error: ConfigurationError});
        return;
    }
    res.send(database.getDBConfig());
});
app.post("/sysadmin/startup_parameters/store_app_config_and_reconnect", function (req, res) {
    log.info('URL: /sysadmin/startup_parameters/get_app_config', 'newDBConfigString =', req.body);
    var newDBConfigString = req.body;
    database.setDBConfig(newDBConfigString);
    database.saveConfig(
        function (err) {
            var outData = {};
            if (err) outData.error = err;
            tryDBConnect(/*postaction*/function (err) {
                if (DBConnectError) outData.DBConnectError = DBConnectError;
                res.send(outData);
            });
        }
    );
});
app.get("/sysadmin/import_sales", function (req, res) {
    log.info('URL: /sysadmin/import_sales');
    res.sendFile(path.join(__dirname, '/views/sysadmin', 'import_sales.html'));
});
app.get("/sysadmin/import_sales/get_all_cashboxes", function (req, res) {
    database.getAllCashBoxes(function (err, result) {
        var outData = {};
        if (err) outData.error = err.message;
        outData.items = result;
        outData.success = "ok";
        res.send(outData);
    });
});

function emitAndLogEvent(msg, cashBoxFacID, callback) {
    database.logToDB(msg, cashBoxFacID, function (err, res) {
        if (err) {
            log.error("emitAndLogEvent err=", err);
            io.emit('new_event', "Не удалось записать log в БД. Reason:"+ err);
        } else io.emit('new_event', msg);
        if (callback) callback(err, res);
    });
};

function getDataFromUniCashServer(xml, callback) {
    var cashserver_url = database.getDBConfig()['cashserver.url'];
    var cashserver_port = database.getDBConfig()['cashserver.port'];
    var xmlText = "";
    for (var i in xml) {
        var xmlLine = xml[i].XMLText;
        xmlText = xmlText + xmlLine;
    }
    var textLengthStr = xmlText.length + "";
    request.post({
        headers: {'Content-Type': 'text/xml;charset=windows-1251', 'Content-Length': textLengthStr},

        uri: 'http://' + cashserver_url + ':' + cashserver_port + '/lsoft',
        //uri:'http://5.53.113.251:12702/lsoft',//real url
        // uri:'http://5.53.113.217:12702/lsoft', //test wrong url no resp
        // uri:'http://5.53.113.251:12702/',//test empty resp.body
        // uri:'',//test
        body: xmlText,
        encoding: 'binary'
        ,timeout:5000
    }, function (error, response, body) {
        callback(error, response, body);
        return;

    });
};
function getChequesData(body, callback) {
    var buf = new Buffer(body, 'binary');
    var str = iconv_lite.decode(buf, 'win1251');
    body = iconv_lite.encode(str, 'utf8');

    parseString(body, function (err, result) {
        var outData = {};
        outData.sales = [];
        if (err) {
            log.info(err);
            callback(err);
            return;
        }
        if(!result){
            log.warn("Кассовый сервер вернул пустой файл!"); // Проверка на валидность ответа
            outData.respErr = "Кассовый сервер вернул пустой файл!";
            callback(outData.respErr);
            return;
        }
        if(result && result.ERROR){
            var stringResult=JSON.stringify(result.ERROR)?JSON.stringify(result.ERROR):result.ERROR;
            log.warn("Oтвет кассового сервера: " +stringResult); // Проверка на валидность ответа
            outData.respErr ="Oтвет кассового сервера: " + stringResult;
            callback(outData.respErr);
            return;
        }
        if (!result.gw_srv_rsp || !result.gw_srv_rsp.select) {
            var stringResult=JSON.stringify(result)?JSON.stringify(result):result;
            log.warn("Oтвет кассового сервера: " +stringResult); // Проверка на валидность ответа
            outData.respErr = "Oтвет кассового сервера: " +stringResult;
            callback(outData.respErr);
            return;
        }
        try {
            var cashBoxList = result.gw_srv_rsp.select[0].FISC[0].EJ;
            for (var fn in cashBoxList) {
                var cashBox = cashBoxList[fn];
                var cashBoxID = cashBox.$.ID;
                var docList = cashBoxList[fn].DAT;
                for (var i in docList) {
                    var listItem = docList[i];
                    if (listItem.Z) {
                        listItem.isZReport = true;
                    }
                    else if (listItem.C[0].$.T == '0')listItem.isSale = true;
                    else if (listItem.C[0].$.T == '1') {
                        listItem.isReturn = true;
                        log.error("Операция возврврата не поддерживается!");
                        callback("Операция возврврата не поддерживается!");
                        return;
                    }
                    //else if (listItem.C[0].$.T == '2') {
                    //    var inner =listItem.C[0].$.T;
                    //     if(inner.I)listItem.isMoneyIn;
                    //     else if(inner.O)listItem.isMoneyOut;
                    //     else{ log.error("Неизвестная операция");
                    //         callback("Неизвестная операция");
                    //         return;
                    //     }
                    //}
                    else if (listItem.C[0].$.T == '2') {
                        listItem.isInner = true;
                    }
                    else {
                        log.error("Неизвестная операция");
                        callback("Неизвестная операция");
                        return;
                    }

                    if (listItem.isSale) {
                        var cheque = {};

                        cheque.checkDataID = listItem.$.DI;                   //DAT ID  не исп
                        cheque.ITN = listItem.$.TN;                            //ИНН не исп
                        cheque.dataVersion = listItem.$.V;                     // Версия формата пакета данных не исп
                        cheque.cashBoxFabricNum = listItem.$.ZN;
                        cheque.dataFormDate = listItem.TS[0];                        //не исп.

                        var goodsList = listItem.C[0].P;
                        cheque.productsInCheck = [];
                        cheque.checkNumber = "1111" + listItem.C[0].E[0].$.NO;
                        cheque.totalCheckSum = listItem.C[0].E[0].$.SM;         //не исп
                        cheque.operatorID = listItem.C[0].E[0].$.CS;
                        cheque.fixalNumPPO = listItem.C[0].E[0].$.FN;         //не исп
                        cheque.checkDate = listItem.C[0].E[0].$.TS;

                        if (listItem.C[0].E[0].TX) {                                       //если налогов несколько может не использоваться
                            var taxInfo = listItem.C[0].E[0].TX[0].$;
                            if (taxInfo.DTNM) cheque.AddTaxName = taxInfo.DTNM; //не исп
                            if (taxInfo.DTPR) cheque.AddTaxRate = taxInfo.DTPR; //не исп
                            if (taxInfo.DTSM) cheque.AddTaxSum = taxInfo.DTSM;  //не исп
                            if (taxInfo.TX) cheque.taxMark = taxInfo.TX;     //не исп
                            if (taxInfo.TXPR) cheque.taxRate = taxInfo.TXPR;  //не исп
                            if (taxInfo.TXSM) cheque.taxSum = taxInfo.TXSM;   //не исп
                            if (taxInfo.TXTY) cheque.isTaxIncluded = taxInfo.TXTY;    //не исп    //"0"-включ в стоимость, "1" - не включ.
                        }

                        var payment = listItem.C[0].M[0].$;
                        cheque.buyerPaymentSum = payment.SM;
                        if (payment.NM)cheque.paymentName = payment.NM;
                        cheque.paymentType = payment.T;                                  //"0" - нал. не "0" - безнал
                        if (payment.RM) cheque.change = payment.RM;
                        for (var pos in goodsList) {
                            var product = {};
                            product.posNumber = goodsList[pos].$.N;
                            product.name = goodsList[pos].$.NM;
                            product.qty = goodsList[pos].$.Q;
                            product.price = goodsList[pos].$.PRC;
                            product.code = goodsList[pos].$.C;
                            product.taxMark = goodsList[pos].$.TX;
                            cheque.productsInCheck.push(product);
                        }
                        outData.sales.push(cheque);
                    }
                    if(listItem.isInner){
                    var inner={};

                        if(listItem.C[0].I){
                            inner.isMoneyIn=true;
                            inner.paymentType = listItem.C[0].I[0].$.T;
                            inner.paymentTypeName = listItem.C[0].I[0].$.NM;
                            inner.paymentSum = listItem.C[0].I[0].$.SM;
                        }
                        if(listItem.C[0].O){
                            inner.isMoneyOut=true;
                            inner.paymentType = listItem.C[0].O[0].$.T;
                            inner.paymentTypeName = listItem.C[0].O[0].$.NM;
                            inner.paymentSum = listItem.C[0].O[0].$.SM;

                        }


                        inner.paymentDate = listItem.TS[0];
                        if(listItem.C[0].E[0].$.CS) inner.operatorID=listItem.C[0].E[0].$.CS;

                        inner.checkDataID = listItem.$.DI;
                        inner.ITN = listItem.$.TN;
                        inner.dataVersion = listItem.$.V;
                        inner.cashBoxFabricNum = listItem.$.ZN;
                        inner.dataFormDate = listItem.TS[0];
                    }

                }
                callback(null, outData);
            }
        }catch (e){
            log.warn("Не удалось обработать данные полученные от кассового сервера! причина:",e);
            callback(e, outData);
        }
    });
};

function fillCheques(chequesData, ind, finishedcallback) {
    var chequeData = chequesData[ind];
    if (!chequeData) {
        finishedcallback();
        return;
    }

    database.fillChequeTitle(chequeData, function (err, res) {       //insert into t_Sale if not exists, in chequeData.saleChID write t_Sale.CHID
        if (err) {
            log.error("APP database.fillChequeTitle: Sale NOT created! Reason:"+ err);
            finishedcallback("Sale NOT created! Reason:"+ err);
            return;
        }
        chequeData.saleChID = res.ChID;
        var msg;
        if (res.exist) msg=  "Чек №" + chequeData.checkNumber + " найден в БД";
        else msg= "Заголовок чека №" + chequeData.checkNumber + " добавлен в БД";

        emitAndLogEvent(msg, chequeData.cashBoxFabricNum,  function(){
            var saleChID = chequeData.saleChID;
            var chequeProds = chequeData.productsInCheck;//!!!
            fillChequeProds(saleChID, chequeData, chequeProds, 0, /*finishedCallback*/function (err,saleChID, chequeData) {
                if(err){
                    finishedcallback("Position not added to cheque! Reason:"+err);
                    return;
                }
                fillChequePays(saleChID, chequeData, function (err, res) {              // console.log("fillChequePays saleChID err=",err);
                    if (err){
                        log.error("Не удалось внести оплату по чеку в БД Reason: "+err);
                        finishedcallback("Не удалось внести оплату по чеку в БД Reason: "+err);
                        return;
                    }

                    fillCheques(chequesData, ind + 1,finishedcallback);
                });
            });
        });

    });
};
function fillChequeProds(saleChID, chequeData, chequeProdsData, ind, finishedCallback) {

    var chequeProdData = chequeProdsData[ind];
    if (!chequeProdData) {     //finished!!!
        finishedCallback(null, saleChID, chequeData);
        return;
    }
    database.fillChequeProds(saleChID, chequeData, chequeProdData, function (err, res) {
        var msg;
        if (err) {
            log.error("APP database.fillChequeProds: Position in cheque NOT created! Reason:"+ err);
            msg = "Не удалось записать позицию №" + chequeProdData.posNumber + " в чек №" + chequeData.checkNumber+"\nReason:"+ err;
            emitAndLogEvent(msg, chequeData.cashBoxFabricNum, function () {
                finishedCallback(msg);
            });
            return;
        }
        if (res.notFoundProd) msg=res.notFoundProd;
        if (res.exist) msg=" * Найдена позиция №" + chequeProdData.posNumber +  " в чеке №" + chequeData.checkNumber;
        else msg=" * Добавлена позиция №" + chequeProdData.posNumber + " " + chequeProdData.name + " в чек №" + chequeData.checkNumber;
        emitAndLogEvent(msg,chequeData.cashBoxFabricNum, function(){
                fillChequeProds(saleChID, chequeData, chequeProdsData, ind + 1, finishedCallback);
        });
    });
};
function fillChequePays(saleChID, cheque, callback) {
    database.fillToSalePays(saleChID, cheque, function (err, res) {
        var msg;
        if (err) {
            callback(err);
            return;
        }
        if (res.exist) msg='Оплата по чеку №' + cheque.checkNumber + " обновлена";
        else msg='Оплата по чеку №' + cheque.checkNumber + " добавлена базу";
        emitAndLogEvent(msg, cheque.cashBoxFabricNum,function(){
            callback(null, "ok");
        } );
    });
};

app.get("/sysadmin/import_sales/get_sales", function (clientReq, clientRes) {
    log.info('URL: /sysadmin/import_sales/get_sales  ', 'sCashBoxesList =', getCashBoxesList(clientReq), 'bdate =', clientReq.query.bdate,
        'edate =', clientReq.query.edate);
    var sCashBoxesList = getCashBoxesList(clientReq);
    var bdate = clientReq.query.bdate;
    var edate = clientReq.query.edate;

    emitAndLogEvent('Подготовка данных для запроса на кассовый сервер',null, function(){
        database.getXMLForUniCashServerRequest(bdate, edate, sCashBoxesList, function (error, xml) {
            if (error){
                emitAndLogEvent('Не удалось сформировать запрос. Reason: '+error, null, function() {
                    clientRes.send({error: error});
                });
                return;
            }
           // var xml='<?xml version="1.0" encoding="windows-1251" ?> '; //test
            emitAndLogEvent('Отправка запроса кассовому серверу',null, function(){
                getDataFromUniCashServer(xml, function (error, response, body) {          // console.log("getDataFromUniCashServer error=",error ); console.log(" response=",response );console.log(" body=",body );
                    if(error){
                        log.error(error);
                        var errMsg;
                        try{
                            errMsg= JSON.parse(error)
                        }catch(e){
                            errMsg=error;
                        }
                        emitAndLogEvent("Ошибка подключения к кассовому серверу!\n"+errMsg,null,function(){
                            clientRes.send({error:error});
                        });
                        return;
                    }
                    if(!response){
                        log.error("Кассовый сервер не отвечает!");
                        emitAndLogEvent("Кассовый сервер не отвечает!",null, function(){
                            clientRes.send({error: "Кассовый сервер не отвечает!"});
                        });
                        return;
                    }
                    if(!body){
                        log.error("Кассовый сервер не прислал данные!");
                        emitAndLogEvent("Кассовый сервер не прислал данные!",null,function(){
                            clientRes.send({error: "Кассовый сервер не прислал данные!"});
                        });
                        return;
                    }
                    emitAndLogEvent('Получен ответ от кассового сервера', null, function(){
                       // body='<?xml version="1.0" encoding="windows-1251" ?>'; //test
                      //  body="kjhbkljh"; //test

                        getChequesData(body, function (err, result) {
                            if (err) {
                                emitAndLogEvent('Не удалось обработать данные кассового сервера!\n'+err,null, function(){
                                    clientRes.send({error: 'Не удалось обработать данные кассового сервера!\n'+err});
                                });
                                return;
                            }
                            emitAndLogEvent('Данные кассового сервера обработаны успешно', null, function(){
                                var chequesData = result.sales;
                                fillCheques(chequesData, 0, /*finishedcallback*/function(err){
                                    if(err){
                                        emitAndLogEvent(err, null, function() {
                                            clientRes.send({error:err});
                                        });
                                        return;
                                    }
                                    emitAndLogEvent( 'Все данные успешно обработаны и загружены в БД', chequesData.cashBoxFabricNum, function(){
                                        clientRes.send({"done": "ok"});
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

function getCashBoxesList(req) {
    var sCashBoxesList = "";
    for (var itemName in req.query) {
        if (itemName.indexOf("cashbox_") >= 0) {
            sCashBoxesList = sCashBoxesList + "," + req.query[itemName] + ",";
        }
    }
    return sCashBoxesList;
}
server.listen(port, function (err) {
    console.log("server runs on port " + port);
    log.info("server runs on port " + port, new Date().getTime() - startTime);
});
log.info("end app", new Date().getTime() - startTime);


