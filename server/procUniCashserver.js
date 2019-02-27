var Buffer = require('buffer').Buffer, request = require('request');

module.exports.postProductsToUniCashServer= function (params, xmlData, callback){
    var cashserverUrl = params.cashserverUrl,
        cashserverPort = params.cashserverPort,
        xmlText = "", nullLineCounter=0;
    for(var i in xmlData){
        var xmlLine = xmlData[i].XMLText, noProdName = xmlData[i].noProdName;
        if(xmlLine==null || noProdName==true) nullLineCounter=nullLineCounter+1;
        xmlText = xmlText + xmlLine + "\n";
    }
    if(nullLineCounter>0){
        callback({nullLineCounter:nullLineCounter},xmlText);
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
        callback({message:error.message}, xmlText, response, body);
    });
};
