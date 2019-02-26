/**
 * Created by dmkits on 30.12.16.
 */
define(["dojo/_base/declare", "dojo/request/xhr", "dijit/registry", "dialogs"],
    function(declare, xhr, registry, dialogs) {
        return {
            jsonHeader: {"X-Requested-With":"application/json; charset=utf-8"},
            showRequestErrorDialog: false,
            /** getData
             * doing JSON request and call onSuccess or onError
             * call preAction before send request.
             */
            jsonRequest: function (requestMethod, jsonDataURI, reqJSONData, preAction, onSuccess,onError) {
                if (preAction!=null) reqJSONData = preAction(reqJSONData,registry);
                if (requestMethod!="post") {//get
                    xhr.get(jsonDataURI, {headers:this.jsonHeader,handleAs:"json"}).then(
                        function(data){
                            onSuccess(data);
                        }, function(error){
                            onError(error);
                        })
                } else {//post
                    xhr.post(jsonDataURI, {headers:this.jsonHeader,handleAs:"json",data:reqJSONData}).then(
                        function(data){
                            onSuccess(data);
                        }, function(error){
                            onError(error);
                        })
                    }
            },

            /**
             * sending AJAX JSON-request to jsonDataURI with parameter "context"= dojoContextName
             * and getting JSON-response from server with data;
             * setting getted data to dojo objects by id.
             */
            setContextData: function(jsonDataURI,dojoContextName) {
                console.log("setContextData: contentName=",dojoContextName);//!!!IT'S FOR TESTING!!!
                if (dojoContextName!=null) { jsonDataURI = jsonDataURI + "?context="+dojoContextName}
                this.jsonRequest(jsonDataURI,"get",{}, null,
                    function(data) {//onSuccess request
                        registry.byId(dojoContextName).set("jsonData",data);
                        for (var id in data) {
                            var dojoObj = registry.byId(id);
                            if (dojoObj!=null) {
                                dojoObj.set(data[id].attribute,data[id].value);
                            } else { console.warn("setContextData WARNING: dojo id=",id," not founded!") }
                        }
                    })
            },
            /**
             * sending AJAX JSON-POST-request to jsonDataURI with parameter "context"= dojoContextName
             * and getting JSON-response from server with data- result of posted;
             * sending only changed values of dojo objects.
             * @param jsonDataURI
             * @param dojoContextName
             */
            sendContextData: function(jsonDataURI, dojoContextName) {
                console.log("sendContextData: contentName=",dojoContextName);//!!!IT'S FOR TESTING!!!
                if (dojoContextName!=null) { jsonDataURI = jsonDataURI + "?context="+dojoContextName}
                var jsonData = {};
                this.jsonRequest(jsonDataURI,"post",jsonData,
                    function(jsonData) {//preAction
                        try {
                            var dojoContext = registry.byId(dojoContextName);
                            var items = dojoContext.getChildren();
                            for(var i in items) {
                                var item = items[i];                                                                    console.log("sendContextData: context item=",item," value=",item.value);//!!!IT'S FOR TESTING!!!
                                if (dojoContext.jsonData[item.id]!=null) { //if context's object in jsonData
                                    var objValue = item.get(dojoContext.jsonData[item.id].attribute);
                                    if (objValue!=dojoContext.jsonData[item.id].value) {
                                        //set obj value to data to sending
                                        jsonData[item.id] = item.get(dojoContext.jsonData[item.id].attribute);
                                    }
                                }
                            }
                        } catch(e) { console.error("sendContextData preAction ERROR:",e); }                             console.log("sendContextData: posting data=",jsonData);//!!!IT'S FOR TESTING!!!
                        return jsonData;
                    }, function(data){//onSuccess
                        console.log("sendContextData: post response=",data);//!!!IT'S FOR TESTING!!!
                    })
            },

            /** getData
             * params.url, params.condition, params.consoleLog, params.showRequestErrorDialog
             * if success : callback(true,data), if not success callback(false,error)
             * @param params
             * @param callback
             */
            getJSONData: function(params,callback){
                if (!params) return;
                var url= params["url"],condition=params["condition"],consoleLog=params["consoleLog"],timeout=params["timeout"];;
                if(condition && typeof(condition)==="object"){
                    var scondition;
                    for(var condItem in condition){
                        if (condition[condItem]!==undefined&&condition[condItem]!==null)
                            scondition = (!scondition) ? condItem+"="+condition[condItem] : scondition+"&"+condItem+"="+condition[condItem];
                    }
                    if (scondition) url=url+"?"+scondition;
                } else if(condition) url=url+"?"+condition;
                var showRequestErrorDialog= params.showRequestErrorDialog;
                if (showRequestErrorDialog==undefined) showRequestErrorDialog= this.showRequestErrorDialog;
                var requestErrorDialog;
                if (showRequestErrorDialog===true) requestErrorDialog= dialogs.doRequestErrorDialog;
                var prop={headers: this.jsonHeader, handleAs: "json"};
                prop.timeout= (timeout)?timeout:600000;
                xhr.get(url, prop).then(
                    function(respdata){
                        if(callback)callback(true, respdata);
                    }, function(resperror){
                        if (requestErrorDialog) requestErrorDialog();
                        if(consoleLog) console.log("getJSONData ERROR! url=",url," error=",resperror);
                        if(callback)callback(false, resperror);
                    })
            },

            /** postData
             * params.url, params.condition, params.data, params.consoleLog, params.showRequestErrorDialog
             * if success : callback(true,data), if not success callback(false,error)
             * @param params
             * @param callback
             */
            postJSONData: function (params,callback) {
                if (!params) return;
                var url= params["url"],condition=params["condition"],consoleLog=params["consoleLog"];
                if(condition && typeof(condition)==="object"){
                    var scondition;
                    for(var condItem in condition){
                        if (condition[condItem]!==undefined&&condition[condItem]!==null)
                            scondition = (!scondition) ? condItem+"="+condition[condItem] : scondition+"&"+condItem+"="+condition[condItem];
                    }
                    if (scondition) url=url+"?"+scondition;
                } else if(condition) url=url+"?"+condition;
                var showRequestErrorDialog= params.showRequestErrorDialog;
                if (showRequestErrorDialog==undefined) showRequestErrorDialog= this.showRequestErrorDialog;
                var requestErrorDialog;
                if (showRequestErrorDialog===true) requestErrorDialog= dialogs.doRequestErrorDialog;
                xhr.post(url, {headers:this.jsonHeader,handleAs:"json",data:params["data"]}).then(
                    function(respdata){
                        if(callback)callback(true, respdata);
                    }, function(resperror){
                        if (requestErrorDialog) requestErrorDialog();
                        if(consoleLog) console.log("JSONRequest postData ERROR! url=",url," error=",resperror);
                        if(callback)callback(false, resperror);
                    })
            }
        };
    });