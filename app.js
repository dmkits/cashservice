
console.log('Starting ...');
var startTime=new Date().getTime();

//function startupMode(){                                                   log.info('startupMode()...',new Date().getTime()-startTime);//test
//    var app_params = process.argv.slice(2);
//    if(app_params.length===0) return 'production';
//    return app_params[0];
//}
//
//module.exports.startupMode = startupMode;
function startupParams(){
    var app_params = {};
    if(process.argv.length==0) {
        app_params.mode='production';
        app_params.port=8080;
        return app_params;
    }
    for(var i=2;i<process.argv.length;i++){
        if(process.argv[i].indexOf('-p:')==0){
            var port=process.argv[i].replace("-p:","");
            if(port>0 && port<65536){
                app_params.port=port;
            }
        }else if(process.argv[i].charAt(0).toUpperCase()>'A'&&process.argv[i].charAt(0).toUpperCase()<'Z'){
            app_params.mode = process.argv[i];
        }else if(process.argv[i].indexOf('-log:')==0) {
            var logParam = process.argv[i].replace("-log:", "");
            console.log("logParam", logParam);
            if (logParam.toLowerCase() == "console") {
                app_params.logToConsole = true;
            }
        }
    }
    if(!app_params.port)app_params.port=8080;
    if(!app_params.mode)app_params.mode = 'production';
    return app_params;
}

var app_params=startupParams();

var log=require('winston');

if(!app_params.logToConsole){
    log.add(log.transports.File, { filename: 'somefile.log', level:'debug',timestamp:true });
    log.remove(log.transports.Console);
}


module.exports.startupMode = app_params.mode;

var fs = require('fs');                                                log.info('fs...',new Date().getTime()-startTime);//test
var express = require('express');                                      log.info('express...',new Date().getTime()-startTime);//test

//var app = require('express').createServer();
var port=app_params.port;
var path=require ('path');                                              log.info('path...',new Date().getTime()-startTime);//test
var bodyParser = require('body-parser');                                log.info('body-parser...',new Date().getTime()-startTime);//test
var cookieParser = require('cookie-parser');                            log.info('cookie-parser...',new Date().getTime()-startTime);//test
var request = require('request');                                       log.info('request...',new Date().getTime()-startTime);//test
var Buffer = require('buffer').Buffer;                                  log.info('buffer...',new Date().getTime()-startTime);//test
var iconv_lite = require('iconv-lite');                                 log.info('iconv-lite...',new Date().getTime()-startTime);//test
var parseString = require('xml2js').parseString;                        log.info('xml2js...',new Date().getTime()-startTime);//test


var app = express();
var server = require('http').Server(app);                               log.info('http...',new Date().getTime()-startTime);//test
var io = require('socket.io')(server);                                  log.info('socket.io...',new Date().getTime()-startTime);//test

//var Excel = require('exceljs');
//var options = {
//    filename: './products_name.xlsx',
//    useStyles: true,
//    useSharedStrings: true
//};
//var workbook = new Excel.stream.xlsx.WorkbookWriter(options);
//var sheet = workbook.addWorksheet('My Sheet', {properties:{tabColor:{argb:'FFC0000'}}});
//sheet.columns = [
//    { header: 'product', key: 'product', width: 150 },
//];


app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use('/',express.static('public'));
var database = require('./dataBase');                                                log.info('./dataBase...',new Date().getTime()-startTime);//test
var ConfigurationError, DBConnectError;


tryLoadConfiguration();
function tryLoadConfiguration(){                                                    log.info('tryLoadConfiguration...',new Date().getTime()-startTime);//test
    try {
        database.loadConfig();
        ConfigurationError=null;
    } catch (e) {
        ConfigurationError= "Failed to load configuration! Reason:"+e;
    }
}
 if (!ConfigurationError) tryDBConnect();
function tryDBConnect(postaction) {                                                   log.info('tryDBConnect...',new Date().getTime()-startTime);//test
    database.databaseConnection(function (err) {
        DBConnectError = null;
        if (err) {
            DBConnectError = "Failed to connect to database! Reason:" + err;
        }
        if (postaction)postaction(err);                                                log.info('tryDBConnect DBConnectError=',DBConnectError);//test
    });
}


app.get("/sysadmin", function(req, res){
    res.sendFile(path.join(__dirname, '/views', 'sysadmin.html'));
});
app.get("/sysadmin/app_state", function(req, res){
    var outData= {};
    outData.mode= app_params.mode;
    if (ConfigurationError) {
        outData.error= ConfigurationError;
        res.send(outData);
        return;
    }
    outData.configuration= database.getDBConfig();
    if (DBConnectError)
        outData.dbConnection= DBConnectError;
    else
        outData.dbConnection='Connected';
    res.send(outData);
});
app.get("/sysadmin/startup_parameters", function (req, res) {
    res.sendFile(path.join(__dirname, '/views/sysadmin', 'startup_parameters.html'));
});
app.get("/sysadmin/startup_parameters/get_app_config", function (req, res) {
    if (ConfigurationError) {
        res.send({error:ConfigurationError});
        return;
    }
    res.send(database.getDBConfig());
});
app.get("/sysadmin/startup_parameters/load_app_config", function (req, res) {
    tryLoadConfiguration();
    if (ConfigurationError) {
        res.send({error:ConfigurationError});
        return;
    }
    res.send(database.getDBConfig());
});
app.post("/sysadmin/startup_parameters/store_app_config_and_reconnect", function (req, res) {
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
    res.sendFile(path.join(__dirname, '/views/sysadmin', 'import_sales.html'));
});
app.get("/sysadmin/import_sales/get_all_cashboxes", function (req, res) {
 database.getAllCashBoxes(function (err,result) {
           var outData = {};
            if (err) outData.error = err.message;
            outData.items = result;
            outData.success = "ok";
            res.send(outData);
        });
});
app.get("/sysadmin/import_sales/get_sales", function (req, res) {
    var sCashBoxesList = getCashBoxesList(req);
    var bdate = req.query.bdate;
    var edate = req.query.edate;

        database.createXMLSalesRequest(bdate, edate, sCashBoxesList,
            function (error) {
                res.send({error: ""});
            }, function (recordset) {
                var xmlText="";
                for(var i in recordset) {
                    var xmlLine=recordset[i].XMLText;
                    xmlText=xmlText+xmlLine;
                }

                var textLengthStr=xmlText.length+"";
                io.emit('ask_for_data');
                var cashserver_url=database.getDBConfig()['cashserver.url'];
                var cashserver_port=database.getDBConfig()['cashserver.port'];
                request.post({
                    headers: {'Content-Type' : 'text/xml;charset=windows-1251','Content-Length' : textLengthStr},
                    //uri:'http://5.53.113.251:12702/lsoft',
                    uri:'http://'+cashserver_url+':'+cashserver_port+'/lsoft',
                    body: xmlText,
                    encoding: 'binary'
                }, function(error, response, body){         //console.log("body=", body);
                    io.emit('xml_received');

                    var buf = new Buffer(body, 'binary');
                    var  str = iconv_lite.decode(buf, 'win1251');
                    body = iconv_lite.encode (str, 'utf8');

                    io.emit('xml_to_json');

                    parseString(body, function (err, result) {
                        var outData = {};
                        if(err) {       console.log(err);
                            return;
                        }
                        if(!result.gw_srv_rsp.select){
                            outData.error=result.gw_srv_rsp;
                               io.emit('response_error', outData);
                            res.send(outData);
                            return;
                        }
                        var cashBoxList = result.gw_srv_rsp.select[0].FISC[0].EJ;
                        for (var fn in cashBoxList) {

                                var cashBox=cashBoxList[fn];
                                var cashBoxID=cashBox.$.ID;
                                io.emit('cash_box_id', cashBoxID);
                                var docList = cashBoxList[fn].DAT;                  //list of DAT

                            var fillDB = function(docList, i){                                        log.debug("fillDB ",i);
                                   if(!docList || i>= docList.length) return;
                              //  for (var i in docList) {
                                    var listItem = docList[i];
                                    if(listItem.Z){
                                        listItem.isZReport=true;
                                        fillDB(docList, i+1);
                                    } //check.Z - Z-отчет
                                    else if(listItem.C[0].$.T=='0')listItem.isSale=true;
                                    else if(listItem.C[0].$.T=='1'){
                                        listItem.isReturn=true;
                                        fillDB(docList, i+1);
                                    }
                                    else if(listItem.C[0].$.T=='2'){
                                        listItem.isInner=true;
                                        fillDB(docList, i+1);
                                    }

                                    if(listItem.isSale) {                                  log.debug("listItem.isSale");
                                        var check={};
                                        check.checkDataID = listItem.$.DI;                   //DAT ID
                                        check.ITN= listItem.$.TN;                            //ИНН
                                        check.dataVersion= listItem.$.V;                     // Версия формата пакета данных
                                        check.cashBoxFabricNum = listItem.$.ZN;
                                        check.dataFormDate = listItem.TS[0];

                                        var goodsList = listItem.C[0].P;
                                        check.productsInCheck = [];

                                        check.checkNumber = "1111" + listItem.C[0].E[0].$.NO;
                                        check.totalCheckSum = listItem.C[0].E[0].$.SM;
                                        check.operatorID = listItem.C[0].E[0].$.CS;

                                        check.fixalNumPPO = listItem.C[0].E[0].$.FN;
                                        check.checkDate = listItem.C[0].E[0].$.TS;

                                        if (listItem.C[0].E[0].TX) {                                       //если налогов несколько может не использоваться
                                            var taxInfo = listItem.C[0].E[0].TX[0].$;
                                            if (taxInfo.DTNM) check.AddTaxName = taxInfo.DTNM;
                                            if (taxInfo.DTPR) check.AddTaxRate = taxInfo.DTPR;
                                            if (taxInfo.DTSM) check.AddTaxSum = taxInfo.DTSM;
                                            if (taxInfo.TX) check.taxMark = taxInfo.TX;
                                            if (taxInfo.TXPR) check.taxRate = taxInfo.TXPR;
                                            if (taxInfo.TXSM) check.taxSum = taxInfo.TXSM;
                                            if (taxInfo.TXTY) check.isTaxIncluded = taxInfo.TXTY;       //"0"-включ в стоимость, "1" - не включ.
                                        }

                                        var payment = listItem.C[0].M[0].$;
                                        check.buyerPaymentSum = payment.SM;
                                        check.paymentName = payment.NM;
                                        check.paymentType = payment.T;                                  //"0" - нал. не "0" - безнал
                                        if (payment.RM) check.change = payment.RM;

                                        for (var pos in goodsList) {
                                            var product = {};
                                            product.posNumber = goodsList[pos].$.N;
                                            product.name = goodsList[pos].$.NM;
                                            product.qty = goodsList[pos].$.Q;
                                            product.price = goodsList[pos].$.PRC;
                                            product.code = goodsList[pos].$.C;
                                            product.taxMark = goodsList[pos].$.TX;      console.log(" product.taxMark=", product.taxMark);
                                            check.productsInCheck.push(product);
                                        }
                                        io.emit('json_ready', check);

                                            database.isSaleExists(check, function (err, res) {

                                                if (err)    {
                                                    io.emit('add_to_db_err', check.checkNumber);
                                                    log.error("APP database.isSaleExists ERROR=", err);
                                                    return;
                                                }
                                                if (!res.empty) {         log.warn("Чек существует в базе " + res.data.checkNumber ,"ChID=",  res.ChID);
                                                    fillDB(docList, i+1);
                                                }
                                                if (res.empty) {
                                                    database.addToSale(res.data, function (err, ChID) { console.log('res.data=',res.data);
                                                        if (err)  {
                                                            io.emit('add_to_db_err', check.checkNumber);
                                                            log.error("APP database.addToSale ERROR=", err);
                                                            return;
                                                        }
                                                        database.addToSaleD(ChID, res.data,function (err, res){
                                                            if(err) log.error("APP database.addToSaleD ERROR=", err);
                                                        });
                                                        fillDB(docList, i+1);
                                                    });
                                                }
                                            });
                                    };
                                };
                            fillDB(docList,0);
                         }
                        //   }
                        //sheet.commit();
                        //workbook.commit();
                        io.emit('data_processed_suc');
                        //  res.send(outData);
                        res.end();
                    });
                });

            });
    });


function getCashBoxesList(req){
    var sCashBoxesList="";
    for(var itemName in req.query){
        if (itemName.indexOf("cashbox_")>=0){
            sCashBoxesList=sCashBoxesList+","+req.query[itemName]+",";
        }
    }
    return sCashBoxesList;
}

//io.on('connection', function (socket) {
//    socket.emit('news', { hello: 'world' });
//    socket.on('my other event', function (data) {
//        console.log(data);
//    });
//});

server.listen(port, function (err) {
    console.log("server runs on port "+ port, "  ",new Date().getTime()-startTime);
});

console.log("end app",new Date().getTime()-startTime);


