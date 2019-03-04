var Buffer = require('buffer').Buffer, request = require('request'),
    iconv_lite = require('iconv-lite'),
    xml2js = require('xml2js'), parseString = xml2js.parseString, builder = new xml2js.Builder();
/**
 *
 * params = { cashserverUrl, cashserverPort }
 * xml
 * callback = function(err,resultXML)
 */
module.exports.getDataFromUniCashServer= function(params, xml, callback){
    var cashserver_url = params['cashserverUrl'], cashserver_port = params['cashserverPort'],
        xmlText = "";
    for(var i in xml){
        var xmlLine = xml[i].XMLText;
        xmlText+= xmlLine;
    }
    var textLengthStr = xmlText.length + "";
    request.post({
        headers: {'Content-Type': 'text/xml;charset=windows-1251', 'Content-Length': textLengthStr},
        uri: 'http://' + cashserver_url + ':' + cashserver_port + '/lsoft',
        body: xmlText,
        encoding: 'binary'
        ,timeout:5000
    }, function(error, response, body){
        var errMsg=null;
        if(error) errMsg="Ошибка подключения к кассовому серверу! Причина:"+error.message;
        else if(!response) errMsg="Кассовый сервер не отвечает!";
        else if(!body) errMsg="Кассовый сервер не прислал данные!";
        if(errMsg){
            callback(errMsg);
            return
        }
        var buf = new Buffer(body, 'binary'),
            str = iconv_lite.decode(buf, 'win1251'), resultXML = iconv_lite.encode(str, 'utf8');
        callback(null,(resultXML)?resultXML.toString():resultXML);
    });
};

module.exports.getCashboxDataFromXML= function(sUniXML, callback){
    parseString(sUniXML, function(err,result){
        var outData = {sales:[], inners:[], reports:[]};
        if(err){
            callback(err);
            return;
        }
        if(!result){
            callback("XML пуст!");
            return;
        }
        if(result && result.ERROR){// Проверка на валидность ответа
            var stringResult=(result.ERROR)?JSON.stringify(result.ERROR):result.ERROR;
            callback("Oтвет кассового сервера: "+stringResult);
            return;
        }
        if(!result.gw_srv_rsp || !result.gw_srv_rsp.select){// Проверка на валидность ответа
            var stringResult=(result)?JSON.stringify(result):result;
            callback("Oтвет кассового сервера: " +stringResult);
            return;
        }
        try {
            var cashBoxList = result.gw_srv_rsp.select[0].FISC[0].EJ;
            for(var fn in cashBoxList){
                var cashBox = cashBoxList[fn],
                    cashBoxID = cashBox.$.ID,
                    docList = cashBoxList[fn].DAT;
                for(var i in docList){
                    var listItem = docList[i];
                    if(listItem.Z) listItem.isZReport = true;
                    else if(listItem.C[0].$.T == '0') listItem.isSale = true;
                    else if(listItem.C[0].$.T == '1') {
                        listItem.isReturn = true;
                        callback("Операция возврврата не поддерживается!");
                        return;
                    }else if(listItem.C[0].$.T == '2') listItem.isInner = true;
                    else{
                        callback("Неизвестная операция");
                        return;
                    }
                    if(listItem.isSale) {
                        var cheque = {}, xmlHeading={};
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
                        var prodsList = listItem.C[0].P,//список позиций по чеку
                            canceledProdsList = listItem.C[0].VD;//список отмен по чеку
                        cheque.productsInCheck = [];
                        cheque.checkNumber = /*"1111" +*/ listItem.C[0].E[0].$.NO;
                        cheque.totalCheckSum = listItem.C[0].E[0].$.SM;         //не исп
                        cheque.operatorID = listItem.C[0].E[0].$.CS;
                        cheque.fixalNumPPO = listItem.C[0].E[0].$.FN;         //не исп
                        cheque.checkDate = listItem.C[0].E[0].$.TS;
                        if(listItem.C[0].E[0].TX){//если налогов несколько может не использоваться
                            var taxInfo = listItem.C[0].E[0].TX[0].$;
                            if (taxInfo.DTNM) cheque.AddTaxName = taxInfo.DTNM; //не исп
                            if (taxInfo.DTPR) cheque.AddTaxRate = taxInfo.DTPR; //не исп
                            if (taxInfo.DTSM) cheque.AddTaxSum = taxInfo.DTSM;  //сумма дополнительного сбора
                            if (taxInfo.TX) cheque.taxMark = taxInfo.TX;     //не исп
                            if (taxInfo.TXPR) cheque.taxRate = taxInfo.TXPR;  //не исп
                            if (taxInfo.TXSM) cheque.taxSum = taxInfo.TXSM;   //не исп
                            if (taxInfo.TXTY) cheque.isTaxIncluded = taxInfo.TXTY;    //не исп    //"0"-включ в стоимость, "1" - не включ.
                        }
                        if(listItem.C[0].E[0].$ && listItem.C[0].E[0].$.VD){   //если чек аннулирован
                            if(listItem.C[0].E[0].$.VD !=0){
                                cheque.canceled=true;
                            }
                        }
                        if(listItem.C[0].M){
                            var payment = listItem.C[0].M[0].$;
                            cheque.buyerPaymentSum = payment.SM;
                            if (payment.NM)cheque.paymentName = payment.NM;
                            cheque.paymentType = payment.T;//"0" - нал. не "0" - безнал
                            if(payment.RM) cheque.change = payment.RM;
                        }
                        for(var pos in prodsList){
                            var product = {};
                            var xmlProduct={};
                            xmlProduct.P=prodsList[pos];
                            product.xmlProduct = builder.buildObject(xmlProduct).replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', "").trim();
                            product.posNumber = prodsList[pos].$.N;
                            product.name = prodsList[pos].$.NM;
                            product.qty = prodsList[pos].$.Q;
                            product.price = prodsList[pos].$.PRC;
                            product.code = prodsList[pos].$.C;
                            product.barcode = prodsList[pos].$.CD;
                            product.taxMark = prodsList[pos].$.TX;
                            product.posSum = prodsList[pos].$.SM;
                            cheque.productsInCheck.push(product);
                        }
                        if(canceledProdsList&&canceledProdsList.length>0){// отменены  позиций в чеке  (номер операции продажи)
                            var cancelPosition=null,cancelPositionNum;
                            for(var j in canceledProdsList){
                                cancelPosition=canceledProdsList[j];
                                if(cancelPosition.$&&cancelPosition.$.NI){          //в отменах VD есть атирбут отмены NI
                                    cancelPositionNum=cancelPosition.$.NI;
                                    for(var posNum in cheque.productsInCheck){
                                        var product=cheque.productsInCheck[posNum];
                                        if(product.posNumber==cancelPositionNum) product.canceled=true;
                                    }
                                }
                                if(!cancelPosition.NI||!cancelPosition.NI.length>0) continue;
                                var cancelPositionCancelList=cancelPosition.NI;             // отменены позиций в чеке  (массив номеров операций продаж)
                                for(var j1 in cancelPositionCancelList){
                                    cancelPositionNum=cancelPositionCancelList[j1].$.NI;
                                    for(var posNum in cheque.productsInCheck){
                                        var product=cheque.productsInCheck[posNum];
                                        if(product.posNumber==cancelPositionNum) product.canceled=true;
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
                        for(var j in listItem.Z[0].M){//M[...]  итоговая информация по оборотам по типам оплаты
                            if(listItem.Z[0].M[j].$.T=="0"){
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
                        if(listItem.Z[0].IO){//IO[...]   итоговая информация по внесению денег
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
        }catch(e){
            callback(e.message, outData);
        }
    });
};
/**
 * params = { cashserverUrl, cashserverPort }
 * callback = function(err,result)
 * result = { xmlText }
 */
module.exports.postProductsToUniCashServer= function (params, xmlData, callback){
    var cashserverUrl = params.cashserverUrl, cashserverPort = params.cashserverPort,
        xmlText = "", nullLineCounter=0;
    for(var i in xmlData){
        var xmlLine = xmlData[i].XMLText, noProdName = xmlData[i].noProdName;
        if(xmlLine==null || noProdName==true) nullLineCounter=nullLineCounter+1;
        xmlText = xmlText + xmlLine + "\n";
    }
    if(nullLineCounter>0){
        callback("XML содержит некорректные позиции!",{nullLineCounter:nullLineCounter,xmlText:xmlText});
        return;
    }
    var byteLength =Buffer.byteLength(xmlText, 'windows-1251');
    request.post({
        headers: {'Content-Type': 'text/xml;charset=windows-1251', 'Content-Length': byteLength},
        uri: 'http://' + cashserverUrl + ':' + cashserverPort + '/lsoft',
        body: xmlText,
        encoding: 'binary'
        ,timeout:5000
    },function(error, response, body){
        var errMsg=null;
        if(error) errMsg=error.message;
        else if(!response) errMsg="Кассовый сервер не отвечает!";
        else if(!body) errMsg="Кассовый сервер не прислал данные!";
        if(errMsg){
            callback(errMsg,{xmlText:xmlText});
            return;
        }
        var buf = new Buffer(body, 'binary'), str = iconv_lite.decode(buf, 'win1251');
        callback(null,{xmlText:xmlText,serverResp:str});
    });
};
