var fs = require('fs');
var sql = require('mssql');
var app = require('./app');
var dbConfig;
var dbConfigFilePath;
var conn=null;

module.exports.getDBConfig=function(){
    return dbConfig;
};
module.exports.setDBConfig=function(newDBConfig){
    dbConfig= newDBConfig;
};
module.exports.loadConfig=function(){
    dbConfigFilePath='./' + app.startupMode + '.cfg';
    var stringConfig = fs.readFileSync(dbConfigFilePath);
    dbConfig = JSON.parse(stringConfig);
};
module.exports.saveConfig=function(callback) {
    fs.writeFile(dbConfigFilePath, JSON.stringify(dbConfig), function (err, success) {
        callback(err,success);
    })
};
module.exports.databaseConnection=function(callback){
    if(conn) conn.close();
    conn = new sql.Connection(dbConfig);
    conn.connect(function (err) {
        if (err) {
            callback(err.message);
            return;
        }
        callback(null,"connected");
    });
};

module.exports.setConfirmedOrderInfo = function (ChID, name, tel, email, callback) {
    var textInfo = "name:"+ name+",tel:"+tel+",email:"+email;
    var reqSql = new sql.Request(conn);
    var query_str = fs.readFileSync('./scripts/mobile_confirmed_order_info.sql', 'utf8');

    reqSql.input('ChID',sql.Int, ChID);
    reqSql.input('OrderInfo',sql.NVarChar, textInfo);

    reqSql.query(query_str,
        function (err,recordset) {
            if (err) {
                callback(err, null);
            }
            else {
                callback(null, recordset);
            }
        });
};

module.exports.getAllCashBoxes= function(callback) {
    var reqSql = new sql.Request(conn);
    var query_str='SELECT * FROM r_Crs WHERE CRID>0 AND CashType=8 ';
    reqSql.query(query_str,
        function (err, recordset) {
            if (err) {
                callback(err);
            } else {
               callback(null,recordset);
        }
        }
    );
};

module.exports.createXMLSalesRequest = function (bdate, edate, cashBoxesID, errAction, successAction) {
    var reqSql = new sql.Request(conn);
    var query_str = fs.readFileSync('./scripts/sales_report.sql', 'utf8');
    reqSql.input('BDATE', sql.NVarChar, bdate);
    reqSql.input('EDATE', sql.NVarChar, edate);
    reqSql.input('CRIDLIST', sql.NVarChar, cashBoxesID);
    reqSql.query(query_str,
        function (err, recordset) {
            if (err) {
                errAction(err);
            } else {
               successAction(recordset);
            }
        })
};

module.exports.isSaleExists = function (data, callback) {
    var reqSql = new sql.Request(conn);
    reqSql.input('DocID', sql.Int, data.checkNumber);
    // reqSql.input('FacID',sql.NVarChar, data.cashBoxFabricNum);
    var queryString = fs.readFileSync('./scripts/check_t_sale_exists.sql', 'utf8');

        reqSql.query(queryString,
            function (err, recordset) {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                var outData = {};
                outData.data = data;
                if (recordset.length == 0) {
                    outData.empty = true;
                } else outData.ChID = recordset[0].ChID;
                outData.checkData=data;
                callback(null, outData);
            });
};
/*(ChID,  DocID, DocDate, KursMC,  OurID,
    StockID,    CompID,	CodeID1,	CodeID2,	CodeID3,
    CodeID4, CodeID5,	Discount,	Notes,	CRID,
    OperID,	CreditID,	DocTime,	DCardID,	EmpID,
    IntDocID, CashSumCC,	ChangeSumCC,	CurrID,	TSumCC_nt,
    TTaxSum,	TSumCC_wt,	StateCode,	DeskCode,	Visitors,
    TPurSumCC_nt, TPurTaxSum,	TPurSumCC_wt,	DocCreateTime,	TRealSum,
    TLevySum)*/

module.exports.addToSale = function (data, callback) {            //console.log("addToSale ", data);

    //var dch = data.checkDate.split("");
    //var date = dch[0] + dch[1] + dch[2] + dch[3] + "-" + dch[4] + dch[5] + "-" + dch[6] + dch[7] + " " + dch[8] + dch[9] + ":" + dch[10] + dch[11] + ":" + dch[12] + dch[13];
    var FacID=data.cashBoxFabricNum;
    var FacIDNum=FacID.replace("ПБ","");    console.log("FacIDNum=",FacIDNum);
    var date=formatDate(data.checkDate);
    var reqSql = new sql.Request(conn);

    var queryString = fs.readFileSync('./scripts/add_to_sale.sql', 'utf8');
    reqSql.input('DocID', sql.NVarChar, data.checkNumber);
    reqSql.input('DocDate', sql.NVarChar, date);
    reqSql.input('OperID', sql.NVarChar, data.operatorID);
    reqSql.input('DocTime', sql.NVarChar, date);
    reqSql.input('CashSumCC', sql.NVarChar, data.buyerPaymentSum);
    reqSql.input('FacID', sql.NVarChar,FacIDNum);
    reqSql.input('DocCreateTime', sql.NVarChar, date);
    if (data.change) reqSql.input('ChangeSumCC', sql.NVarChar, data.change);
    else reqSql.input('ChangeSumCC', sql.NVarChar, 0);
   // reqSql.input('TTaxSum', sql.NVarChar, data.AddTaxSum + data.taxSum);
   // reqSql.input('TSumCC_wt', sql.NVarChar, data.totalCheckSum);

    reqSql.query(queryString,
        function (err,recordset) {
            if (err) {
                callback(err, null);
                return;
            }
            callback(null, recordset[0].ChID);                       //   console.log("recordset[0].ChID", recordset[0].ChID);
        });
};
<!--ChID,	SrcPosID,	ProdID,	PPID,	UM,	Qty,	PriceCC_nt,	SumCC_nt,	Tax,	TaxSum,	PriceCC_wt,-->
<!--SumCC_wt,	BarCode,	SecID,	PurPriceCC_nt,	PurTax,	PurPriceCC_wt,	PLID,	Discount,	EmpID,-->
<!--CreateTime,	ModifyTime,	TaxTypeID,	RealPrice,	RealSum-->

//module.exports.addToSaleD = function (ChID, data, callback) {  console.log("data 149=", data);
//
//    var date = formatDate(data.checkDate);
//    var productsInCheck = data.productsInCheck;
//  //  var queryString = fs.readFileSync('./scripts/add_to_saleD.sql', 'utf8');
//
//    function insertToSaleD(productsInCheck, i) {
//        //for (var i in productsInCheck) {
//        if (i >= productsInCheck.length) {
//         //   addToSalePays(ChID, data.paymentType, data.buyerPaymentSum,data.change) ;
//            callback(null, data);
//            return;
//        } /*return;/*callback(null, "ok");*/
//
//        var reqSql = new sql.Request(conn);
//        var PriceCC_nt = productsInCheck[i].price/1.2;
//        var Qty = productsInCheck[i].qty;
//        var SumCC_nt = PriceCC_nt * Qty;
//        var Tax = productsInCheck[i].price - PriceCC_nt;
//        var TaxSum = Tax * Qty;
//        reqSql.input('ChID', sql.NVarChar, ChID);
//        reqSql.input('SrcPosID', sql.NVarChar, productsInCheck[i].posNumber);
//        reqSql.input('Article2', sql.NVarChar, productsInCheck[i].name);
//        reqSql.input('Qty', sql.NVarChar, Qty);
//        reqSql.input('PriceCC_nt', sql.NVarChar, PriceCC_nt);
//        reqSql.input('SumCC_nt', sql.NVarChar, SumCC_nt);
//        reqSql.input('Tax', sql.NVarChar, Tax);
//        reqSql.input('TaxSum', sql.NVarChar, TaxSum);
//        reqSql.input('PriceCC_wt', sql.NVarChar, productsInCheck[i].price);
//        reqSql.input('SumCC_wt', sql.NVarChar, productsInCheck[i].price * Qty);
//        reqSql.input('PurPriceCC_nt', sql.NVarChar, PriceCC_nt);
//        reqSql.input('PurTax', sql.NVarChar, Tax);
//        reqSql.input('PurPriceCC_wt', sql.NVarChar, productsInCheck[i].price);
//        reqSql.input('CreateTime', sql.NVarChar, date);
//        reqSql.input('ModifyTime', sql.NVarChar, date);
//        // reqSql.input('TaxTypeID', sql.NVarChar, productsInCheck[i].taxMark);
//        reqSql.input('RealPrice', sql.NVarChar, productsInCheck[i].price);
//        reqSql.input('RealSum', sql.NVarChar, productsInCheck[i].price * Qty);
//        reqSql.input('OperID', sql.NVarChar, data.operatorID);
//
//        reqSql.query('select * from t_saleD where CHID=@ChID AND SrcPosID=@SrcPosID',
//            function (err, recordset) {
//                if (err) {
//                    callback(err, null);
//                    return;
//                }
//                if (!recordset[0]) {
//                    reqSql.query('select ProdID from r_Prods where Article2=@Article2',
//                        function (err, recordset) {
//                            if (err) {
//                               // console.log("addToSaleD err 202=", err);
//                                callback(err, null);
//                                return;
//                            }
//                            if (!recordset[0]) {
//                                console.log("Не удалось внести позицию! Наименования " + productsInCheck[i].name + " не найдено в базе");
//                            } else {
//                                var queryString = fs.readFileSync('./scripts/add_to_saleD.sql', 'utf8');
//                                reqSql.query(queryString,
//                                    function (err, recordset) {
//
//                                        if (err) {  //console.log("addToSaleD err 212=", err);
//                                            callback(err, null);
//                                        }
//                                        insertToSaleD(productsInCheck, i + 1);
//                                        // callback(null, recordset[0].ChID);                          console.log("recordset[0].ChID", recordset[0].ChID);
//                                    });
//                            }
//                        });
//                } else insertToSaleD(productsInCheck, i + 1);          //Сущ запись  CHID PosID
//            });
//    }
//    insertToSaleD(productsInCheck, 0);
//};

module.exports.addToSalePays =function (CHID,PaymentForm,buyerPaymentSum,change,callback){   console.log("addToSalePays");

    var PayFormCode =detectPaymentForm(PaymentForm);

    var reqSql = new sql.Request(conn);
    var query_str = fs.readFileSync('./scripts/add_to_salepays.sql', 'utf8');
    reqSql.input('CHID', sql.NVarChar, CHID);
    reqSql.input('PayFormCode', sql.NVarChar, PayFormCode);
    reqSql.input('SumCC_wt', sql.NVarChar, buyerPaymentSum);


    reqSql.query(query_str,
        function (err, recordset) {
            if (err) {
                callback(err);
                console.log(err);
            } else {
                if(change){
                    var reqSql = new sql.Request(conn);
                    var query_str = fs.readFileSync('./scripts/add_to_salePays', 'utf8');
                    reqSql.input('CHID', sql.NVarChar, CHID);
                    reqSql.input('PayFormCode', sql.NVarChar, PayFormCode);
                    reqSql.input('SumCC_wt', sql.NVarChar, buyerPaymentSum);
                    reqSql.input('SumCC_wt', sql.NVarChar, '-'+change);
                    reqSql.query(query_str,
                        function (err, recordset) {
                            if (err) {
                                callback(err);
                             console.log(err);
                            } else {
                                callback(null,CHID);
                            }
                        })
                };
            }
            callback(null,CHID);
        })
};

module.exports.updateSaleStatus = function(CHID, callback){   console.log('updateSaleStatus');

    var reqSql = new sql.Request(conn);
  //  var query_str = fs.readFileSync('./scripts/add_to_salepays.sql', 'utf8');
    reqSql.input('CHID', sql.NVarChar, CHID);

    reqSql.query('UPDATE t_Sale SET StateCode=22 WHERE CHID=@CHID',
        function (err, recordset) {
            if (err) {
                callback(err);
                console.log(err);
            }
        })

};

function isSaleExists(DOCID,callback){                     console.log("isSaleExists DOCID=",DOCID);
    var reqSql = new sql.Request(conn);
    reqSql.input('DOCID', sql.Int, DOCID);
    reqSql.query('select ChID from t_Sale WHERE DOCID=@DOCID',
        function (err, recordset) {
            var outData={};
            if (err) {
                callback(err);                              console.log(err);
                return;
            }
            if(recordset[0]){                                console.log("recordset[0]=",recordset[0]);
                outData.ChID=recordset[0].ChID;
                outData.exist=true;
                callback(null, outData);
                return;
            }
                callback(null,"notExist");
        })
}

function addToSale(data, callback){                        console.log("addToSale");
    var FacID=data.cashBoxFabricNum;
    var FacIDNum=FacID.replace("ПБ","");
    var date=formatDate(data.checkDate);
    var reqSql = new sql.Request(conn);

    var queryString = fs.readFileSync('./scripts/add_to_sale.sql', 'utf8');
    reqSql.input('DocID', sql.NVarChar, data.checkNumber);
    reqSql.input('DocDate', sql.NVarChar, date);
    reqSql.input('OperID', sql.NVarChar, data.operatorID);
    reqSql.input('DocTime', sql.NVarChar, date);
    reqSql.input('CashSumCC', sql.NVarChar, data.buyerPaymentSum);
    reqSql.input('FacID', sql.NVarChar,FacIDNum);
    reqSql.input('DocCreateTime', sql.NVarChar, date);
    if (data.change) reqSql.input('ChangeSumCC', sql.NVarChar, data.change);
    else reqSql.input('ChangeSumCC', sql.NVarChar, 0);

    reqSql.query(queryString,
        function (err,recordset) {
            var outData={};
            if (err) {
                callback(err, null);
                return;
            }
            outData.ChID=recordset[0].ChID;                           console.log("recordset.ChID=",recordset);
            outData.created=true;
            callback(null, outData);
        });
}

module.exports.fillChequeTitle = function(chequeData, callback) {          console.log("fillChequeTitle  DATABASE");

    var chequeNum = chequeData.checkNumber;                                console.log("chequeNum=",chequeNum);
    isSaleExists(chequeNum, function (err, res) {
        if (err) {
            callback(err);
            return;
        }
        if (res.exist) {                                                    console.log("fillChequeTitle res.exist res=",res);
            callback(null, res);
            return;
        }

        addToSale(chequeData, function (err, res) {
            if (err) {
                callback(err);
                return;
            }
            callback(null,res);                                             console.log("fillChequeTitle res creadet res=",res);
        })
    });
};

function isPosExists(ChID, posNum, callback){
    var reqSql = new sql.Request(conn);
    reqSql.input('ChID', sql.NVarChar, ChID);
    reqSql.input('SrcPosID', sql.NVarChar, posNum);
    reqSql.query('select ChID,SrcPosID  from t_SaleD WHERE ChID=@ChID AND SrcPosID=@SrcPosID',
        function (err, recordset) {
            var outData={};
            if (err) {
                callback(err);                              console.log(err);
                return;
            }
            if(recordset[0]){
                outData.ChID=recordset[0].ChID;
                outData.SrcPosID=recordset[0].SrcPosID;
                outData.exist=true;
                callback(null, outData);
                return;
            }
            callback(null,"notExist");
        })
}

function addToSaleD(ChID, chequeData, chequeProdData, callback) {    console.log("addToSaleD  chequeProdData=",chequeProdData);
    var date = formatDate(chequeData.checkDate);
    var PriceCC_nt = chequeProdData.price / 1.2;
    var Qty = chequeProdData.qty;
    var SumCC_nt = PriceCC_nt * Qty;
    var Tax = chequeProdData.price - PriceCC_nt;
    var TaxSum = Tax * Qty;
    var reqSql = new sql.Request(conn);
    reqSql.input('ChID', sql.NVarChar, ChID);
    reqSql.input('SrcPosID', sql.NVarChar, chequeProdData.posNumber);
    reqSql.input('Article2', sql.NVarChar, chequeProdData.name);
    reqSql.input('Qty', sql.NVarChar, Qty);
    reqSql.input('PriceCC_nt', sql.NVarChar, PriceCC_nt);
    reqSql.input('SumCC_nt', sql.NVarChar, SumCC_nt);
    reqSql.input('Tax', sql.NVarChar, Tax);
    reqSql.input('TaxSum', sql.NVarChar, TaxSum);
    reqSql.input('PriceCC_wt', sql.NVarChar, chequeProdData.price);
    reqSql.input('SumCC_wt', sql.NVarChar, chequeProdData.price * Qty);
    reqSql.input('PurPriceCC_nt', sql.NVarChar, PriceCC_nt);
    reqSql.input('PurTax', sql.NVarChar, Tax);
    reqSql.input('PurPriceCC_wt', sql.NVarChar, chequeProdData.price);
    reqSql.input('CreateTime', sql.NVarChar, date);
    reqSql.input('ModifyTime', sql.NVarChar, date);
    // reqSql.input('TaxTypeID', sql.NVarChar, chequeProdData.taxMark);
    reqSql.input('RealPrice', sql.NVarChar, chequeProdData.price);
    reqSql.input('RealSum', sql.NVarChar, chequeProdData.price * Qty);
    reqSql.input('OperID', sql.NVarChar, chequeData.operatorID);

    reqSql.query('select ProdID from r_Prods where Article2=@Article2',
        function (err, recordset) {
            var outData={};
            if (err) {
                callback(err, null);
                return;
            }
            if (!recordset[0]) {        console.log("Не удалось внести позицию! Наименования " + chequeProdData.name + " не найдено в базе");
                outData.notFoundProd="Не удалось внести позицию! Наименования " + chequeProdData.name + " не найдено в базе";
                callback(null, outData);
                return;
            }
            var queryString = fs.readFileSync('./scripts/add_to_saleD.sql', 'utf8');
            reqSql.query(queryString,
                function (err) {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    outData.ChID=ChID
                    callback(null,outData);
                });
        });
}

module.exports.fillChequeProds = function(saleChID,chequeData, chequeProdData, callback) {          console.log("fillChequeTitle  DATABASE");

    var posNum = chequeProdData.posNumber;
    isPosExists(saleChID,posNum, function (err, res) {
        if (err) {
            callback(err);
            return;
        }
        if (res.exist) {
            callback(null, res);
            return;
        }

        addToSaleD(saleChID,chequeData, chequeProdData, function (err, res) {
            if (err) {
                callback(err);
                return;
            }
            callback(null,res);
        })
    });
};


    //var reqSql = new sql.Request(conn);
    //reqSql.input('DOCID', sql.NVarChar, chequeNum);
    //var outData={};
    //reqSql.query('select chid from t_Sale WHERE DOCID=@DOCID',
    //    function (err, recordset) {
    //        if (err) {
    //            callback(err);                              console.log(err);
    //            return;
    //        }
    //        if(recordset[0]){
    //            outData.CHID=recordset[0];
    //            outData.exist=true;
    //            callback(null, outData);
    //            return;
    //        }
    //        else{
    //
    //        }
    //    })
//};

function formatDate(date){
    var dch = date.split("");
    var newDateFormat = dch[0] + dch[1] + dch[2] + dch[3] + "-" + dch[4] + dch[5] + "-" + dch[6] + dch[7] + " " + dch[8] + dch[9] + ":" + dch[10] + dch[11] + ":" + dch[12] + dch[13];
    return newDateFormat;
}

function detectPaymentForm(PaymentForm){
    return  PaymentForm == '0' ? 1 : 2;
}

/*
 * { checkDataID: '17712',
 ITN: 'ПН 000036837328',
 dataVersion: '1',
 cashBoxFabricNum: 'ПБ4101213753',
 dataFormDate: '20170413094128',
 productsInCheck:
 [ { posNumber: '1',
 name: 'Медовуха майс.0,2л',
 qty: '2000',
 price: '3000',
 code: '45',
 taxMark: '1' } ],
 checkNumber: '111114093',
 totalCheckSum: '6000',
 operatorID: '1',
 fixalNumPPO: '3000101755',
 checkDate: '20170413094128',
 AddTaxName: 'АКЦИЗ 5 ВІДС.',
 AddTaxRate: '6.00',
 AddTaxSum: '286',
 taxMark: '1',
 taxRate: '20.00',
 taxSum: '952',
 isTaxIncluded: '0',
 buyerPaymentSum: '6000',
 paymentName: 'ГОТІВКА',
 paymentType: '0' }
 product.taxMark= 1*/

















