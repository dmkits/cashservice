var fs = require('fs'),
    sql = require('mssql'),
    moment = require('moment');
var server = require('./server'), log=server.log;

var dbConnectError=null, conn=null;

module.exports.dbConnect=function(callback){
    var sysConfig=server.getSysConfig();
    if(conn)conn.close();
    if(!sysConfig){
        callback(null,"Failed connect to database! Reason: no system config!");
        return;
    }
    dbConnectError=null;
    conn = new sql.Connection({server:sysConfig.dbHost,port:sysConfig.dbPort,database:sysConfig.dbName,user:sysConfig.dbUser,password:sysConfig.dbUserPass});
    conn.connect(function(err){
        dbConnectError=err;
        if(err){
            log.error('database.dbConnect dbConnectError=', dbConnectError);
            if(callback)callback(err.message);
            return;
        }
        if(callback)callback(null,"connected");
    });
};
module.exports.getDBConnectErr= function(){ return dbConnectError; };
module.exports.getAllCashBoxes= function(callback) {
    var reqSql = new sql.Request(conn);
    var sQuery='SELECT * FROM r_Crs WHERE CashType=30 ';
    reqSql.query(sQuery, function(err,recordset){
        if(err){ callback(err); return; }
        if(recordset.length<1){
            callback("Не удалось найти кассовый аппарт в БД");
            return;
        }
        callback(null,recordset);
    });
};
module.exports.getCRListXMLForUniCashServerRequest = function(bdate, edate, cashBoxesID, callback){
    var reqSql = new sql.Request(conn);
    var query_str = fs.readFileSync('./scripts/getCRListXMLforUNICashserver.sql', 'utf8');
    reqSql.input('BDATE', sql.NVarChar, bdate);
    reqSql.input('EDATE', sql.NVarChar, edate);
    reqSql.input('CRIDLIST', sql.NVarChar, ","+cashBoxesID+",");
    reqSql.query(query_str, function(err,recordset){
        if(err){
            callback(err);
        }else{
            callback(null,recordset);
        }
    })
};
function isPaymentExist(CHID, callback){
    var reqSql = new sql.Request(conn);
    reqSql.input('CHID', sql.NVarChar, CHID);
    reqSql.query("select ChID from t_SalePays WHERE ChID=@CHID", function(err,recordset){
        var outData={};
        if(err){
            callback(err);
            return;
        }
        if(recordset[0]){
            outData.exist=true;
            callback(null, outData);
            return;
        }
        callback(null, "not exist");
    })
}

function addToSalePays (CHID,cheque,callback){
    try {
        var buyerPaymentSumFormatted = cheque.buyerPaymentSum/100;
        var PayFormCode = detectPaymentForm(cheque.paymentType);
        var reqSql = new sql.Request(conn);
        var query_str = fs.readFileSync('./scripts/add_to_salePays.sql', 'utf8');
        reqSql.input('CHID', sql.NVarChar, CHID);
        reqSql.input('PayFormCode', sql.NVarChar, PayFormCode);
        reqSql.input('SumCC_wt', sql.NVarChar, buyerPaymentSumFormatted);
    }catch(e){
        callback(e);
        return;
    }
    reqSql.query(query_str, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        if(cheque.change){
            var changeFormatted = cheque.change/100;
            var reqSql = new sql.Request(conn);
            var query_str = fs.readFileSync('./scripts/add_to_salePays.sql', 'utf8');
            reqSql.input('CHID', sql.NVarChar, CHID);
            reqSql.input('PayFormCode', sql.NVarChar, PayFormCode);
            reqSql.input('SumCC_wt', sql.NVarChar, '-'+changeFormatted);
            reqSql.query(query_str, function(err,recordset){
                if(err){
                    callback(err);
                    return;
                }
                callback(null,CHID);
            });
            return
        }
        callback(null,CHID);
    })
}

function deletePayment(ChID, callback){
    var reqSql = new sql.Request(conn);
    reqSql.input('CHID', sql.NVarChar, ChID);
    reqSql.query("DELETE from t_SalePays WHERE ChID=@CHID", function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        callback(null, "deleted");
    })
}

module.exports.fillToSalePays = function (CHID, cheque, callback){
    isPaymentExist(CHID, function (err, res) {
        var outData={};
        if(err){
            callback(err);
            return;
        }
        if(res.exist){
            outData.exist=true;
            deletePayment(CHID, function(err,res){
                if(err){
                    callback(err);
                    return;
                }
                addToSalePays(CHID, cheque, function (err,res){
                    if(err){
                        callback(err);
                        return;
                    }
                    callback(null,outData);
                })
            });
            return;
        }
        addToSalePays(CHID, cheque, function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,outData);
        })
    })
};

module.exports.updateSaleStatus= function(CHID, callback){
    var reqSql = new sql.Request(conn);
    var query_str = fs.readFileSync('./scripts/update_sale_status.sql', 'utf8');
    reqSql.input('CHID', sql.NVarChar, CHID);
    reqSql.query(query_str, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        callback(null, "updated");
    })
};

function isSaleExists(chequeData,callback){
    try {
        var DocID = chequeData.checkNumber;
        var FacID = chequeData.cashBoxFabricNum;
        var FacIDNum = FacID.replace("ПБ", "");
        var date = formatDate(chequeData.checkDate);
        var DocDate = date.substring(0, 10) + " 00:00:00";
        var reqSql = new sql.Request(conn);
    } catch (e) {
        callback(e);
        return;
    }
    reqSql.input('FacID', sql.NVarChar, FacIDNum);
    reqSql.input('DocID', sql.Int, DocID);
    reqSql.input('DocDate', sql.NVarChar, DocDate);
    var queryString = fs.readFileSync('./scripts/is_sale_exists.sql', 'utf8');
    reqSql.query(queryString, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        if(!recordset||recordset.length==0){
            callback(null,"notExist");
            return
        }
        callback(null, {ChID:recordset[0].ChID,exist:true});
    })
}

function addToSale(data, callback){
    try {
        var FacID = data.cashBoxFabricNum;
        var FacIDNum = FacID.replace("ПБ", "");
        var date = formatDate(data.checkDate);
        var reqSql = new sql.Request(conn);
    } catch (e) {
        callback(e);
        return;
    }
    var DocDate = date.substring(0, 10) + " 00:00:00";
    reqSql.input('DocID', sql.NVarChar, data.checkNumber);
    reqSql.input('DocDate', sql.NVarChar, DocDate);
    reqSql.input('CROperID', sql.NVarChar, data.operatorID);
    reqSql.input('DocTime', sql.NVarChar, date);
    reqSql.input('CashSumCC', sql.NVarChar, data.buyerPaymentSum / 100);
    reqSql.input('FacID', sql.NVarChar, FacIDNum);
    reqSql.input('DocCreateTime', sql.NVarChar, date);

    reqSql.input('KursMC', sql.NVarChar, 1.0);
    reqSql.input('CompID', sql.NVarChar, 1);
    reqSql.input('CodeID1', sql.NVarChar, 0);
    reqSql.input('CodeID2', sql.NVarChar, 0);
    reqSql.input('CodeID3', sql.NVarChar, 0);
    reqSql.input('CodeID4', sql.NVarChar, 0);
    reqSql.input('CodeID5', sql.NVarChar, 0);
    reqSql.input('Discount', sql.NVarChar, 1.0);
    reqSql.input('Notes', sql.NVarChar, null);
    reqSql.input('CreditID', sql.NVarChar, null);
    //reqSql.input('DCardID', sql.NVarChar, "'<Нет дисконтной карты>'");  -- data in script
    reqSql.input('CurrID', sql.NVarChar, 980);
    reqSql.input('TSumCC_nt', sql.NVarChar, 0);
    reqSql.input('TTaxSum', sql.NVarChar, 0);
    reqSql.input('TSumCC_wt', sql.NVarChar, 0);
    reqSql.input('StateCode', sql.NVarChar, 0);
    reqSql.input('DeskCode', sql.NVarChar, 0);
    reqSql.input('Visitors', sql.NVarChar, 0);
    reqSql.input('TPurSumCC_nt', sql.NVarChar, 0);
    reqSql.input('TPurTaxSum', sql.NVarChar, 0);
    reqSql.input('TPurSumCC_wt', sql.NVarChar, 0);
    reqSql.input('TRealSum', sql.NVarChar, 0);
    reqSql.input('TLevySum', sql.NVarChar, 0);

    if(data.change) reqSql.input('ChangeSumCC', sql.NVarChar, '-' + data.change / 100);
    else reqSql.input('ChangeSumCC', sql.NVarChar, 0);

    var isOperatorExistsStr = fs.readFileSync('./scripts/isOperIDExists.sql', 'utf8');
    reqSql.query(isOperatorExistsStr, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        if(recordset.length<1){
            callback("Не удалось найти оператора для кода '" + data.operatorID+"' полученного от кассового аппарата");
            return;
        }
        reqSql.input('OperID', sql.NVarChar, recordset[0].OperID);
        var queryString = fs.readFileSync('./scripts/add_to_sale.sql', 'utf8');
        reqSql.query(queryString, function(err,recordset){
            if(err){
                callback(err, null);
                return;
            }
            callback(null, {ChID:recordset[0].ChID,created:true});
        });
    });
}

module.exports.fillChequeTitle = function(chequeData, callback){
    isSaleExists(chequeData, function(err,res){
        if(err){
            callback(err);
            return;
        }
        if(res.exist){
            callback(null, res);
            return;
        }
        addToSale(chequeData, function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res);
        })
    });
};

function isPosExists(tablename,ChID, posNum, callback){
    var reqSql = new sql.Request(conn);
    reqSql.input('ChID', sql.NVarChar, ChID);
    reqSql.input('SrcPosID', sql.NVarChar, posNum);
    var queryString = fs.readFileSync('./scripts/is_position_exists_in_'+tablename+'.sql', 'utf8');
    reqSql.query(queryString, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        if(!recordset||recordset.length==0){
            callback(null,"notExist");
            return;
        }
        var firsFindedRow=recordset[0],
            outData={ChID:firsFindedRow.ChID, SrcPosID:firsFindedRow.SrcPosID, exist:true};
        callback(null, outData);
    })
}

function addToSaleD(ChID, chequeData, chequeProdData, callback){
    try {
        var date = formatDate(chequeData.checkDate),
            Qty = chequeProdData.qty/1000,
            FacID = chequeData.cashBoxFabricNum, FacIDNum = FacID.replace("ПБ", ""),
            posSum=chequeProdData.posSum/100;;
        var ProdTaxTypeID =chequeProdData.taxMark==1 ? 1 : 0,
            excisePosSum, TaxSum;
        if(chequeData.AddTaxSum && chequeData.AddTaxSum>0 && ProdTaxTypeID==1){
            excisePosSum = parseFloat((posSum*5/105).toFixed(2));                          //расчет акциза
            TaxSum= parseFloat((posSum*100/630).toFixed(2));                               //расчет НДС от суммы с акцизо
        }else{
            TaxSum=posSum/6;
            excisePosSum=0.00;
        }
        var Tax = TaxSum/Qty,
            SumCC_wt = posSum-excisePosSum, PriceCC_wt = SumCC_wt/Qty,
            SumCC_nt=posSum-excisePosSum-TaxSum, PriceCC_nt=SumCC_nt/Qty;
        var reqSql = new sql.Request(conn);
        reqSql.input('ChID', sql.NVarChar, ChID); reqSql.input('SrcPosID', sql.NVarChar, chequeProdData.posNumber);
        reqSql.input('Barcode', sql.NVarChar, chequeProdData.barcode);
        reqSql.input('Qty', sql.NVarChar, Qty);
        reqSql.input('PriceCC_nt', sql.NVarChar, PriceCC_nt); reqSql.input('SumCC_nt', sql.NVarChar, SumCC_nt);
        reqSql.input('Tax', sql.NVarChar, Tax); reqSql.input('TaxSum', sql.NVarChar, TaxSum);
        reqSql.input('PriceCC_wt', sql.NVarChar, PriceCC_wt); reqSql.input('SumCC_wt', sql.NVarChar, SumCC_wt);
        reqSql.input('PurPriceCC_nt', sql.NVarChar, PriceCC_nt);
        reqSql.input('PurTax', sql.NVarChar, Tax);
        reqSql.input('PurPriceCC_wt', sql.NVarChar, PriceCC_wt);
        reqSql.input('RealPrice', sql.NVarChar, posSum/Qty); reqSql.input('RealSum', sql.NVarChar, posSum);
        reqSql.input('CreateTime', sql.NVarChar, date); reqSql.input('ModifyTime', sql.NVarChar, date);
        reqSql.input('FacID', sql.NVarChar,FacIDNum); reqSql.input('CROperID', sql.NVarChar, chequeData.operatorID);
        reqSql.input('PPID', sql.NVarChar, 0);
        reqSql.input('SecID', sql.NVarChar, 1);
        reqSql.input('PLID', 0);
        reqSql.input('Discount', 0.0);
        reqSql.input('TaxTypeID', ProdTaxTypeID);
        reqSql.input('IsFiscal', 1);
    }catch(e){
        callback(e); return;
    }
    reqSql.query('select p.ProdID '+
                 'from r_Prods p '+
                 'inner join r_ProdMQ mq on mq.ProdID=p.ProdID '+
                 'where mq.BarCode=BarCode',
        function(err,recordset){
            if (err) {
                callback(err, null);
                return;
            }
            if(!recordset||recordset.length==0) {
                callback("Не удалось внести позицию! Наименование " + chequeProdData.name + " не найдено в базе по штрихкоду.");
                return;
            }
            var queryString = fs.readFileSync('./scripts/add_to_saleD_byBarcode.sql', 'utf8');
            reqSql.query(queryString, function(err){
                if(err){
                    callback(err, null);
                    return;
                }
                if(chequeData.AddTaxSum && chequeData.AddTaxSum>0 && ProdTaxTypeID==1){
                    var LevySum=excisePosSum;
                    reqSql.input('LevySum', sql.NVarChar, LevySum);
                    reqSql.input('LevyID', sql.NVarChar, 1);
                    reqSql.query('INSERT INTO t_SaleDLV (ChID, SrcPosID, LevyID, LevySum) ' +
                        'VALUES (@ChID,	@SrcPosID, @LevyID, @LevySum)', function(err){
                        if(err){
                            callback(err, null);
                            return;
                        }
                        callback(null, {ChID:ChID,addedSaleD:"Позиция записана в БД"});
                    });
                    return;
                }
                callback(null, {ChID:ChID,addedSaleD:"Позиция записана в БД"});
            });
        });
}

function addToSaleC(ChID, chequeData, chequeProdData, callback){
    try {
        var date = formatDate(chequeData.checkDate);
        var Qty = chequeProdData.qty/1000;
        var FacID = chequeData.cashBoxFabricNum;
        var FacIDNum = FacID.replace("ПБ", "");
        // var PriceCC_nt = chequeProdData.price / 1.2/100;
        // var SumCC_nt = PriceCC_nt * Qty;
        // var Tax = chequeProdData.price/100 - PriceCC_nt;
        // var TaxSum = Tax * Qty;

        var PriceCC_nt = 0, SumCC_nt = 0, Tax = 0, TaxSum = 0;
        var reqSql = new sql.Request(conn);
        reqSql.input('ChID', sql.NVarChar, ChID);
        reqSql.input('SrcPosID', sql.NVarChar, chequeProdData.posNumber);
        reqSql.input('Article2', sql.NVarChar, chequeProdData.name);
        reqSql.input('Qty', sql.NVarChar, Qty*-1);
        reqSql.input('PriceCC_nt', sql.NVarChar, PriceCC_nt);
        reqSql.input('SumCC_nt', sql.NVarChar, SumCC_nt*-1);
        reqSql.input('Tax', sql.NVarChar, Tax);
        reqSql.input('TaxSum', sql.NVarChar, TaxSum*-1);
        reqSql.input('PriceCC_wt', sql.NVarChar, chequeProdData.price/100);
        reqSql.input('SumCC_wt', sql.NVarChar, chequeProdData.price/100 * Qty*-1);
        // reqSql.input('PurPriceCC_nt', sql.NVarChar, PriceCC_nt);
        // reqSql.input('PurTax', sql.NVarChar, Tax);
        // reqSql.input('PurPriceCC_wt', sql.NVarChar, chequeProdData.price/100);
        reqSql.input('CreateTime', sql.NVarChar, date);
        reqSql.input('ModifyTime', sql.NVarChar, date);
        //reqSql.input('RealPrice', sql.NVarChar, chequeProdData.price/100);
        // reqSql.input('RealSum', sql.NVarChar, chequeProdData.price/100 * Qty);
        reqSql.input('FacID', sql.NVarChar,FacIDNum);
        reqSql.input('CROperID', sql.NVarChar, chequeData.operatorID);
    }catch(e){
        callback(e);
        return;
    }
    reqSql.query('select ProdID from r_Prods where Article2=@Article2', function(err,recordset){
        if(err){
            callback(err, null);
            return;
        }
        if(!recordset||recordset.length==0){
            callback("Не удалось внести позицию! Наименование " + chequeProdData.name + " не найдено в базе");
            return;
        }
        var queryString = fs.readFileSync('./scripts/add_to_saleС.sql', 'utf8');
        reqSql.query(queryString, function(err){
            if(err){
                callback(err, null);
                return;
            }
            callback(null, {ChID:ChID,addedSaleC:"Аннулированная позиция записана в БД"});
        });
    });
}

module.exports.fillChequeProds = function(saleChID,chequeData, chequeProdData, callback){
    var posNum = chequeProdData.posNumber;
    if(chequeProdData.canceled){
        isPosExists('SaleC', saleChID, posNum, function(err,res){
            if(err){
                callback(err);
                return;
            }
            if(res.exist){
                res.exist="SaleC";
                callback(null, res);
                return;
            }
            addToSaleC(saleChID, chequeData, chequeProdData, function(err,res){
                if(err){
                    callback(err);
                    return;
                }
                callback(null, res);
            });
        });
        return;
    }
    isPosExists('SaleD', saleChID, posNum, function(err,res){
        if(err){
            callback(err);
            return;
        }
        if(res.exist){
            res.exist="SaleD";
            callback(null,res);
            return;
        }
        addToSaleD(saleChID,chequeData, chequeProdData, function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res);
        })
    });
};

module.exports.logToDB = function(Note,Msg,FacID, callback){
    var reqSql = new sql.Request(conn);
    var CRID;
    if(!Msg)Msg="";
    if(Note.length>250) Note=Note.substring(0,248)+"...";
    if(Msg.length>2000) Msg=Msg.substring(0,1998)+"...";
    if(!FacID){
        CRID=0;
        reqSql.input('Notes', sql.NVarChar, Note);
        reqSql.input('CRID', sql.NVarChar, CRID);
        reqSql.input('Msg', sql.NVarChar, Msg);
        var queryString = fs.readFileSync('./scripts/add_log_to_DB.sql', 'utf8');
        reqSql.query(queryString, function(err,recordset){
            if(err){
                callback(err.message);
                return;
            }
            callback(null,"ок");
        });
        return;
    }
    var FacIDFormatted=FacID.replace("ПБ","");
    reqSql.input('Notes', sql.NVarChar, Note);
    reqSql.input('FacID', sql.NVarChar, FacIDFormatted);
    reqSql.query('select  CRID from r_Crs WHERE FacID=@FacID;', function(err,recordset){
        if(err){
            callback(err.message);
            return;
        }
        if(!(recordset&&recordset[0])){
            callback("Не удалось определить ID кассового аппарата");
            return;
        }
        CRID=recordset[0].CRID;
        reqSql.input('Notes', sql.NVarChar, Note);
        reqSql.input('CRID', sql.NVarChar, CRID);
        reqSql.input('Msg', sql.NVarChar, Msg);
        var queryString = fs.readFileSync('./scripts/add_log_to_DB.sql', 'utf8');
        reqSql.query(queryString, function(err,recordset){
            if(err){
                callback(err.message);
                return;
            }
            callback(null,"ок");
        })
    })
};

module.exports.addToMonIntRec = function(innerDoc, callback){
    var FacID=innerDoc.cashBoxFabricNum.replace("ПБ","");
    var DocTime = formatDate(innerDoc.docDate);
    var DocDate = DocTime.substring(0,10)+" 00:00:00";
    var SumCC=innerDoc.paymentSum/100;
    var CROperID=innerDoc.operatorID?innerDoc.operatorID:0;   // if no operatorID, operatorID=0;
    var reqSql = new sql.Request(conn);

    reqSql.input('FacID', sql.NVarChar, FacID);
    reqSql.input('DocDate', sql.NVarChar, DocDate);
    reqSql.input('DocTime', sql.NVarChar, DocTime);
    reqSql.input('SumCC', sql.NVarChar, SumCC);
    reqSql.input('CROperID', sql.NVarChar, CROperID);

    var isRecExistsStr = fs.readFileSync('./scripts/is_monIntRec_exists.sql', 'utf8');
    reqSql.query(isRecExistsStr, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        var outData={};
        if(recordset[0]){
            outData.exists=true;
            callback(null,outData);
            return
        }
        var query_str = fs.readFileSync('./scripts/add_to_monIntRec.sql', 'utf8');
        reqSql.query(query_str, function(err,recordset){
            if(err){
                callback(err);
                return;
            }
            callback(null, "done");
        })
    })
};

module.exports.addToMonIntExp = function(innerDoc, callback) {
    var FacID=innerDoc.cashBoxFabricNum.replace("ПБ","");
    var DocTime = formatDate(innerDoc.docDate);
    var DocDate = DocTime.substring(0,10)+" 00:00:00";
    var SumCC=innerDoc.paymentSum/100;
    var CROperID=innerDoc.operatorID;   // if no operatorID, operatorID=0;

    var reqSql = new sql.Request(conn);
    reqSql.input('FacID', sql.NVarChar, FacID);
    reqSql.input('DocTime', sql.NVarChar, DocTime);
    reqSql.input('DocDate', sql.NVarChar, DocDate);
    reqSql.input('SumCC', sql.NVarChar, SumCC);
    reqSql.input('CROperID', sql.NVarChar, CROperID);

    var isExpExistsStr = fs.readFileSync('./scripts/is_monIntExp_exists.sql', 'utf8');
    reqSql.query(isExpExistsStr, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        var outData={};
        if(recordset[0]){
            outData.exists=true;
            callback(null,outData);
            return
        }
        var query_str = fs.readFileSync('./scripts/add_to_monIntExp.sql', 'utf8');
        reqSql.query(query_str, function(err,recordset){
            if(err){
                callback(err);
                return;
            }
            callback(null, "done");
        })
    })
};

module.exports.addToZrep = function(rep, callback) {
    var FacID=rep.cashBoxFabricNum.replace("ПБ","");
    var DocTime = formatDate(rep.dataFormDate);
    var DocDate = DocTime.substring(0,10)+" 00:00:00";
    var SumCard=rep.totalCardPaymentIncomeSum?rep.totalCardPaymentIncomeSum:0;

    //var SumCC=innerDoc.paymentSum/100;
    //var OperID=innerDoc.operatorID?innerDoc.operatorID:0;   // if no operatorID, operatorID=0;

    var query_str = fs.readFileSync('./scripts/add_to_zrep.sql', 'utf8');
    var reqSql = new sql.Request(conn);
    reqSql.input('FacID', sql.NVarChar, FacID);
    reqSql.input('DocDate', sql.NVarChar, DocDate);
    reqSql.input('DocTime', sql.NVarChar, DocTime);
    reqSql.input('FinID', sql.NVarChar, rep.FinID);
    reqSql.input('ZRepNum', sql.NVarChar, rep.reportNum);
    reqSql.input('SumMonRec', sql.NVarChar, rep.totalMoneyRec?rep.totalMoneyRec/100:0);
    reqSql.input('SumMonExp', sql.NVarChar, rep.totalMoneyExp?rep.totalMoneyExp/100:0);
    reqSql.input('SumCash', sql.NVarChar, rep.totalCashPaymentIncomeSum?rep.totalCashPaymentIncomeSum:0);
    reqSql.input('SumCard', sql.NVarChar, SumCard);
    reqSql.input('SumCC_wt', sql.NVarChar, rep.SumCC_wt?rep.SumCC_wt:0);

    reqSql.input('Sum_A', sql.NVarChar, rep.TaxATotalIncomeSum ? rep.TaxATotalIncomeSum:0);
    reqSql.input('Sum_B', sql.NVarChar, rep.TaxBTotalIncomeSum ? rep.TaxBTotalIncomeSum:0);
    reqSql.input('Sum_C', sql.NVarChar, rep.TaxCTotalIncomeSum ? rep.TaxCTotalIncomeSum:0);
    reqSql.input('Sum_D', sql.NVarChar, rep.TaxDTotalIncomeSum ? rep.TaxDTotalIncomeSum:0);
    reqSql.input('Sum_E', sql.NVarChar, rep.TaxETotalIncomeSum ? rep.TaxETotalIncomeSum:0);

    reqSql.input('Tax_A', sql.NVarChar, rep.TaxATotalTaxSum ? rep.TaxATotalTaxSum:0);
    reqSql.input('Tax_B', sql.NVarChar, rep.TaxBTotalTaxSum ? rep.TaxBTotalTaxSum:0);
    reqSql.input('Tax_C', sql.NVarChar, rep.TaxCTotalTaxSum ? rep.TaxCTotalTaxSum:0);
    reqSql.input('Tax_D', sql.NVarChar, rep.TaxDTotalTaxSum ? rep.TaxDTotalTaxSum:0);
    reqSql.input('Tax_E', sql.NVarChar, rep.TaxETotalTaxSum ? rep.TaxETotalTaxSum:0);
    reqSql.input('Tax_F', sql.NVarChar, rep.Tax_FSum ? rep.Tax_FSum:0);

    var isRepExistStr=fs.readFileSync('./scripts/is_rep_exists.sql', 'utf8');
    reqSql.query(isRepExistStr, function(err,recordset){
        if(err){
            callback(err);
            return;
        }
        var outData={};
        if(recordset[0]){
            outData.exists=true;
            callback(null,outData);
            return
        }
        var getOperIdStr=fs.readFileSync('./scripts/get_operid.sql', 'utf8');
        reqSql.query(getOperIdStr, function(err,recordset){
            if(err){
                callback(err);
                return;
            }
            if(recordset.length<1){
                callback("Не удалось определить оператора (администратора ЭККА) для Z-Отчета № "+rep.reportNum+"! Отчет не сохранен!");
                return;
            }
            var OperID = recordset[0].OperID;
            reqSql.input('OperID', sql.NVarChar, OperID);
            reqSql.query(query_str, function(err,recordset){
                if(err){
                    callback(err);
                    return;
                }
                callback(null, "done");
            });
        });
    })
};

function formatDate(date){
    var dch = date.split("");
    var newDateFormat = dch[0] + dch[1] + dch[2] + dch[3] + "-" + dch[4] + dch[5] + "-" + dch[6] + dch[7] + " " + dch[8] + dch[9] + ":" + dch[10] + dch[11] + ":" + dch[12] + dch[13];
    return newDateFormat;
}

function detectPaymentForm(PaymentForm){
    return  PaymentForm == '0' ? 1 : 2;
}

module.exports.getLogs = function(bdate,edate, crId, callback) {
    var reqStr;
    var reqSql = new sql.Request(conn);
    if(crId==-1){
        reqStr="select log.LogID, cr.FacID AS CashBoxID, CONVERT(NVarChar,log.DocTime,104) AS DocDate, CONVERT(NVarChar,log.DocTime,104)+' '+ CONVERT(NVarChar,log.DocTime,108) AS DocTime, log.Msg, log.Notes "+
            "FROM z_LogCashReg log "+
            "INNER JOIN r_CRs cr on cr.CRID=log.CRID "+
            "WHERE DocTime BETWEEN @BDATE AND @EDATE order by LogID";
    }else{
        reqSql.input("CRID", sql.NVarChar,crId);
        reqStr="select log.LogID, cr.FacID AS CashBoxID, CONVERT(NVarChar,log.DocTime,104) AS DocDate, CONVERT(NVarChar,log.DocTime,104)+' '+ CONVERT(NVarChar,log.DocTime,108) AS DocTime, log.Msg, log.Notes "+
            "FROM z_LogCashReg log "+
            "INNER JOIN r_CRs cr on cr.CRID=log.CRID "+
            "WHERE DocTime BETWEEN @BDATE AND @EDATE "+
            "AND cr.CRID = @CRID order by LogID";
    }
    reqSql.input("BDATE", sql.NVarChar,bdate);
    reqSql.input("EDATE", sql.NVarChar,edate);
    reqSql.query(reqStr, function(error,recordset){
        if (error){
            callback(error);
            return;
        }
        callback(null,recordset);
    });
};

module.exports.getSales = function(bdate,edate, crId, callback){
    var reqStr=fs.readFileSync('./scripts/getSalesByCRIDsList.sql', 'utf8');
    var reqSql = new sql.Request(conn);
    reqSql.input("BDATE", sql.NVarChar,bdate);
    reqSql.input("EDATE", sql.NVarChar,edate);
    reqSql.input("CRID", sql.NVarChar,crId);
    reqSql.query(reqStr, function (error,recordset){
        if(error){
            callback(error);
            return;
        }
        callback(null,recordset);
    });
};

module.exports.getProdsPricesXML = function(crId, callback){
    var reqStr=fs.readFileSync('./scripts/getProdsPricesXML.sql', 'utf8');
    var reqSql = new sql.Request(conn);
    var CRIDLIST=','+crId+',';
    var CurrentDateTime=moment(new Date()).format("YYYYMMDDHHmmss");
    reqSql.input("CRIDLIST", sql.NVarChar,CRIDLIST);
    reqSql.input("CurrentDateTime", sql.NVarChar,CurrentDateTime);
    reqSql.query(reqStr, function(error,recordset){
        if(error){
            callback(error);
            return;
        }
        callback(null,recordset);
    });
};

module.exports.getProdsPricesByCRID = function(crId, callback){
    var reqStr=fs.readFileSync('./scripts/getProdsPricesByCRIDsList.sql', 'utf8');
    var reqSql = new sql.Request(conn);
    var CRIDLIST=','+crId+',';
    // reqSql.input("CRID", sql.NVarChar,crId);
    reqSql.input("CRIDLIST", sql.NVarChar,CRIDLIST);
    reqSql.query(reqStr,function (error,recordset){
        if(error){
            callback(error);
            return;
        }
        callback(null,recordset);
    });
};


