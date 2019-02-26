/**
 * Created by dmkits on 30.12.16.
 */
define(["dojo/request", "app/base","app/dialogs"],
    function(request, base, dialogs) {
        return {
            jsonHeader: {"X-Requested-With":"application/json; charset=utf-8",
                'Content-Type': 'application/x-www-form-urlencoded'},
            /** getUlrWithParams
             * params = "<url>" OR { url, conditions }
             * conditions = "<conditions>" OR { <condition>:<value>, ... }
             */
            getUlrWithParams: function(params){
                if(!params||typeof(params)=="string")return params;
                var url= params["url"],pConditions=params.conditions;
                if(pConditions&&typeof(pConditions)==="object"){
                    var sConditions="";
                    for(var condItem in pConditions){
                        var sCondition=pConditions[condItem];
                        if(sCondition===undefined||sCondition===null) continue;
                        if(sConditions.length>0) sConditions+="&";
                        sConditions+= condItem+"="+sCondition;
                    }
                    if(sConditions) url=url+"?"+sConditions;
                }else if(pConditions) url=url+"?"+pConditions;
                return url;
            },
            /** getReqParams
             * params = { headers, handleAs, timeout, consoleLog }
             * if isJSON in result added headers=this.jsonHeader, handleAs="json"
             */
            getReqParams: function(params,isJSON){
                var requestParams=(isJSON)?{headers: this.jsonHeader, handleAs: "json"}:{};
                if(!params||typeof(params)=="string")return requestParams;
                if(params.handleAs) requestParams.handleAs=params.handleAs;
                if(params.headers) requestParams.headers=params.headers;
                if(params.timeout) requestParams.timeout=params.timeout;
                if(params.data) requestParams.data=params.data;
                return requestParams;
            },
            /** getJSON
             * params = "<url>" OR { url, conditions, headers, handleAs, timeout, consoleLog }
             * default headers=this.jsonHeader, handleAs="json"
             * conditions = "<conditions>" OR { <condition>:<value>, ... }
             * if success : callback(respData), if not success callback(undefined,error)
             */
            getJSON: function(params,callback){
                if(!params) return;
                var consoleLog=(params)?params.consoleLog:false;
                request.get(this.getUlrWithParams(params),this.getReqParams(params,true)).then(
                    function(respData){
                        if(callback) callback(respData);
                    },function(reqErr){
                        if(consoleLog) console.error("getJSON ERROR! url=",params.url," error=",reqErr);
                        if(callback) callback(undefined,reqErr);
                    })
            },
            /** postData
             * params = "<url>" OR { url, conditions, data, headers, handleAs, timeout, consoleLog }
             * if success : callback(data),
             * if not success callback(undefined,error)
             */
            postData: function(params,callback){
                var consoleLog=(params)?params.consoleLog:false;
                request.post(this.getUlrWithParams(params),this.getReqParams(params,false))
                    .then(function(respData){
                            if(callback)callback(respData);
                        },function(reqErr){
                            if(consoleLog) console.error("Request postData ERROR! url=",params.url," error=",reqErr);
                            if(callback)callback(undefined,reqErr);
                    })
            },
            /** postJSON
             * params = <url>" OR { url, conditions, data, timeout, consoleLog, showErrorDialog }
             * if success : callback(jsonData),
             * if not success callback(undefined,error)
             */
            postJSON: function(params,callback){
                var consoleLog=(params)?params.consoleLog:false;
                request.post(this.getUlrWithParams(params),this.getReqParams(params,true))
                    .then(function(respData){
                            if(callback)callback(respData);
                        },function(reqErr){
                            if(consoleLog) console.error("Request postJSON ERROR! url=",params.url," error=",reqErr);
                            if(callback)callback(undefined,reqErr);
                    })
            },
            /** processJSONDataResult
             * params = { showErrorDialog, resultItemName }
             * resParams={ dlgTitleReqErr, msgReqErrState0, msgReqErr, dlgMsgReqErrNoData, dlgTitleRespErr }
             * resultCallback = function(result,error), error = { reqError/srvError, message, errorMsg, userErrorMsg, srvResult }
             * call resultCallback(result) if request success and no result.error
             * call resultCallback(undefined,error) if request not success or exists result.error
             */
            processJSONDataResult: function(params, respJSON,error, resParams, resultCallback){
                var requestFailDialog=null, self=this, hasResult=respJSON!==undefined&&respJSON!==null;
                if(params&&params.showErrorDialog!==false)
                    requestFailDialog= function(msg, reason){
                        if(!reason) reason="";
                        self.doRequestFailDialog({title:"Внимание",content:msg+" <br>Причина: "+reason});
                    };
                if(!error&&hasResult&&!respJSON.error&&!params.resultItemName){
                    resultCallback(respJSON);
                    return;
                }else if(!error&&hasResult&&!respJSON.error&&params.resultItemName){
                    var reqRes=respJSON[params.resultItemName];
                    if(reqRes===undefined||reqRes===null){//no response result by params.resultItemName
                        if(requestFailDialog) requestFailDialog(resParams.dlgTitleReqErr,resParams.msgReqErrNoData);
                        resultCallback(reqRes,{srvError:"No response data", message:resParams.msgReqErrNoData});
                        return;
                    }
                    resultCallback(reqRes);
                    return;
                }else if(!error&&hasResult&&respJSON.error){// response contain error
                    var reqRes=(!params.resultItemName)?respJSON:respJSON[params.resultItemName],
                        respErr=respJSON.error||{},
                        errMsg=(typeof(respErr)=="object")?respErr.message:respErr,
                        postErr={srvError:respJSON.error, message:errMsg, srvResult:reqRes};
                    if(respErr.errorMsg) {
                        errMsg=respErr.errorMsg + "<br>" + errMsg;
                        postErr.message=respErr.errorMsg;postErr.errorMsg=respErr.errorMsg;
                    }
                    if(respErr.errorUserMsg){
                        errMsg=respErr.errorUserMsg;
                        postErr.message=respErr.errorUserMsg;postErr.errorUserMsg=respErr.errorUserMsg;
                    }
                    console.error("Response return error! Error:",respErr,"Result:",respJSON,"Request params:",params);
                    if(requestFailDialog) requestFailDialog(resParams.dlgTitleRespErr,errMsg);
                    resultCallback(undefined,postErr);
                    return;
                }else if(!error&&!hasResult){//no response result
                    if (requestFailDialog) requestFailDialog(resParams.dlgTitleReqErr,resParams.msgReqErrNoData);
                    console.error("Response return no result! Result:",respJSON,"Request params:",params);
                    resultCallback(null,{srvError:"No response data", message:resParams.msgReqErrNoData, srvResult:respJSON});
                    return;
                }
                //if error
                var msg = (error.response&&error.response.status==0)?resParams.msgReqErrState0:resParams.msgReqErr,
                    reqErr=(error.message)?error.message:error;
                if(requestFailDialog) requestFailDialog(resParams.dlgTitleReqErr,msg);
                resultCallback(undefined,{reqError:reqErr,message:msg});
            },
            getJSONResParams: {
                dlgTitleReqErr:"Невозможно получить данные!",
                msgReqErrState0:"Нет связи с сервером!",
                msgReqErr:"Некорректный ответ сервера!",
                msgReqErrNoData:"Нет данных с сервера!",
                dlgTitleRespErr:"Невозможно получить данные!"
            },
            postJSONResParams: {
                dlgTitleReqErr:"Невозможно получить результат операции!",
                msgReqErrState0:"Нет связи с сервером!",
                msgReqErr:"Некорректный ответ сервера!",
                msgReqErrNoData:"Нет результата операции с сервера!",
                dlgTitleRespErr:"Невозможно выпонить операцию!"
            },
            /** jsonData
             * params = { url, method:"get"/"post", conditions, timeout, showErrorDialog, consoleLog, resultItemName }
             * default: method="get", params.showErrorDialog = true, params.consoleLog = true
             * resultCallback = function(result, error)
             *  result = undefined, error present if request failed or no result (result empty)
             *  error = { reqError/srvError, message, errorMsg, userErrorMsg, srvResult }
             */
            jsonData: function(params,resultCallback){
                var self=this;
                if(params&&params.method=="post"){
                    this.postJSON(params,function(respJSON,error){
                        self.processJSONDataResult(params, respJSON,error, self.postJSONResParams, resultCallback);
                    });
                    return;
                }
                this.getJSON(params,function(respJSON,error){
                    self.processJSONDataResult(params, respJSON,error, self.getJSONResParams, resultCallback);
                });
            },
            /** getJSONData
             * params = { url, conditions, timeout, showErrorDialog, consoleLog, resultItemName }
             * default: params.showErrorDialog = true, params.consoleLog = true
             * resultCallback = function(result, error)
             *  result = undefined, error present if request failed or no result (result empty)
             *  error = { reqError/srvError, message, errorMsg, userErrorMsg, srvResult }
             */
            getJSONData: function(params,resultCallback){
                var self=this;
                this.getJSON(params,function(respJSON,error){
                    self.processJSONDataResult(params, respJSON,error, self.getJSONResParams, resultCallback);
                });
            },
            /** postJSONData
             * params = <url>" OR { url, conditions, timeout, showErrorDialog, data, resultItemName }
             * default: params.showErrorDialog = true
             * resultCallback = function(result, error)
             *  result = undefined, error present if request failed or no result (result empty)
             *  error = { reqError/srvError, message, errorMsg, userErrorMsg, srvResult }
             */
            postJSONData: function(params,resultCallback){
                var self=this;
                this.postJSON(params,function(respJSON,error){
                    self.processJSONDataResult(params, respJSON,error, self.postJSONResParams, resultCallback);
                })
            },
            doRequestFailDialog: function(params){
                if(!params) params={};
                params.id="requestFailDialog"; params.width=350; params.btnOkLabel="Закрыть";
                var instance= base.getInstanceByID(params.id);
                if(instance&&instance.open)return;
                dialogs.showSimple(params);
            }
        };
    });