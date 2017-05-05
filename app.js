function startupMode(){
    var app_params = process.argv.slice(2);
    if(app_params.length===0) return 'production';
    return app_params[0];
}

module.exports.startupMode = startupMode;

var fs = require('fs');
var express = require('express');

//var app = require('express').createServer();
var port=8080;
var path=require ('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
const uuidV1 = require('uuid/v1');
var request = require('request');
var Buffer = require('buffer').Buffer;
var iconv_lite = require('iconv-lite');
var parseString = require('xml2js').parseString;
var parser = require('xml2json');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var Excel = require('exceljs');
var options = {
    filename: './products_name.xlsx',
    useStyles: true,
    useSharedStrings: true
};
var workbook = new Excel.stream.xlsx.WorkbookWriter(options);
var sheet = workbook.addWorksheet('My Sheet', {properties:{tabColor:{argb:'FFC0000'}}});

sheet.columns = [
    { header: 'product', key: 'product', width: 150 },
];

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use('/',express.static('public'));
var database = require('./dataBase');
var ConfigurationError, DBConnectError;


tryLoadConfiguration();
function tryLoadConfiguration(){
    try {
        database.loadConfig();
        ConfigurationError=null;
    } catch (e) {
        ConfigurationError= "Failed to load configuration! Reason:"+e;
    }
}
 if (!ConfigurationError) tryDBConnect();
function tryDBConnect(postaction) {
    database.databaseConnection(function (err) {
        DBConnectError = null;
        if (err) {
            DBConnectError = "Failed to connect to database! Reason:" + err;
        }
        if (postaction)postaction(err);
    });
}


app.get("/sysadmin", function(req, res){
    res.sendFile(path.join(__dirname, '/views', 'sysadmin.html'));
});
app.get("/sysadmin/app_state", function(req, res){
    var outData= {};
    outData.mode= startupMode();
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

                var textLengthStr=xmlText.length+"";             console.log("xmlText=",xmlText);
                var request = require('request');
                io.emit('ask_for_data');
                var cashserver_url=database.getDBConfig()['cashserver.url'];
                var cashserver_port=database.getDBConfig()['cashserver.port'];
                request.post({
                    headers: {'Content-Type' : 'text/xml;charset=windows-1251','Content-Length' : textLengthStr},
                    //uri:'http://5.53.113.251:12702/lsoft',
                    uri:'http://'+cashserver_url+':'+cashserver_port+'/lsoft',
                    body: xmlText,
                    encoding: 'binary'
                }, function(error, response, body){         console.log("body=", body);
                    io.emit('xml_received');

                    var buf = new Buffer(body, 'binary');
                    var  str = iconv_lite.decode(buf, 'win1251');
                    body = iconv_lite.encode (str, 'utf8');

                    io.emit('xml_to_json');

                    parseString(body, function (err, result) {
                        var outData = {};
                        if(err) {
                            console.log(err);
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
                                var checkList = cashBoxList[fn].DAT;
                                for (var i in checkList) {
                                    var check = checkList[i];
                                    outData.checkDataID = check.$.DI;                   //DAT ID
                                    outData.ITN= check.$.TN;                   //ИНН
                                    outData.dataVersion= check.$.V;           // Версия формата пакета данных
                                    outData.cashBoxFabricNum = check.$.ZN;
                                    outData.dataFormDate = check.TS[0];

                                    if(check.Z)check.isZReport=true;                //check.Z - Z-отчет
                                    else if(check.C[0].$.T=='0')check.isSale=true;
                                    else if(check.C[0].$.T=='1')check.isReturn=true;
                                    else if(check.C[0].$.T=='2')check.isInner=true;

                                    if(check.isSale) {
                                        var goodsList=check.C[0].P;
                                        outData.productsInCheck=[];

                                        outData.checkNumber = check.C[0].E[0].$.NO;
                                        outData.totalCheckSum= check.C[0].E[0].$.SM;
                                        outData.operatorID = check.C[0].E[0].$.CS;

                                        outData.fixalNumPPO = check.C[0].E[0].$.FN;
                                        outData.checkDate = check.C[0].E[0].$.TS;

                                        if(check.C[0].E[0].TX){                                       //если налогов несколько может не использоваться
                                            var taxInfo=check.C[0].E[0].TX[0].$;
                                            if(taxInfo.DTNM) outData.AddTaxName=taxInfo.DTNM;
                                            if(taxInfo.DTPR) outData.AddTaxRate=taxInfo.DTPR;
                                            if(taxInfo.DTSM) outData.AddTaxSum=taxInfo.DTSM;
                                            if(taxInfo.TX) outData.taxMark=taxInfo.TX;
                                            if(taxInfo.TXPR) outData.taxRate=taxInfo.TXPR;
                                            if(taxInfo.TXSM) outData.taxSum=taxInfo.TXSM;
                                            if(taxInfo.TXTY) outData.isTaxIncluded=taxInfo.TXTY;       //"0"-включ в стоимость, "1" - не включ.
                                        }

                                        var payment = check.C[0].M[0].$;
                                        outData.buyerPaymentSum=payment.SM;
                                        outData.paymentName=payment.NM;
                                        outData.paymentType=payment.T;                               //"0" - нал. не "0" - безнал
                                        if(payment.RM) outData.change= payment.RM;

                                        for(var pos in goodsList){
                                            var product={};
                                            product.posNumber=goodsList[pos].$.N;
                                            product.name=goodsList[pos].$.NM;
                                            product.qty=goodsList[pos].$.Q;
                                            product.price=goodsList[pos].$.PRC;
                                            product.code=goodsList[pos].$.C;
                                            product.taxMark=goodsList[pos].$.TX;
                                            outData.productsInCheck.push(product);
                                            sheet.addRow({product: product.name}).commit();
                                        }                                                                    //   console.log("outData=",outData);
                                        io.emit('json_ready', outData);                                         console.log("json_ready outData.checkNumber=",outData.checkNumber);
                                        database.isSaleExists(outData, function(err,res){                    //  console.log("database.isSaleExists res=", res);
                                            var dataToInsert = outData;
                                            if(err)                                           console.log("APP database.isSaleExists ERROR=",err);
                                            if(!res.empty)     console.log("Чек существует в базе "+ outData.checkNumber);
                                            if(res.empty){
                                                database.addToT_Sale(dataToInsert, function(err,result){
                                                    if(err)                                  console.log("APP database.addToT_Sale ERROR=",err);

                                                });
                                            }
                                        });
                                    }
                                }
                            }
                            sheet.commit();
                            workbook.commit();
                            io.emit('data_processed_suc');
                            res.send(outData);
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
    console.log("server runs on port "+ port);
});




