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

    var date=formatDate(data.checkDate);
    var reqSql = new sql.Request(conn);

    var queryString = fs.readFileSync('./scripts/add_to_sale.sql', 'utf8');
    reqSql.input('DocID', sql.NVarChar, data.checkNumber);
    reqSql.input('DocDate', sql.NVarChar, date);
    reqSql.input('OperID', sql.NVarChar, data.operatorID);
    reqSql.input('DocTime', sql.NVarChar, date);
    reqSql.input('CashSumCC', sql.NVarChar, data.buyerPaymentSum);
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


module.exports.addToSaleD=function(ChID, data, callback){           // console.log("data 146 =", data);

  //  var i=0;
    var date=formatDate(data.checkDate);
    var productsInCheck=data.productsInCheck;


    var queryString = fs.readFileSync('./scripts/add_to_saleD.sql', 'utf8');
function insertToSaleD(productsInCheck,i){
    //for (var i in productsInCheck) {
        if(i>=productsInCheck.length) return;
        var reqSql = new sql.Request(conn);
        var PriceCC_nt = productsInCheck[i].price/1.2;
        var Qty = productsInCheck[i].qty;
        var SumCC_nt = PriceCC_nt * Qty;
        var Tax = productsInCheck[i].price - PriceCC_nt;
        var TaxSum = Tax*Qty;
        reqSql.input('ChID', sql.NVarChar, ChID);
        reqSql.input('SrcPosID', sql.NVarChar, productsInCheck[i].posNumber);
        reqSql.input('Article2', sql.NVarChar, productsInCheck[i].name);
        reqSql.input('Qty', sql.NVarChar, Qty);
        reqSql.input('PriceCC_nt', sql.NVarChar, PriceCC_nt);
        reqSql.input('SumCC_nt', sql.NVarChar, SumCC_nt);
        reqSql.input('Tax', sql.NVarChar, Tax);
        reqSql.input('TaxSum', sql.NVarChar, TaxSum);
        reqSql.input('PriceCC_wt', sql.NVarChar, productsInCheck[i].price);
        reqSql.input('SumCC_wt', sql.NVarChar, productsInCheck[i].price*Qty);
        reqSql.input('PurPriceCC_nt', sql.NVarChar, PriceCC_nt);
        reqSql.input('PurTax', sql.NVarChar, Tax);
        reqSql.input('PurPriceCC_wt', sql.NVarChar, productsInCheck[i].price);
        reqSql.input('CreateTime', sql.NVarChar, date);
        reqSql.input('ModifyTime', sql.NVarChar, date);
       // reqSql.input('TaxTypeID', sql.NVarChar, productsInCheck[i].taxMark);
        reqSql.input('RealPrice', sql.NVarChar, productsInCheck[i].price);
        reqSql.input('RealSum', sql.NVarChar, productsInCheck[i].price*Qty);
        reqSql.input('OperID', sql.NVarChar, data.operatorID);


        reqSql.query(queryString,
            function (err,recordset) {                                     console.log("addToSaleD err=", err);
                if (err) {
                    callback(err, null);
                }
                 insertToSaleD(productsInCheck,i+1);
               // callback(null, recordset[0].ChID);                          console.log("recordset[0].ChID", recordset[0].ChID);
            });
    }
    insertToSaleD(productsInCheck,0);
};

function formatDate(date){
    var dch = date.split("");
    var newDateFormat = dch[0] + dch[1] + dch[2] + dch[3] + "-" + dch[4] + dch[5] + "-" + dch[6] + dch[7] + " " + dch[8] + dch[9] + ":" + dch[10] + dch[11] + ":" + dch[12] + dch[13];
    return newDateFormat;
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

















