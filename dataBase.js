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

module.exports.isSaleExists= function (DocID,FacID,callback) {
    var reqSql = new sql.Request(conn);
    reqSql.input('DocID',sql.Int, DocID);
    reqSql.input('FacID',sql.NVarChar, FacID);

    var queryString =  fs.readFileSync('./scripts/check_t_sale_exists.sql', 'utf8');

    reqSql.query(queryString,
        function (err,recordset) {
            if (err) {
                callback(err, null);
            }
            else {
                var outData={};
                if(recordset.length==0){
                    outData.empty=true;
                } else outData.recordset=recordset;
                callback(null, outData);
            }
        });
};



module.exports.addToT_Sale= function(data, callback){
    var reqSql = new sql.Request(conn);
    var queryString =  fs.readFileSync('./scripts/create_t_sale.sql', 'utf8');
    reqSql.query(queryString,
        function (err,result) {
            if (err) {
                callback(err, null);
            }
                callback(null, "ok");
        });
};

