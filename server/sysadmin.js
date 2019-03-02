var fs = require('fs'), path = require('path');
var server= require('./server'), log= server.log, startupParams= server.startupParams,
    database= require('./database'), procUniCashserver= require('./procUniCashserver'),
    storeChashOpers= require('./storeChashOpers');
var socketio = require('socket.io');

module.exports= function(app,httpServer){
    var io = socketio(httpServer);
    app.get("/sysadmin", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin.html');
    });

    app.get("/sysadmin/sysState", function (req, res) {
        var outData = {};
        outData.mode = startupParams.mode;
        if(server.getSysConfigErr()){
            outData.error = server.getSysConfigErr();
            res.send(outData);
            return;
        }
        outData.configuration = server.getSysConfig();
        if(database.getDBConnectErr())
            outData.dbConnectionError = database.getDBConnectErr();
        else
            outData.dbConnection = 'Connected';
        res.send(outData);
    });

    app.get("/sysadmin/sysConfig", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin/sysConfig.html');
    });
    app.get("/sysadmin/sysConfig/getSysConfig", function (req, res) {
        if (server.getSysConfigErr()) {
            res.send({error:server.getSysConfigErr()});
            return;
        }
        res.send(server.getSysConfig());
    });
    app.get("/sysadmin/sysConfig/loadSysConfig", function (req, res) {
        server.loadSysConfig();
        if (server.getSysConfigErr()) {
            res.send({error: server.getSysConfigErr()});
            return;
        }
        res.send(server.getSysConfig());
    });
    app.post("/sysadmin/sysConfig/storeSysConfigAndReconnectToDB", function (req, res) {
        var newSysConfig = req.body;
        server.setAndStoreSysConfig(newSysConfig,
            function(err){
                var outData = {};
                if(err) outData.error = err;
                database.dbConnect(function(err){
                    if(err) outData.errorDBConnectMsg= err;
                    res.send(outData);
                });
            }
        );
    });

    app.get("/sysadmin/importSales", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin/importSales.html');
    });
    app.get("/sysadmin/getCashboxes", function (req, res) {
        database.getAllCashBoxes(function (err, result) {
            var outData = {};
            if(err) outData.error = err;
            outData.items = result;
            res.send(outData);
        });
    });

    function emitAndLogEvent(notes,msg, cashBoxFacID, callback){
        database.logToDB(notes,msg, cashBoxFacID, function(err,res){
            if(err){
                log.error("emitAndLogEvent error:", err);
                io.emit('new_event', "Не удалось записать log в БД. Причина: "+ err);
            }
            io.emit('new_event', notes);
            if(callback) callback(err, res);
        });
    }

    function fillCheques(chequesData, ind, finishedcallback) {
        var chequeData = chequesData[ind];
        if(!chequeData){
            finishedcallback();
            return;
        }

        if(chequeData.canceled){
            emitAndLogEvent("Аннулированный чек от "+chequeData.dataFormDate+" не добавлен в БД",chequeData.xmlHeading, chequeData.cashBoxFabricNum,  function() {
                fillCheques(chequesData, ind + 1, finishedcallback);
            });
            return;
        }

        database.fillChequeTitle(chequeData, function (err, res) {
            if(err){
                log.error("APP database.fillChequeTitle: Sale NOT created! Reason:"+ err);
                finishedcallback("Sale NOT created! Reason:"+ err);
                return;
            }
            chequeData.saleChID = res.ChID;
            var msg;
            if(res.exist) msg= "Чек №"+chequeData.checkNumber+" найден в БД";
            else msg= "Заголовок чека №"+chequeData.checkNumber+" добавлен в БД";
            emitAndLogEvent(msg,chequeData.xmlHeading, chequeData.cashBoxFabricNum,  function(){
                var saleChID = chequeData.saleChID;
                var chequeProds = chequeData.productsInCheck;//!!!
                fillChequeProds(saleChID, chequeData, chequeProds, 0, /*finishedCallback*/function (err,saleChID, chequeData) {
                    if(err){
                        finishedcallback("Position not added to cheque! Reason:"+err);
                        return;
                    }
                    fillChequePays(saleChID, chequeData, function (err, res) {
                        if(err){
                            log.error("Не удалось внести оплату по чеку в БД Reason: "+err);
                            finishedcallback("Не удалось внести оплату по чеку в БД Reason: "+err);
                            return;
                        }
                        database.updateSaleStatus(saleChID, function (err, res) {
                            if(err){
                                log.error("Не удалось обновить статус документа продажи! Reason: "+err);
                                finishedcallback("Не удалось обновить статус документа продажи! Reason: "+err);
                                return;
                            }
                            var msg='Статус чека №' + chequeData.checkNumber + " обновлен";
                            emitAndLogEvent(msg,"", chequeData.cashBoxFabricNum,function(){
                                fillCheques(chequesData, ind + 1,finishedcallback);
                            });
                        });
                    });
                });
            });
        });
    }
    function fillChequeProds(saleChID, chequeData, chequeProdsData, ind, finishedCallback){
        var chequeProdData = chequeProdsData[ind];
        if(!chequeProdData){     //finished!!!
            finishedCallback(null, saleChID, chequeData);
            return;
        }
        database.fillChequeProds(saleChID, chequeData, chequeProdData, function(err,res){
            var msg;
            if(err){
                log.error("APP database.fillChequeProds: Position in cheque NOT created! Reason:"+ err);
                msg = "Не удалось записать позицию №" + chequeProdData.posNumber + " в чек №" + chequeData.checkNumber+"\nReason:"+ err;
                emitAndLogEvent(msg,chequeProdData.xmlProduct, chequeData.cashBoxFabricNum, function () {
                    finishedCallback(msg);
                });
                return;
            }
            if(res.exist && res.exist=="SaleD") msg=" * Найдена позиция №" + chequeProdData.posNumber +  " в чеке №" + chequeData.checkNumber;
            if(res.exist && res.exist=="SaleC") msg=" * Найдена аннулированная позиция "+chequeProdData.name;
            if(res.addedSaleC)msg="* Аннулировання позиция "+chequeProdData.name+" добавлена в БД";
            if(res.addedSaleD)  msg=" * Добавлена позиция №" + chequeProdData.posNumber + " " + chequeProdData.name + " в чек №" + chequeData.checkNumber;
            emitAndLogEvent(msg,chequeProdData.xmlProduct,chequeData.cashBoxFabricNum, function(){
                fillChequeProds(saleChID, chequeData, chequeProdsData, ind + 1, finishedCallback);
            });
        });
    }
    function fillChequePays(saleChID, cheque, callback){
        database.fillToSalePays(saleChID, cheque, function(err,res){
            var msg;
            if(err){
                callback(err);
                return;
            }
            if(res.exist) msg='Оплата по чеку №' + cheque.checkNumber + " обновлена";
            else msg='Оплата по чеку №' + cheque.checkNumber + " добавлена базу";
            emitAndLogEvent(msg,cheque.xmlPayment, cheque.cashBoxFabricNum,function(){
                callback(null, "ok");
            });
        });
    }

    /**
     * uniXML
     * emitAndLogEvent = function(notes,msg, cashBoxFacID, callback)
     * callback = function(error,result)
     */
    var storeUniXMLtoDB= function(uniXML,emitAndLogEvent,callback){
        emitAndLogEvent('Начат процесс обработки полученного XML', null,null, function(){
            procUniCashserver.getCashboxDataFromXML(uniXML, function(err,result){
                var sErr="";
                if(err){
                    sErr='Не удалось обработать XML! Причина: '+err;
                    log.error("storeUniXMLtoDB getCashboxDataFromXML error:",sErr);
                    emitAndLogEvent(sErr,null,null, function(){
                        callback(sErr);
                    });
                    return;
                }
                fs.writeFile("./chequesData.json", JSON.stringify(result), function(err,success){
                    //callback(err,success);
                });
                emitAndLogEvent('Данные кассового сервера обработаны успешно', null,null, function(){
                    var chequesData = result.sales;
                    fillCheques(chequesData, 0, /*finishedcallback*/function(err){
                        if(err){
                            callback(err);
                            return;
                        }
                        var msg = 'Все чеки успешно обработаны';
                        if(chequesData.length<1)msg = "";
                        emitAndLogEvent( msg,null, chequesData.cashBoxFabricNum, function(){
                            var innersDocData = result.inners;
                            insertInnerDoc(innersDocData,0,function(err,res){
                                if(err){
                                    callback(err);
                                    return;
                                }
                                var msg='Все вносы/выносы успешно обработаны';
                                if(innersDocData.length<1) msg = "";
                                emitAndLogEvent(msg,null, chequesData.cashBoxFabricNum,function(){
                                    addToZrep(result.reports, 0,function(err,res){
                                        if(err){
                                            callback(err);
                                            return;
                                        }
                                        var msg='Все Z-Отчеты успешно обработаны';
                                        if(result.reports.length<1) msg = "";
                                        emitAndLogEvent(msg,null, chequesData.cashBoxFabricNum, function(){
                                            emitAndLogEvent('Все полученные данные успешно обработаны', null,chequesData.cashBoxFabricNum, function(){
                                                callback(null,{done:"ok"});
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
    };

    app.get("/sysadmin/importSales/getSalesXMLFromUniCashserverAndStoreToDB", function(clientReq,clientRes){
        var bdate = clientReq.query.bdate, edate = clientReq.query.edate;
        emitAndLogEvent('Поиск кассовых аппаратов',null,null, function(){
            var sCRIDsList= getCRIDList(clientReq.query);                                                   log.info("getSalesXMLFromUniCashserverAndStoreToDB sCRIDsList",sCRIDsList);
            emitAndLogEvent('Подготовка данных для запроса на кассовый сервер',null,null, function(){
                database.getCRListXMLForUniCashServerRequest(bdate, edate, sCRIDsList, function (error, xml) {
                    if(error){
                        emitAndLogEvent('Не удалось сформировать запрос. Reason: '+error, null,null, function() {
                            clientRes.send({error: error});
                        });
                        return;
                    }
                    // var xml='<?xml version="1.0" encoding="windows-1251" ?> '; //test
                    emitAndLogEvent('Отправка запроса кассовому серверу',null,null, function(){
                        procUniCashserver.getDataFromUniCashServer(server.getSysConfig(),xml, function(error,uniXML){
                            if(error){
                                emitAndLogEvent(error,null,null,function(){
                                    log.error("getDataFromUniCashServer error:",error);
                                    clientRes.send({error:error});
                                });
                                return
                            }
                            fs.writeFile("./uniXML.xml",uniXML,function(err,success){
                                if(err)log.error("Store uniXML error:",err.message);
                            });
                            emitAndLogEvent('Получен ответ от кассового сервера', null,null, function(){
                                storeUniXMLtoDB(uniXML,emitAndLogEvent,function(error,storeResult){
                                    if(!storeResult) storeResult={};
                                    if(error) storeResult.error=error;
                                    clientRes.send(storeResult);
                                })
                            })

                        });
                    });
                });
            });
        });
    });
    app.get("/sysadmin/importSales/loadXML", function(req,res){
        fs.readFile('./uniXML.xml','utf8',function(err,uniXML){
            if(err){
                res.send({error:"Не удалось прочитать файл XML! Причина: "+err.message});
                return;
            }
            res.send({uniXML:uniXML});
        });
    });
    app.post("/sysadmin/importSales/importXMLToDB", function(req,res){
        var uniXML=req.body.uniXML;
        emitAndLogEvent('Получен файл XML...', null,null, function(){
            storeUniXMLtoDB(uniXML,emitAndLogEvent,function(error,storeResult){
                if(!storeResult) storeResult={};
                if(error) storeResult.error=error;
                res.send(storeResult);
            })
        });
    });

    function addToZrep(reports, ind, callback) {
        if(!reports[ind]){
            callback(null, "done");
            return;
        }
        var report = reports[ind];
        database.addToZrep(report, function (err, res) {
            if(err){
                emitAndLogEvent('Произошла ошибка при  записи Z-Отчета  в БД.\n Причина: ' + err, report.xmlZReport,report.cashBoxFabricNum, function () {
                    log.error('Произошла ошибка при  записи Z-Отчета в БД.Причина: ' + err);
                    callback(err);
                });
                return;
            }
            if(res.exists){
                emitAndLogEvent('Найден Z-Отчет №' + report.reportNum + ' от ' + report.dataFormDate,report.xmlZReport,report.cashBoxFabricNum, function () {
                    log.info('Найден Z-Отчет №' + report.reportNum + ' от ' + report.dataFormDate);
                    addToZrep(reports, ind + 1, callback);
                });
                return;
            }
            emitAndLogEvent('Добавлен Z-Отчет №' + report.reportNum + ' от ' + report.dataFormDate,report.xmlZReport,report.cashBoxFabricNum, function () {
                log.info('Добавлен Z-Отчет №' + report.reportNum + ' от ' + report.dataFormDate);
                addToZrep(reports, ind + 1, callback);
            });
        });
    }

    function insertInnerDoc(InnerDocList, ind, callback) {
        if(!InnerDocList[ind]){
            callback(null, "done");
            return;
        }
        var doc = InnerDocList[ind];
        if(doc.isMoneyIn){
            database.addToMonIntRec(doc, function (err,result) {
                if(err){
                    emitAndLogEvent('Произошла ошибка при  записи служебного внесения в БД.\n Причина: ' + err, doc.xmlInner,doc.cashBoxFabricNum, function () {
                        log.error('Произошла ошибка при  записи служебного внесения в БД.Причина: ' + err);
                        callback(err);
                    });
                    return;
                }
                if(result.exists){
                    emitAndLogEvent('Найдено служенбное внесение на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate,doc.xmlInner, doc.cashBoxFabricNum, function () {
                        log.info('Найдено служенбное внесение на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate);
                        insertInnerDoc(InnerDocList, ind + 1, callback);
                    });
                    return;
                }
                emitAndLogEvent('Служенбное внесение на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate + ' записано в БД ',doc.xmlInner, doc.cashBoxFabricNum, function () {
                    log.info('Служенбное внесение на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate + ' записано в БД');
                    insertInnerDoc(InnerDocList, ind + 1, callback);
                });
            });
        } else if(doc.isMoneyOut){
            database.addToMonIntExp(doc, function (err,result) {
                if(err){
                    emitAndLogEvent('Произошла ошибка при  записи служебной выдачи  в БД.\n Причина: ' + err, doc.xmlInner,doc.cashBoxFabricNum, function () {
                        log.error('Произошла ошибка при  записи служебной выдачи в БД.Причина: ' + err);
                        callback(err);
                    });
                    return;
                }
                if(result.exists){
                    emitAndLogEvent('Найдена служебная выдача на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate, doc.xmlInner,doc.cashBoxFabricNum, function () {
                        log.info('Найдена служебная выдача  на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate);
                        insertInnerDoc(InnerDocList, ind + 1, callback);
                    });
                    return;
                }
                emitAndLogEvent('Служеная выдача на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate + ' записана в БД ',doc.xmlInner, doc.cashBoxFabricNum, function () {
                    log.info('Служеная выдача  на сумму ' + doc.paymentSum / 100 + ' от ' + doc.docDate + ' записана в БД');
                    insertInnerDoc(InnerDocList, ind + 1, callback);
                });
            })
        }
    }

    function getCashBoxesList(req) {
        var sCashBoxesList = "";
        for(var itemName in req.query){
            if(itemName.indexOf("cashbox_") >= 0) sCashBoxesList = sCashBoxesList + "," + req.query[itemName] + ",";
        }
        return sCashBoxesList;
    }

    app.get("/sysadmin/cashRegLogs", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin/cashRegLogs.html');
    });
    app.get("/sysadmin/cashRegLogs/getLogsByCRID/*", function (req, res) {
        log.info("/sysadmin/cashRegLogs/getLogsByCRID/* params=",req.params," ", JSON.stringify(req.query));
        var outData={};
        outData.columns= [
            { data:"LogID", name:"LogID", width:60, type:"numeric" },
            { data:"CashBoxID", name:"CashBoxID", width:85, type:"numeric", align:"center" },
            { data:"DocDate", name:"DocDate", width:75, type:"text"},// dateFormat:"DD.MM.YYYY"
            { data:"DocTime", name:"DocTime", width:115, type:"text"},// dateFormat:"DD.MM.YYYY HH:mm:ss"
            //{ data:"CashRegAction", name:"CashRegAction", width:100, type:"text"},
            //{ data:"Status", name:"Status", width:50, type:"text"},
            { data:"Msg", name:"Msg", width:480, type:"text"},
            { data:"Notes", name:"Notes", width:285, type:"text"}
        ];
        var bdate = req.query.BDATE, edate = req.query.EDATE;
        var crId=req.params[0].replace("CashRegLogs","");
        if(!bdate&&!edate){
            res.send(outData);
            return;
        }
        database.getLogs(bdate,edate+" 23:59:59",crId, function(error,recordset){
            if(error){
                outData.error=error;
                res.send(outData);
                return;
            }
            outData.items=recordset;
            res.send(outData);
        });
    });

    app.get("/sysadmin/exportProds", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin/exportProds.html');
    });
    app.get("/sysadmin/exportProds/createXMLandSendToUniCashserver", function(req,res){                     log.info("createXMLandSendToUniCashserver  params=", req.query);
        var sCRIDsList= getCRIDList(req.query);                                                             log.info("createXMLandSendToUniCashserver getCRIDList",sCRIDsList);
        if(sCRIDsList.trim().length==""){
            res.send({error:"Не указаны кассы для формирования XML!"});
            return;
        }
        database.getProdsPricesXML(sCRIDsList,
            function(error, dataItems){
                if(error){
                    res.send({error:"Не удалось получить данные из базы данных для XML! Причина: "+error.message});
                    return;
                }
                procUniCashserver.postProductsToUniCashServer(server.getSysConfig(), dataItems, function(err,result){
                    var outData=result||{};
                    if(err){
                        log.error("postProductsToUniCashServer error: "+err);
                        outData.error=err;
                    }
                    res.send(outData);
                });
            });
    });

    function getCRIDList(selectedCRs){
        var sCRIDsList="";
        for(var itemName in selectedCRs)
            if(itemName.indexOf("cashbox_")>=0) sCRIDsList=sCRIDsList+selectedCRs[itemName]+",";
        sCRIDsList=sCRIDsList.substring(0,sCRIDsList.length-1);
        return sCRIDsList;
    }

    app.get("/sysadmin/sales", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin/sales.html');
    });
    app.get("/sysadmin/Sales/getSalesByCRID/*", function (req, res) {
        log.info("/sysadmin/Sales/getSalesByCRID/* params=",req.params," ", JSON.stringify(req.query));
        var initialCRID= req.params[0].replace("Sales","");
        var outData={columns:[]};
        if(initialCRID==-1)
            outData.columns.push({ data:"CashBoxID", name:"CashBoxID", width:85, type:"numeric", align:"center"});
        outData.columns.push(
            { data:"DocDate", name:"DocDate", width:85, type:"text", align:"center"},//,"dateFormat":"DD.MM.YYYY HH:mm:ss"
            { data:"DocTime", name:"DocTime", width:120, type:"text", align:"center"},//,"dateFormat":"DD.MM.YYYY HH:mm:ss"
            { data:"ChequeNumber", name:"ChequeNum", width:80, type:"numeric", align:"center"},
            { data:"PosNumber", name:"PosNumber", width:80, type:"numeric"},
            { data:"ProdName", name:"ProdName (Article2)", width:250, type:"text"},
            { data:"CstProdCode", name:"CstProdCode (УКТВЭД)", width:120, type:"text", align:"center"},
            { data:"UM", name:"UM", width:50, type:"text", align:"center"},
            { data:"Qty", name:"Qty", width:50, type:"numeric", format:"#,###,###,##0.[#########]", language:"ru-RU", align:"center"},
            { data:"ProdPrice_wt", name:"ProdPrice_wt", width:80, type:"numeric", format:"#,###,###,##0.00[#######]", language:"ru-RU"},
            { data:"Sum_wt", name:"Sum_wt", width:80, type:"numeric", format:"#,###,###,##0.00[#######]", language:"ru-RU"}
        );
        var bdate = req.query.BDATE, edate = req.query.EDATE;
        if(!bdate&&!edate){
            res.send(outData);
            return;
        }
        var CRID;
        // var initialCRID= req.params[0].replace("Sales","");
        if(initialCRID==-1){
            database.getAllCashBoxes(function(err,result){
                if(err){
                    outData.error = err.message;
                    return;
                }
                CRID='';
                for(var i in result) CRID = CRID + result[i].CRID + ",";
                CRID=CRID.substring(0,CRID.length-1)/*+")"*/;
                database.getSales(bdate,edate+" 23:59:59",CRID, function(error,recordset){
                    if(error){
                        outData.error=error;
                        res.send(outData);
                        return;
                    }
                    outData.items=recordset;
                    res.send(outData);
                });
            });
        }else{
            CRID = initialCRID;
            database.getSales(bdate,edate+" 23:59:59",CRID, function(error,recordset){
                if(error){
                    outData.error=error;
                    res.send(outData);
                    return;
                }
                outData.items=recordset;
                res.send(outData);
            });
        }
    });
    app.get("/sysadmin/prodsPrices", function (req, res) {
        res.sendFile(appPagesPath+'sysadmin/prodsPrices.html');
    });
    app.get("/sysadmin/ProdsPrices/getProdsPricesByCRID/*", function (req, res) {
        log.info("/sysadmin/ProdsPrices/getProdsPricesByCRID/*  params=",req.params," ", JSON.stringify(req.query));
        var initialCRID= req.params[0].replace("GetPrices",""), outData={};
        outData.columns=[];
        if(initialCRID==-1)
            outData.columns.push({ data:"CashBoxID", name:"CashBoxID", width:85, type:"numeric", align:"center"});
        outData.columns.push(
            { data:"ProdName", name:"ProdName (Article2)", width:250, type:"text"},
            { data:"Dep", name:"Dep", width:50, type:"numeric", align:"center"},
            { data:"Code", name:"Code", width:60, type:"numeric", align:"center"},
            { data:"CstProdCode", name:"CstProdCode (УКТВЭД)", width:100, type:"text", align:"center"},
            //{ data:"Qty", name:"Qty", width:80, type:"numeric", align:"center"},
            { data:"UM", name:"UM", width:50, type:"text", align:"center"},
            { data:"ProdPrice", name:"ProdPrice", width:60, type:"numeric", format:"#,###,###,##0.00[#######]", language:"ru-RU"},
            { data:"PriceName", name:"PriceName", width:200, type:"text"},
            { data:"Notes", name:"Notes", width:250, type:"text"});
        var CRID;
        if(initialCRID==-1){
            database.getAllCashBoxes(function(err,result){
                if(err){
                    outData.error = err.message;
                    return;
                }
                CRID='';
                for(var i in result) CRID = CRID+result[i].CRID+",";
                CRID=CRID.substring(0,CRID.length-1);
                database.getProdsPricesByCRID(CRID, function(error,recordset){
                    if(error){
                        outData.error=error;
                        res.send(outData);
                        return;
                    }
                    outData.items = recordset;
                    res.send(outData);
                });
            });
        }else{
            CRID = initialCRID;
            database.getProdsPricesByCRID(CRID, function(error,recordset){
                if(error){
                    outData.error = error;
                    res.send(outData);
                    return;
                }
                outData.items = recordset;
                res.send(outData);
            });
        }
    });
};

