var fs = require('fs'), path = require('path'),
    request = require('request');
var Buffer = require('buffer').Buffer,
    iconv_lite = require('iconv-lite'),
    xml2js = require('xml2js'), parseString = xml2js.parseString, builder = new xml2js.Builder(),
    socketio = require('socket.io');
var server= require('./server'), log= server.log, startupParams= server.startupParams,
    database= require('./database'), procUniCashserver= require('./procUniCashserver');

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
    app.get("/sysadmin/import_sales", function (req, res) {
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

    function emitAndLogEvent(notes,msg, cashBoxFacID, callback) {
        database.logToDB(notes,msg, cashBoxFacID, function (err, res) {
            if (err) {
                log.error("emitAndLogEvent err=", err);
                io.emit('new_event', "Не удалось записать log в БД. Reason:"+ err);
            } else io.emit('new_event', notes);
            if (callback) callback(err, res);
        });
    }

    function getDataFromUniCashServer(xml, callback) {
        var cashserver_url = server.getSysConfig()['cashserverUrl'];
        var cashserver_port = server.getSysConfig()['cashserverPort'];
        var xmlText = "";
        for (var i in xml) {
            var xmlLine = xml[i].XMLText;
            xmlText = xmlText + xmlLine;
        }
        var textLengthStr = xmlText.length + "";
        request.post({
            headers: {'Content-Type': 'text/xml;charset=windows-1251', 'Content-Length': textLengthStr},
            uri: 'http://' + cashserver_url + ':' + cashserver_port + '/lsoft',
            body: xmlText,
            encoding: 'binary'
            ,timeout:5000
        }, function (error, response, body) {
            callback(error, response, body);
        });
    }
    function getChequesData(body, callback) {
        var buf = new Buffer(body, 'binary'),
            str = iconv_lite.decode(buf, 'win1251'), body = iconv_lite.encode(str, 'utf8');

        parseString(body, function (err, result) {
            var outData = {sales:[], inners:[], reports:[]};
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
                            var xmlHeading={};
                            xmlHeading.DAT={};
                            xmlHeading.DAT.$=listItem.$;
                            xmlHeading.DAT.C=[];
                            xmlHeading.DAT.C[0]={};
                            xmlHeading.DAT.C[0].$=listItem.C[0].$;
                            xmlHeading.DAT.C[0].E=listItem.C[0].E;
                            xmlHeading.DAT.TS=listItem.TS;
                            cheque.xmlHeading = builder.buildObject(xmlHeading)
                                .replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',"")
                                .trim();


                            var xmlPayment={};
                            if(listItem.C[0].M) {
                                xmlPayment.M = listItem.C[0].M[0];
                                cheque.xmlPayment = builder.buildObject(xmlPayment).replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', "").trim();
                            }

                            cheque.checkDataID = listItem.$.DI;                    //DAT ID  не исп
                            cheque.ITN = listItem.$.TN;                            //ИНН не исп
                            cheque.dataVersion = listItem.$.V;                     // Версия формата пакета данных не исп
                            cheque.cashBoxFabricNum = listItem.$.ZN;
                            cheque.dataFormDate = listItem.TS[0];                        //не исп.

                            var goodsList = listItem.C[0].P;
                            cheque.productsInCheck = [];
                            cheque.checkNumber = /*"1111" +*/ listItem.C[0].E[0].$.NO;
                            cheque.totalCheckSum = listItem.C[0].E[0].$.SM;         //не исп
                            cheque.operatorID = listItem.C[0].E[0].$.CS;
                            cheque.fixalNumPPO = listItem.C[0].E[0].$.FN;         //не исп
                            cheque.checkDate = listItem.C[0].E[0].$.TS;

                            if (listItem.C[0].E[0].TX) {                                       //если налогов несколько может не использоваться
                                var taxInfo = listItem.C[0].E[0].TX[0].$;
                                if (taxInfo.DTNM) cheque.AddTaxName = taxInfo.DTNM; //не исп
                                if (taxInfo.DTPR) cheque.AddTaxRate = taxInfo.DTPR; //не исп
                                if (taxInfo.DTSM) cheque.AddTaxSum = taxInfo.DTSM;  //сумма дополнительного сбора
                                if (taxInfo.TX) cheque.taxMark = taxInfo.TX;     //не исп
                                if (taxInfo.TXPR) cheque.taxRate = taxInfo.TXPR;  //не исп
                                if (taxInfo.TXSM) cheque.taxSum = taxInfo.TXSM;   //не исп
                                if (taxInfo.TXTY) cheque.isTaxIncluded = taxInfo.TXTY;    //не исп    //"0"-включ в стоимость, "1" - не включ.
                            }

                            if (listItem.C[0].E[0].$ && listItem.C[0].E[0].$.VD) {   //если чек аннулирован
                                if(listItem.C[0].E[0].$.VD !=0){
                                    cheque.canceled=true;
                                }
                            }

                            if(listItem.C[0].M) {
                                var payment = listItem.C[0].M[0].$;
                                cheque.buyerPaymentSum = payment.SM;
                                if (payment.NM)cheque.paymentName = payment.NM;
                                cheque.paymentType = payment.T;                                  //"0" - нал. не "0" - безнал
                                if (payment.RM) cheque.change = payment.RM;
                            }

                            for (var pos in goodsList) {
                                var product = {};
                                var xmlProduct={};
                                xmlProduct.P=goodsList[pos];
                                product.xmlProduct = builder.buildObject(xmlProduct).replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', "").trim();

                                product.posNumber = goodsList[pos].$.N;
                                product.name = goodsList[pos].$.NM;
                                product.qty = goodsList[pos].$.Q;
                                product.price = goodsList[pos].$.PRC;
                                product.code = goodsList[pos].$.C;
                                product.barcode = goodsList[pos].$.CD;
                                product.taxMark = goodsList[pos].$.TX;
                                product.posSum = goodsList[pos].$.SM;
                                cheque.productsInCheck.push(product);
                            }
                            if(listItem.C[0].VD){
                                var cancelPositionNum;
                                var canceledProdList=listItem.C[0].VD;
                                if(listItem.C[0].VD[0].$)  {  				             // отменена  позиций в чеке  (номер операции продажи)
                                    for(var j in canceledProdList){
                                        cancelPositionNum=canceledProdList[j].$.NI;
                                        for(var posNum in cheque.productsInCheck){
                                            var product=cheque.productsInCheck[posNum];
                                            if(product.posNumber==cancelPositionNum){
                                                product.canceled=true;
                                            }
                                        }
                                    }
                                }else if (listItem.C[0].VD[0].NI){                   // отменена позиций в чеке  (массив номеров операций продаж)
                                    for(var j in listItem.C[0].VD[0].NI){
                                        cancelPositionNum=listItem.C[0].VD[0].NI[j].$.NI;
                                        for(var posNum in cheque.productsInCheck){
                                            var product=cheque.productsInCheck[posNum];
                                            if(product.posNumber==cancelPositionNum){
                                                product.canceled=true;
                                            }
                                        }
                                    }
                                }
                            }
                            outData.sales.push(cheque);
                        }
                        if(listItem.isInner){
                            var inner={};

                            var xmlInner={};
                            xmlInner.DAT={};
                            xmlInner.DAT=listItem;
                            inner.xmlInner=builder.buildObject(xmlInner)
                                .replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',"")
                                .replace("\n  <isInner>true</isInner>",'')
                                .trim();
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

                            inner.docDate = listItem.TS[0];
                            if(listItem.C[0].E[0].$.CS) inner.operatorID=listItem.C[0].E[0].$.CS;

                            inner.checkDataID = listItem.$.DI;
                            inner.ITN = listItem.$.TN;
                            inner.dataVersion = listItem.$.V;
                            inner.cashBoxFabricNum = listItem.$.ZN;
                            inner.dataFormDate = listItem.TS[0];

                            outData.inners.push(inner);
                        }

                        if(listItem.isZReport){
                            var report={};
                            var xmlZReport={};
                            xmlZReport.DAT={};
                            xmlZReport.DAT=listItem;
                            report.xmlZReport=builder.buildObject(xmlZReport)
                                .replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',"")
                                .replace("\n  <isZReport>true</isZReport>",'')
                                .trim();
                            report.checkDataID = listItem.$.DI;
                            report.ITN = listItem.$.TN;
                            report.FinID = listItem.$.FN;
                            report.dataVersion = listItem.$.V;
                            report.cashBoxFabricNum = listItem.$.ZN;
                            report.dataFormDate = listItem.TS[0];

                            report.reportNum=listItem.Z[0].$.NO;

                            for(var j in listItem.Z[0].M) {
                                if (listItem.Z[0].M[j].$.T=="0") {
                                    //M[...]  итоговая информация по оборотам по типам оплаты
                                    report.totalCashPaymentIncomeName = listItem.Z[0].M[j].$.NM?listItem.Z[0].M[j].$.NM:'';  //Название формы оплаты (может не указыватся)
                                    report.totalCashPaymentIncomeSum = listItem.Z[0].M[j].$.SMI?listItem.Z[0].M[j].$.SMI/100:0; //Сумма полученных денег в копейках  //может отсутствовать
                                    report.totalCashPaymentOutSum = listItem.Z[0].M[j].$.SMO?listItem.Z[0].M[j].$.SMO/100:0;

                                    //  report.totalCashIncome = listItem.Z[0].M[0].$.T;  //Тип оплаты: 0 – наличными
                                    // SMO -Сума выданных денег в копейках  //может отсутствовать
                                }else{
                                    report.totalCardPaymentIncomeName = listItem.Z[0].M[j].$.NM?listItem.Z[0].M[j].$.NM:'';  //Название формы оплаты (может не указыватся)
                                    report.totalCardPaymentIncomeSum = listItem.Z[0].M[j].$.SMI?listItem.Z[0].M[j].$.SMI:0.00; //Сумма полученных денег в копейках  //может отсутствовать
                                    report.totalCardPaymentOutSum = listItem.Z[0].M[j].$.SMO?listItem.Z[0].M[j].$.SMO:0;
                                }
                            }
                            //IO[...]   итоговая информация по внесению денег
                            if(listItem.Z[0].IO) {
                                if (listItem.Z[0].IO[0] && listItem.Z[0].IO[0].$ && listItem.Z[0].IO[0].$) {
                                    report.cashPaymentTypeName = listItem.Z[0].IO[0].$.NM?listItem.Z[0].IO[0].$.NM :"";    //Название формы оплаты (может не указыватся)
                                    report.totalMoneyRec = listItem.Z[0].IO[0].$.SMI ? listItem.Z[0].IO[0].$.SMI : 0;    //Сумма полученных денег в копейках
                                    report.totalMoneyExp = listItem.Z[0].IO[0].$.SMO ? listItem.Z[0].IO[0].$.SMO : 0; //Сумма выданных денег в копейках
                                    // listItem.Z[0].IO[0].$.T;  // Тип оплаты: 0 – наличными
                                }
                            }
                            //NC[]  итоговая информация по количеству чеков
                            report.totalSaleCheques =  listItem.Z[0].NC[0].$.NI?listItem.Z[0].NC[0].$.NI:0;
                            report.totalReturnCheques  =listItem.Z[0].NC[0].$.NO?listItem.Z[0].NC[0].$.NO:0;

                            report.SumCC_wt=0;
                            report.Tax_FSum=0;
                            for(var j in listItem.Z[0].TXS){
                                var taxItemReport=listItem.Z[0].TXS[j];
                                report.SumCC_wt=report.SumCC_wt+(taxItemReport.$.SMI ? taxItemReport.$.SMI/100 : 0);
                                report.Tax_FSum=report.Tax_FSum+(taxItemReport.$.DTI?taxItemReport.$.DTI/100:0);

                                if(taxItemReport.$.TX=="0"){
                                    report.TaxATotalIncomeSum = taxItemReport.$.SMI?taxItemReport.$.SMI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    report.TaxATotalTaxSum = taxItemReport.$.TXI?taxItemReport.$.TXI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    // report.TaxATaxRate = taxItemReport.$.TXPR?taxItemReport.$.TXPR/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                }
                                if(taxItemReport.$.TX=="1"){
                                    report.TaxBTotalIncomeSum = taxItemReport.$.SMI?taxItemReport.$.SMI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    report.TaxBTotalTaxSum = taxItemReport.$.TXI?taxItemReport.$.TXI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    // report.TaxBTaxRate = taxItemReport.$.TXPR?taxItemReport.$.TXPR/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                }
                                if(taxItemReport.$.TX=="2"){
                                    report.TaxCTotalIncomeSum = taxItemReport.$.SMI?taxItemReport.$.SMI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    report.TaxCTotalTaxSum = taxItemReport.$.TXI?taxItemReport.$.TXI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    //report.TaxCTaxRate = taxItemReport.$.TXPR?taxItemReport.$.TXPR/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                }
                                if(taxItemReport.$.TX=="3"){
                                    report.TaxDTotalIncomeSum = taxItemReport.$.SMI?taxItemReport.$.SMI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    report.TaxDTotalTaxSum = taxItemReport.$.TXI?taxItemReport.$.TXI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    // report.TaxDTaxRate = taxItemReport.$.TXPR?taxItemReport.$.TXPR/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                }
                                if(taxItemReport.$.TX=="4"){
                                    report.TaxETotalIncomeSum = taxItemReport.$.SMI?taxItemReport.$.SMI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    report.TaxETotalTaxSum = taxItemReport.$.TXI?taxItemReport.$.TXI/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                    // report.TaxDTaxRate = taxItemReport.$.TXPR?taxItemReport.$.TXPR/100:0; //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                                }
                            }
                            //TXS[...]  отчетную информацию по конкретному налогу.
                            // listItem.Z[0].TXS[0].$[0].DTI;   //Дополнительный сбор по полученным деньгам в копейках //может отсутствовать
                            //listItem.Z[0].TXS[0].$[0].DTNM; //Наименование дополнительного сбора
                            // listItem.Z[0].TXS[0].$[0].DTPR; //Ставка налогового сбора в процентах в копейках
                            //listItem.Z[0].TXS[0].$[0].SMI;  //Итог операций по полученным деньгам в копейках        //может отсутствовать
                            // listItem.Z[0].TXS[0].$[0].TS;   //Дата установки налога ----
                            //listItem.Z[0].TXS[0].$[0].TX;    //Обозначение налога
                            // listItem.Z[0].TXS[0].$[0].TXAL; //Алгоритм вычисления налога ---
                            // listItem.Z[0].TXS[0].$[0].TXI; //Налог по полученным деньгам в копейках  //может отсутствовать
                            // listItem.Z[0].TXS[0].$[0].TXPR; //Процент налога
                            //  listItem.Z[0].TXS[0].$[0].TXTY; //Признак налога, не включенного в стоимость:---

                            // TXO - Налог по выданным деньгам в копейках
                            // DTO - Дополнительный сбор по выданным деньгам  d копейках
                            // SMO -Итог операций по выданным деньгам в копейках
                            outData.reports.push(report);
                        }
                    }
                    callback(null, outData);
                }
            }catch (e){
                log.warn("Не удалось обработать данные полученные от кассового сервера! Причина:",e);
                callback(e, outData);
            }
        });
    }
    function formatDate(date){
        var dch = date.split("");
        var newDateFormat = dch[0] + dch[1] + dch[2] + dch[3] + "-" + dch[4] + dch[5] + "-" + dch[6] + dch[7] + " " + dch[8] + dch[9] + ":" + dch[10] + dch[11] + ":" + dch[12] + dch[13];
        return newDateFormat;
    }
    function fillCheques(chequesData, ind, finishedcallback) {
        var chequeData = chequesData[ind];
        if (!chequeData) {
            finishedcallback();
            return;
        }

        if(chequeData.canceled){
            emitAndLogEvent("Аннулированный чек от " + formatDate(chequeData.dataFormDate) +" не добавлен в БД",chequeData.xmlHeading, chequeData.cashBoxFabricNum,  function() {
                fillCheques(chequesData, ind + 1, finishedcallback);
            });
            return;
        }

        database.fillChequeTitle(chequeData, function (err, res) {
            if (err) {
                log.error("APP database.fillChequeTitle: Sale NOT created! Reason:"+ err);
                finishedcallback("Sale NOT created! Reason:"+ err);
                return;
            }
            chequeData.saleChID = res.ChID;
            var msg;
            if (res.exist) msg=  "Чек №" + chequeData.checkNumber + " найден в БД";
            else msg= "Заголовок чека №" + chequeData.checkNumber + " добавлен в БД";
            emitAndLogEvent(msg,chequeData.xmlHeading, chequeData.cashBoxFabricNum,  function(){
                var saleChID = chequeData.saleChID;
                var chequeProds = chequeData.productsInCheck;//!!!
                fillChequeProds(saleChID, chequeData, chequeProds, 0, /*finishedCallback*/function (err,saleChID, chequeData) {
                    if(err){
                        finishedcallback("Position not added to cheque! Reason:"+err);
                        return;
                    }
                    fillChequePays(saleChID, chequeData, function (err, res) {
                        if (err){
                            log.error("Не удалось внести оплату по чеку в БД Reason: "+err);
                            finishedcallback("Не удалось внести оплату по чеку в БД Reason: "+err);
                            return;
                        }
                        database.updateSaleStatus(saleChID, function (err, res) {
                            if (err) {
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
                emitAndLogEvent(msg,chequeProdData.xmlProduct, chequeData.cashBoxFabricNum, function () {
                    finishedCallback(msg);
                });
                return;
            }
            if (res.exist && res.exist=="SaleD") msg=" * Найдена позиция №" + chequeProdData.posNumber +  " в чеке №" + chequeData.checkNumber;
            if (res.exist && res.exist=="SaleC") msg=" * Найдена аннулированная позиция "+chequeProdData.name;
            if(res.addedSaleC)msg="* Аннулировання позиция "+chequeProdData.name+" добавлена в БД";
            if(res.addedSaleD)  msg=" * Добавлена позиция №" + chequeProdData.posNumber + " " + chequeProdData.name + " в чек №" + chequeData.checkNumber;
            emitAndLogEvent(msg,chequeProdData.xmlProduct,chequeData.cashBoxFabricNum, function(){
                fillChequeProds(saleChID, chequeData, chequeProdsData, ind + 1, finishedCallback);
            });
        });
    }
    function fillChequePays(saleChID, cheque, callback) {
        database.fillToSalePays(saleChID, cheque, function (err, res) {
            var msg;
            if (err) {
                callback(err);
                return;
            }
            if (res.exist) msg='Оплата по чеку №' + cheque.checkNumber + " обновлена";
            else msg='Оплата по чеку №' + cheque.checkNumber + " добавлена базу";
            emitAndLogEvent(msg,cheque.xmlPayment, cheque.cashBoxFabricNum,function(){
                callback(null, "ok");
            });
        });
    }

    app.get("/sysadmin/import_sales/get_sales", function (clientReq, clientRes) {
        var bdate = clientReq.query.bdate, edate = clientReq.query.edate;

        emitAndLogEvent('Поиск кассовых аппаратов',null,null, function(){

            var sCRIDsList= getCRIDList(clientReq.query);
            //getCashBoxesList(clientReq); //test
            //return;
            emitAndLogEvent('Подготовка данных для запроса на кассовый сервер',null,null, function(){
                database.getXMLForUniCashServerRequest(bdate, edate, sCRIDsList, function (error, xml) {
                    if (error){
                        emitAndLogEvent('Не удалось сформировать запрос. Reason: '+error, null,null, function() {
                            clientRes.send({error: error});
                        });
                        return;
                    }
                    // var xml='<?xml version="1.0" encoding="windows-1251" ?> '; //test
                    emitAndLogEvent('Отправка запроса кассовому серверу',null,null, function(){
                        getDataFromUniCashServer(xml, function (error, response, body) {
                            if(error){
                                log.error(error);
                                var errMsg;
                                try{
                                    errMsg= JSON.parse(error)
                                }catch(e){
                                    errMsg=error;
                                }
                                emitAndLogEvent("Ошибка подключения к кассовому серверу!\n"+errMsg,null,null,function(){
                                    clientRes.send({error:error});
                                });
                                return;
                            }
                            if(!response){
                                log.error("Кассовый сервер не отвечает!");
                                emitAndLogEvent("Кассовый сервер не отвечает!",null,null, function(){
                                    clientRes.send({error: "Кассовый сервер не отвечает!"});
                                });
                                return;
                            }
                            if(!body){
                                log.error("Кассовый сервер не прислал данные!");
                                emitAndLogEvent("Кассовый сервер не прислал данные!",null,null,function(){
                                    clientRes.send({error: "Кассовый сервер не прислал данные!"});
                                });
                                return;
                            }
                            emitAndLogEvent('Получен ответ от кассового сервера', null,null, function(){
                                // body='<?xml version="1.0" encoding="windows-1251" ?>'; //test
                                //  body="kjhbkljh"; //test
                                getChequesData(body, function (err, result) {
                                    if (err) {
                                        emitAndLogEvent('Не удалось обработать данные кассового сервера!\n'+err,null,null, function(){
                                            clientRes.send({error: 'Не удалось обработать данные кассового сервера!\n'+err});
                                        });
                                        return;
                                    }

                                    fs.writeFile("./chequesData.json", JSON.stringify(result), function (err, success) {
                                        //callback(err,success);
                                    });

                                    emitAndLogEvent('Данные кассового сервера обработаны успешно', null,null, function(){
                                        var chequesData = result.sales;
                                        fillCheques(chequesData, 0, /*finishedcallback*/function(err){
                                            if(err){
                                                clientRes.send({error:err});
                                                return;
                                            }
                                            var msg = 'Все чеки успешно обработаны';
                                            if(chequesData.length<1)msg = "";
                                            emitAndLogEvent( msg,null, chequesData.cashBoxFabricNum, function(){
                                                var innersDocData = result.inners;
                                                insertInnerDoc(innersDocData,0,function(err,res){
                                                    if(err){
                                                        clientRes.send({"error": err});
                                                        return;
                                                    }
                                                    var msg='Все вносы/выносы успешно обработаны';
                                                    if(innersDocData.length<1) msg = "";
                                                    emitAndLogEvent(msg,null, chequesData.cashBoxFabricNum,function(){
                                                        addToZrep(result.reports, 0,function(err,res) {
                                                            if (err) {
                                                                clientRes.send({"error": err});
                                                                return;
                                                            }
                                                            var msg='Все Z-Отчеты успешно обработаны';
                                                            if(result.reports.length<1) msg = "";
                                                            emitAndLogEvent(msg,null, chequesData.cashBoxFabricNum, function () {
                                                                emitAndLogEvent('Все полученные данные успешно обработаны', null,chequesData.cashBoxFabricNum, function () {
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
                        });
                    });
                });
            });
        });
    });

    function addToZrep(reports, ind, callback) {
        if (!reports[ind]) {
            callback(null, "done");
            return;
        }
        var report = reports[ind];
        database.addToZrep(report, function (err, res) {
            if (err) {
                emitAndLogEvent('Произошла ошибка при  записи Z-Отчета  в БД.\n Причина: ' + err, report.xmlZReport,report.cashBoxFabricNum, function () {
                    log.error('Произошла ошибка при  записи Z-Отчета в БД.Причина: ' + err);
                    callback(err);
                });
                return;
            }
            if (res.exists) {
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
        if (!InnerDocList[ind]) {
            callback(null, "done");
            return;
        }
        var doc = InnerDocList[ind];
        if (doc.isMoneyIn) {
            database.addToMonIntRec(doc, function (err,result) {
                if (err) {
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
        } else if (doc.isMoneyOut) {
            database.addToMonIntExp(doc, function (err,result) {
                if (err) {
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
        //var filename = req.params[0];
        var outData={};
        //  var fileContentString=fs.readFileSync('./reportsConfig/'+filename+'.json', 'utf8');
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
        if (!bdate&&!edate) {
            res.send(outData);
            return;
        }
        database.getLogs(bdate,edate+" 23:59:59",crId,
            function (error,recordset) {
                if (error){
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
                procUniCashserver.postProductsToUniCashServer(server.getSysConfig(), dataItems, function(err,xml,response,body){
                    if(err&&err.nullLineCounter){
                        res.send({nullLineCounter:err.nullLineCounter,xmlText:xml,error:"XML содержит некорректные позиции!"});
                        return;
                    }else if(err){
                        log.error("postProductsToUniCashServer error:",err.message);
                        res.send({xmlText:xml,error:"Не удалось выполнить запрос к кассовому серверу! Причина: "+err.message});
                        return;
                    }
                    if(!response){
                        log.error("postProductsToUniCashServer error: Кассовый сервер не отвечает!");
                        res.send({xmlText:xml,error:"Кассовый сервер не отвечает!"});
                        return;
                    }
                    if(!body){
                        log.error("postProductsToUniCashServer error: Кассовый сервер не прислал данные!");
                        res.send({xmlText:xml,error:"Кассовый сервер не прислал данные!"});
                        return;
                    }
                    var buf = new Buffer(body, 'binary'), str = iconv_lite.decode(buf, 'win1251');
                    res.send({xmlText:xml,serverResp:str});
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
        if (!bdate&&!edate) {
            res.send(outData);
            return;
        }
        var CRID;
        // var initialCRID= req.params[0].replace("Sales","");
        if(initialCRID==-1){
            database.getAllCashBoxes(function (err, result) {
                if (err) {
                    outData.error = err.message;
                    return;
                }
                CRID='';
                for(var i in result) CRID = CRID + result[i].CRID + ",";
                CRID=CRID.substring(0,CRID.length-1)/*+")"*/;
                database.getSales(bdate,edate+" 23:59:59",CRID,
                    function (error,recordset) {
                        if (error){
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
            database.getSales(bdate,edate+" 23:59:59",CRID,
                function (error,recordset) {
                    if (error){
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
        var outData={};
        var initialCRID= req.params[0].replace("GetPrices","");
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
            database.getAllCashBoxes(function (err, result)  {
                if (err) {
                    outData.error = err.message;
                    return;
                }
                CRID='';
                for(var i in result) CRID = CRID + result[i].CRID + ",";
                CRID=CRID.substring(0,CRID.length-1);
                database.getProdsPricesByCRID(CRID,
                    function (error,recordset) {
                        if (error){
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
            database.getProdsPricesByCRID(CRID,
                function (error, recordset) {
                    if (error) {
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

