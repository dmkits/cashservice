define(["dojo/request/xhr", "app", "dojo/domReady!"],
    function (xhr, APP) {
        return {
            jsonHeader: {"X-Requested-With": "application/json; charset=utf-8"},
            showRequestErrorDialog: false,
            /** getJSONData
             * params.url, params.condition, params.timeout, , params.consoleLog
             * default params.timeout=120000
             * if success : callback(true,data), if not success callback(false,error)
             * @param params
             * @param callback
             */
            getJSONData: function (params, callback) {
                if (!params) return;
                var url = params["url"], condition = params["condition"], consoleLog = params["consoleLog"],timeout=params["timeout"];
                if (condition) url = url + "?" + condition;
                var prop={headers: this.jsonHeader, handleAs: "json"};
                prop.timeout= (timeout)?timeout:"120000";
                var showRequestErrorDialog=this.showRequestErrorDialog;
                xhr.get(url, prop).then(
                    function (data) {
                        if (callback)callback(true, data);
                    }, function (error) {
                        if (showRequestErrorDialog) APP.doRequestErrorDialog();
                        if (consoleLog) console.log("getJSONData ERROR! url=", url, " error=", error);
                        if (callback)callback(false, error);
                    });
            },
            getTextData: function (params, callback) {
                if (!params) return;
                var url = params["url"], condition = params["condition"], consoleLog = params["consoleLog"];
                if (condition) url = url + "?" + condition;
                var showRequestErrorDialog=this.showRequestErrorDialog;
                xhr.get(url, {headers: this.jsonHeader, handleAs: "text"}).then(
                    function (data) {
                        if (callback)callback(true, data);
                    }, function (error) {
                        if (showRequestErrorDialog) APP.doRequestErrorDialog();
                        if (consoleLog) console.log("getTextData ERROR! url=", url, " error=", error);
                        if (callback)callback(false, error);
                    });
            },

            /** postJSONData
             * params.url, params.condition, params.data, params.consoleLog
             * if success : callback(true,data), if not success callback(false,error)
             * @param params
             * @param callback
             */
            postJSONData: function (params, callback) {
                if (!params) return;
                var url = params["url"], condition = params["condition"], consoleLog = params["consoleLog"];
                if (condition) url = url + "?" + condition;
                var showRequestErrorDialog=this.showRequestErrorDialog;
                xhr.post(url, {headers: this.jsonHeader, handleAs: "json", data: params["data"]}).then(
                    function (data) {
                        if (callback)callback(true, data);
                    }, function (error) {
                        if (showRequestErrorDialog)  APP.doRequestErrorDialog();
                        if (consoleLog) console.log("postJSONData ERROR! url=", url, " error=", error);
                        if (callback)callback(false, error);
                    });
            },
            postTextData: function (params,callback) {
                if (!params) return;
                var url = params["url"], condition = params["condition"], consoleLog = params["consoleLog"];
                if (condition) url = url + "?" + condition;
                var showRequestErrorDialog=this.showRequestErrorDialog;
                xhr.post(url, {headers: this.jsonHeader, handleAs: "text", data: params["data"]}).then(
                    function (data) {
                        if (callback)callback(true, data);
                    }, function (error) {
                        if (showRequestErrorDialog)  APP.doRequestErrorDialog();
                        if (consoleLog) console.log("postTextData ERROR! url=", url, " error=", error);
                        if (callback)callback(false, error);
                    });
            },

            postXMLData: function (params,callback) {
                if (!params) return;
                var url = params["url"], condition = params["condition"], consoleLog = params["consoleLog"];
                if (condition) url = url + "?" + condition;
                var showRequestErrorDialog=this.showRequestErrorDialog;
                xhr.post(url, {headers: /*this.jsonHeader*/ {'Content-type':'text/xml; charset=utf-8' ,'Access-Control-Allow-Origin':"*"},handleAs: "xml", data: params["data"]}).then(
                    function (data) {
                        if (callback)callback(true, data);
                    }, function (error) {
                        if (showRequestErrorDialog)  APP.doRequestErrorDialog();
                        if (consoleLog) console.log("postXMLData ERROR! url=", url, " error=", error);
                        if (callback)callback(false, error);
                    });
            },
            getXMLData: function (params, callback) {
                if (!params) return;
                var url = params["url"], condition = params["condition"], consoleLog = params["consoleLog"];
                if (condition) url = url + "?" + condition;
                var showRequestErrorDialog=this.showRequestErrorDialog;
                xhr.get(url, {headers: {'Content-Language': 'ru-RU', 'Content-Type': 'text/xml;windows-1251'},
                    handleAs: "xml", data: params["data"]}).then(
                    function (data) {
                        if (callback)callback(true, data);
                    }, function (error) {
                        if (showRequestErrorDialog) APP.doRequestErrorDialog();
                        if (consoleLog) console.log("getTextData ERROR! url=", url, " error=", error);
                        if (callback)callback(false, error);
                    });
            }
        }
    });