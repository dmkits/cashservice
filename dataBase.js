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
    dbConfigFilePath='./' + app.startupMode() + '.cfg';
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
    (function(data) {
    var reqSql = new sql.Request(conn);
    reqSql.input('DocID', sql.Int, data.checkNumber);                                              console.log("data.checkNumber 88=", data.checkNumber);
    // reqSql.input('FacID',sql.NVarChar, data.cashBoxFabricNum);

    var queryString = fs.readFileSync('./scripts/check_t_sale_exists.sql', 'utf8');

   // var fun = function (data) {                                                                           console.log("data.checkNumber 92=", data.checkNumber);
        reqSql.query(queryString,
            function (err, recordset) {                                                           console.log("data.checkNumber 95=", data.checkNumber);
                    if (err) {
                        callback(err, null);
                        return;
                    }
                var outData = {};
                outData.data = data;                                                        console.log("outData.checkNumber 101=", outData.data.checkNumber);
                if (recordset.length == 0) {
                    outData.empty = true;
                } else outData.recordset = recordset;
                callback(null, outData);
            });
    })(data);
  //  fun(data);
};
/*(ChID,  DocID, DocDate, KursMC,  OurID,
    StockID,    CompID,	CodeID1,	CodeID2,	CodeID3,
    CodeID4, CodeID5,	Discount,	Notes,	CRID,
    OperID,	CreditID,	DocTime,	DCardID,	EmpID,
    IntDocID, CashSumCC,	ChangeSumCC,	CurrID,	TSumCC_nt,
    TTaxSum,	TSumCC_wt,	StateCode,	DeskCode,	Visitors,
    TPurSumCC_nt, TPurTaxSum,	TPurSumCC_wt,	DocCreateTime,	TRealSum,
    TLevySum)*/


module.exports.addToT_Sale= function(data, callback){                           //  console.log("data 116=",data);

    var dch= data.checkDate.split("");
    var date = dch[0]+ dch[1]+dch[2]+dch[3]+"-"+dch[4]+dch[5]+"-"+dch[6]+dch[7]+" "+dch[8]+dch[9]+":"+dch[10]+dch[11]+":"+dch[12]+dch[13];
                                                                                                                        //console.log("date=",date);
    var reqSql = new sql.Request(conn);
    var queryString =  fs.readFileSync('./scripts/create_t_sale2.sql', 'utf8');
    reqSql.input('DocID',sql.NVarChar, data.checkNumber);
    reqSql.input('DocDate',sql.NVarChar, date);
    reqSql.input('OperID',sql.NVarChar, data.operatorID);
    reqSql.input('DocTime',sql.NVarChar, date);
    reqSql.input('CashSumCC',sql.NVarChar, data.buyerPaymentSum);
    reqSql.input('DocCreateTime',sql.NVarChar, date);
    if(data.change) reqSql.input('ChangeSumCC',sql.NVarChar, data.change);
    else reqSql.input('ChangeSumCC',sql.NVarChar, 0);
    reqSql.input('TTaxSum',sql.NVarChar, data.AddTaxSum + data.taxSum);
    reqSql.input('TSumCC_wt',sql.NVarChar, data.totalCheckSum);

    reqSql.query(queryString,
        function (err,result) {
            if (err) {
                callback(err, null);
            }
                callback(null, "ok");
        });
};















