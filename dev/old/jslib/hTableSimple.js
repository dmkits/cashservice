/**
 * Created by dmkits on 20.04.16.
 * Refactor by dmkits 15.02.17.
 */
Handsontable.cellTypes['text'].editor.prototype.setValue = function(value) {
    var cellPropFormat = this.cellProperties["format"];
    if (this.cellProperties["type"]=="numeric"&&cellPropFormat&&cellPropFormat.indexOf('%')>=0){
        var val = ''; if(value) val = Math.round(value.replace(',','.')*100)+'%'; this.TEXTAREA.value= val;
    } else if (this.cellProperties["type"]=="numeric") {
        this.TEXTAREA.value = value.replace('.',',');
    } else this.TEXTAREA.value=value;
};
Handsontable.cellTypes['text'].editor.prototype.getValue = function() {
    var cellPropFormat = this.cellProperties["format"];
    if (this.cellProperties["type"]=="numeric"&&cellPropFormat&&cellPropFormat.indexOf('%')>=0){
        var val = this.TEXTAREA.value;
        if(!val) return this.TEXTAREA.value;
        if(val.indexOf('%')>=0) val = val.replace('%','');
        if (isNaN(val/100)) return this.TEXTAREA.value;
        return val/100;
    } else if (this.cellProperties["type"]=="numeric") {
        return this.TEXTAREA.value.replace('.',',');
    }
    return this.TEXTAREA.value;
};
define(["dojo/_base/declare", "dijit/layout/ContentPane", "request"], function(declare, ContentPane, Request){
    return declare("HTableSimple", [ContentPane], {
        handsonTable: null,
        htColumns: [], htVisibleColumns: [],
        htData: [],
        htSelection:null,
        //showIdentifiers:false,
        readOnly: true,
        wordWrap: false,
        persistentState: false,
        popupMenuItems: {},
        tableHeaderContent: undefined,
        constructor: function(args,parentName){
            this.srcNodeRef = document.getElementById(parentName);
            this.domNode = this.srcNodeRef;
            this.htColumns= [];/*[ { data:<data prop>, name, readOnly, type, width}, ...]*/
            this.htVisibleColumns= [];
            this.htData= []; /*[ {prop:value,...}, ...]*/
            //this.showIdentifiers=false;
            this.readOnly= true;
            this.wordWrap= false;
            this.persistentState= false;
            this.popupMenuItems= {};
            this.enableComments=false; this.htComments=[];
            this.htSelection=null;
            declare.safeMixin(this,args);
        },
        getVisibleColumnsFrom: function(dataColumns){
            var visibleColumns = [], vc=0;
            for(var c=0;c<dataColumns.length;c++){
                var colItem=dataColumns[c];
                if(colItem["visible"]!==false) {
                    var newColData = {};
                    visibleColumns[vc++]= newColData;
                    for(var item in colItem) newColData[item]=colItem[item];
                }
            }
            return visibleColumns;
        },
        setDataColumns: function(newDataColumns){
            if(!newDataColumns) {
                this.htColumns=[]; this.htVisibleColumns = [];
                return;
            }
            this.htColumns = newDataColumns;
            this.htVisibleColumns= this.getVisibleColumnsFrom(newDataColumns);
        },
        setData: function(data) {                                                                                       console.log("HTableSimple setData ",data);
            if (!data) { data={ identifier:null, columns:[], items:[] }; }
            if(data.identifier) { this.handsonTable.rowIDName=data.identifier; }
            this.setDataColumns(data.columns);
            if(!data.items) {
                this.htData = [];
                return;
            }
            this.htData = data.items;
        },
        getData: function(){
            return this.htData;
        },
        getRowIDName: function(){
            return this.handsonTable.rowIDName;
        },
        getColumns: function(){                                                                                         console.log("HTableSimple getColumns ",this.htColumns);
            return this.htColumns;
        },
        getVisibleColumns: function(){ return this.htVisibleColumns; },
        createHandsonTable: function(){
            var content = document.createElement('div');
            content.parentNode = this.domNode; content.parent = this.domNode; content.style="width:100%;height:100%;margin0;padding:0;";
            this.set("content",content);
            var parent=this;
            this.handsonTable = new Handsontable(content, {
                columns: parent.htVisibleColumns,
                getColumnHeader: function(colIndex){
                    if(!parent.htVisibleColumns||!parent.htVisibleColumns[colIndex])return colIndex;
                    return parent.htVisibleColumns[colIndex]["name"];
                },
                colHeaders: function(colIndex){
                    return this.getColumnHeader(colIndex);
                },
                data: parent.htData, comments: parent.enableComments,//copyPaste: true,default
                htDataSelectedProp: "<!$selected$!>",
                rowHeaders: false,
                //stretchH: "all",
                autoWrapRow: true,
                //maxRows: 20,
                //width: 0, height: 0,
                minSpareCols:0, minSpareRows: 0,
                allowInsertRow:false,
                fillHandle: { autoInsertRow: false, direction: 'vertical' },//it's for use fillHandle in childrens
                startRows: 1,
                fixedColumnsLeft: 0, fixedRowsTop: 0,
                manualColumnResize: true, manualRowResize: false,
                persistentState: parent.persistentState,
                readOnly: parent.readOnly,
                wordWrap: parent.wordWrap,
                enterMoves:{row:0,col:1}, tabMoves:{row:0,col:1},
                multiSelect: true,
                beforeOnCellMouseDown: function(event, coords, element) {
                    if(element.tagName==="TH") { event.stopImmediatePropagation(); }//disable column header click event
                },
                cellValueRenderer:function (instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.cellTypes[cellProperties.type].renderer.apply(this, arguments);
                    if(cellProperties["html"]){
                        Handsontable.renderers.HtmlRenderer.apply(this, arguments);
                    } else if (cellProperties["type"]==="text"&&cellProperties["dateFormat"]){
                        if(value!==null&&value!==undefined)
                            td.innerHTML= moment(new Date(value) /*value,"YYYY-MM-DD"*/).format(cellProperties["dateFormat"]);
                        else td.innerHTML="";
                    }
                    var rowSourceData= instance.getContentRow(row);
                    if(rowSourceData&&rowSourceData[instance.getSettings().htDataSelectedProp]===true) td.classList.add('hTableCurrentRow');
                    return cellProperties;
                },
                cells: function (row, col, prop) {
                    return {readOnly:true, renderer:this.cellValueRenderer};
                },
                setDataSelectedProp: function(data, olddata){
                    if (data) data[this.htDataSelectedProp]= true;
                    if (olddata && olddata!==data) olddata[this.htDataSelectedProp]= false;
                },
                /*beforeSetRangeStart: function(coords){                                                                console.log("HTableSimple beforeSetRangeStart coords=",coords);

                },*/
                /*beforeSetRangeEnd: function(coords){                                                                  console.log("HTableSimple beforeSetRangeEnd coords=",coords);

                },*/
                afterSelectionEnd: function(r,c,r2,c2) {
                    var selection= [], firstItem=r;
                    if (r<=r2)
                        for (var ri=r; ri<=r2; ri++) selection[ri]=this.getContentRow(ri);
                    else {
                        firstItem=r2;
                        for (var ri = r2; ri <= r; ri++) selection[ri] = this.getContentRow(ri);
                    }
                    parent.onSelect(selection[firstItem], selection);
                }
            });
            //this.handsonTable.updateSettings({fillHandle: false});//it's for use fillHandle in childrens
            this.handsonTable.getContent= function(){
                return this.getSourceData();
            };
            this.handsonTable.getContentRow= function(row){
                if (!this.getContent()||this.getContent().length==0) return null;
                return this.getContent()[row];
            };

            this.resizePane = this.resize; this.resize = this.resizeAll;
        },
        postCreate : function(){
            this.createHandsonTable();
        },
        getHandsonTable: function(){ return this.handsonTable; },
        setHT: function(params){
            this.handsonTable.updateSettings(params);
        },
        setAddingHeaderRow: function(addingHeaderContent){
            if (addingHeaderContent) this.tableHeaderContent=addingHeaderContent;
            var thisInstance=this, hInstance= this.getHandsonTable();
            hInstance.updateSettings({
                afterRender: function () {
                    var theads=hInstance.rootElement.getElementsByTagName('thead');                                     //console.log("HTableSimple afterRender theads=",theads);
                    for(var theadInd=0;theadInd<theads.length;theadInd++){
                        var thead= theads[theadInd];
                        var newTR = document.createElement("tr");
                        var newTH=document.createElement("th");
                        newTR.appendChild(newTH);
                        var tr=thead.getElementsByTagName('tr')[0];
                        thead.insertBefore(newTR,tr);
                        newTH.setAttribute("colspan",tr.childNodes.length.toString());
                        newTH.innerHTML=thisInstance.tableHeaderContent;
                        if (tr.firstChild) tr.firstChild.removeAttribute("colspan");
                    }
                }
            });
        },
        resizeAll: function(changeSize,resultSize){
            this.resizePane(changeSize,resultSize);
            var thisMarginTop= (this.domNode.style.marginTop).replace("px",""),
                thisMarginBottom= (this.domNode.style.marginBottom).replace("px","");
            this.handsonTable.updateSettings(
                {/*width:this.domNode.clientWidth,*/ height:changeSize.h-2-thisMarginTop-thisMarginBottom}
            );
        },
        //setDisabled: function(disabled){
        //    this.set("disabled",disabled);
        //    if (disabled) this.handsonTable
        //},
        /*
         * calls on load/set/reset data to table or on change data after store
         * params= { callOnUpdateContent=true/false, resetSelection=true/false }
         * default params.resetSelection!=false
         * if params.resetSelection==false not call resetSelection
         * default params.callOnUpdateContent!=false
         * if params.callOnUpdateContent==false not call onUpdateContent
         */
        updateContent: function(newdata,params) {                                                           //console.log("HTableSimple updateContent newdata=",newdata," params=", params);
            if(newdata!==undefined) this.setData(newdata);
            if(this.htData!==null) {//loadTableContent
                this.handsonTable.updateSettings(
                    {columns:this.htVisibleColumns, data:this.getData(), readOnly:this.readOnly, comments:this.enableComments}
                );
                if(params&&params.resetSelection!==false) this.resetSelection();
            } else {//clearTableDataContent
                this.clearContent();
            }
            if (params&&params.callOnUpdateContent===false) return;
            this.onUpdateContent();
        },
        resetSelection: function(){                                                                         //console.log("HTableSimple resetSelection ",this.getSelectedRows()," rowIDName=", this.handsonTable.rowIDName);
            var newData= this.getContent();
            var newSelection= null, newSelectionFirstRowIndex, oldSelection= this.getSelectedRows();
            if (oldSelection){
                var rowIDName= this.handsonTable.rowIDName;
                for (var oldSelectionRowIndex in oldSelection){
                    var oldSelectionRowData= oldSelection[oldSelectionRowIndex];
                    if (newData[oldSelectionRowIndex]){
                        if(!rowIDName || (rowIDName && oldSelectionRowData[rowIDName]===newData[oldSelectionRowIndex][rowIDName]) ){
                            if (!newSelection) newSelection= [];
                            newSelectionFirstRowIndex=oldSelectionRowIndex;
                            newSelection[oldSelectionRowIndex]=newData[oldSelectionRowIndex];
                            break;
                        }
                    }
                    for(var filteredDataRowIndex in newData)
                        if (rowIDName && newData[filteredDataRowIndex][rowIDName]===oldSelectionRowData[rowIDName]){
                            if (!newSelection) newSelection= [];
                            newSelectionFirstRowIndex=filteredDataRowIndex;
                            newSelection[filteredDataRowIndex]=newData[filteredDataRowIndex];
                            break;
                        }
                    break;
                }
            }
            this.setSelection( (newSelection)?newSelection[newSelectionFirstRowIndex]:null, newSelection);              //console.log("HTableSimple resetSelection END",this.getSelectedRows()," rowIDName=", this.handsonTable.rowIDName);
        },
        setContent: function(newdata) {                                                                                 //console.log("HTableSimple setContent newdata=", newdata);
            this.updateContent(newdata);
        },
        clearContent: function() {                                                                                      //console.log("HTableSimple clearContent");
            this.setSelection(null,null);
            this.handsonTable.updateSettings({columns:this.htVisibleColumns, data:[], comments:false, readOnly:false});
        },
        getContent: function(){
            return this.handsonTable.getContent();
        },
        getContentRow: function(rowInd){
            return this.handsonTable.getContentRow(rowInd);
        },
        getContentItemSum: function(itemName){
            var contentData= this.getContent();
            var itemSum=0.0;
            for(var dataItemIndex in contentData){
                var itemData= contentData[dataItemIndex];
                var itemValue=itemData[itemName];
                if (itemValue) itemSum+=itemValue;
            }
            return itemSum;
        },
        onUpdateContent: function(){                                                                                    //console.log("HTableSimple onUpdateContent");
            //TODO actions on/after update table content (after set/reset/reload/clear table content data)
        },
        /*
         * params: {method=get/post , url, condition:string or object, duplexRequest:true/false, data, callUpdateContent:true/false}
         * if (duplexRequest=true) or (duplexRequest=undefined and no htColumns data),
         *     sends two requests: first request without parameters to get columns data without table data
         *     and second request with parameters from params.condition to get table data;
         * if duplexRequest=false, sends only one request to get table data with columns data.
         */
        setContentFromUrl: function(params){
            if (!params.method) params.method="get";
            var duplexRequest= (params.duplexRequest===true)||( (!this.htColumns||this.htColumns.length==0)&&(params.duplexRequest!==false) );
            var instance = this;
            if (params.method!="post") {
                if (duplexRequest){
                    Request.getJSONData({url:params.url, condition:null, consoleLog:true}
                        ,/*postaction*/function(success,result){
                            if(!success) result=null;
                            if(!success||!result||result.error) {
                                var errorMsg=(result&&result.error)?"Error=":"", error=(result&&result.error)?result.error:"";
                                console.log("HTableSimple setContentFromUrl Request.getJSONData DATA ERROR!!! "+errorMsg,error);
                                instance.updateContent(result, {callUpdateContent:params.callUpdateContent});
                                return;
                            }
                            instance.updateContent(result, {callUpdateContent:params.callUpdateContent, resetSelection:false});
                            Request.getJSONData({url:params.url, condition:params.condition, consoleLog:true}
                                ,/*postaction*/function(success,result){
                                    if(!success) result=null;
                                    if(!success||!result||result.error) {
                                        var errorMsg=(result&&result.error)?"Error=":"", error=(result&&result.error)?result.error:"";
                                        console.log("HTableSimple setContentFromUrl Request.getJSONData DATA ERROR!!! "+errorMsg,error);
                                        instance.updateContent({ columns:instance.htColumns, items:[] }, {callUpdateContent:params.callUpdateContent});
                                        return;
                                    }
                                    instance.updateContent(result, {callUpdateContent:params.callUpdateContent});
                                });
                        });
                    return;
                }
                if(this.htData&&this.htData.length>0)
                    instance.updateContent({ columns:this.htColumns, items:[] }, {callUpdateContent:params.callUpdateContent, resetSelection:false});
                Request.getJSONData({url:params.url, condition:params.condition, consoleLog:true}
                    ,/*postaction*/function(success,result){
                        if(!success) result=null;
                        if(!success||!result||result.error) {
                            var errorMsg=(result&&result.error)?"Error=":"", error=(result&&result.error)?result.error:"";
                            console.log("HTableSimple setContentFromUrl Request.getJSONData DATA ERROR!!! "+errorMsg,error);
                            instance.updateContent({ columns:instance.htColumns, items:[] }, {callUpdateContent:params.callUpdateContent});
                            return;
                        }
                        instance.updateContent(result, {callUpdateContent:params.callUpdateContent});
                    });
                return;
            }
            if (duplexRequest){
                Request.postJSONData({url:params.url, condition:null, consoleLog:true},
                    /*postaction*/function(success,result){
                        if(!success) result=null;
                        if(!success||!result||result.error) {
                            var errorMsg=(result&&result.error)?"Error=":"", error=(result&&result.error)?result.error:"";
                            console.log("HTableSimple setContentFromUrl Request.getJSONData DATA ERROR!!! "+errorMsg,error);
                            instance.updateContent(result, {callUpdateContent:params.callUpdateContent});
                            return;
                        }
                        instance.updateContent(result, {callUpdateContent:params.callUpdateContent, resetSelection:false});
                        Request.postJSONData({url:params.url, condition:params.condition, data:params.data, consoleLog:true},
                            /*postaction*/function(success,result){
                                if(!success) result=null;
                                if(!success||!result||result.error) {
                                    var errorMsg=(result&&result.error)?"Error=":"", error=(result&&result.error)?result.error:"";
                                    console.log("HTableSimple setContentFromUrl Request.getJSONData DATA ERROR!!! "+errorMsg,error);
                                    instance.updateContent({ columns:instance.htColumns, items:[] }, {callUpdateContent:params.callUpdateContent});
                                    return;
                                }
                                instance.updateContent(result, {callUpdateContent:params.callUpdateContent});
                            });
                    });
                return;
            }
            if(this.htData&&this.htData.length>0)
                instance.updateContent({ columns:this.htColumns, items:[] }, {callUpdateContent:params.callUpdateContent, resetSelection:false});
            Request.postJSONData({url:params.url, condition:params.condition, data:params.data, consoleLog:true},
                /*postaction*/function(success,result){
                    if(!success) result=null;
                    if(!success||!result||result.error) {
                        var errorMsg=(result&&result.error)?"Error=":"", error=(result&&result.error)?result.error:"";
                        console.log("HTableSimple setContentFromUrl Request.getJSONData DATA ERROR!!! "+errorMsg,error);
                        instance.updateContent({ columns:instance.htColumns, items:[] }, {callUpdateContent:params.callUpdateContent});
                        return;
                    }
                    instance.updateContent(result, {callUpdateContent:params.callUpdateContent});
                });
        },
        setSelectedRow: function(rowIndex){
            this.handsonTable.selectCell(rowIndex,0,rowIndex,0);
        },
        setSelectedRowByItemValue:function(itemName, value){
            var oldSelectedRow=this.getSelectedRow(), instance=this;
            this.getContent().some(function(item,rowIndex){
                if (item[itemName]==value) {
                    instance.htSelection= []; instance.htSelection[rowIndex]=item;
                }
            });
            var newSelectedRow=this.getSelectedRow();
            this.handsonTable.getSettings().setDataSelectedProp(newSelectedRow, oldSelectedRow);
            this.handsonTable.render();
            this.onSelect(newSelectedRow,this.htSelection);
        },
        getSelectedRowIndex:function(){
            if(!this.htSelection) return null;
            for(var selItemIndex in this.htSelection)
                return parseInt(selItemIndex);
        },
        getSelectedRow:function(){
            if(!this.htSelection) return null;
            for(var selItemIndex in this.htSelection)
                return this.htSelection[selItemIndex];
        },
        getSelectedRowItemValue:function(itemName){
            if (!this.getSelectedRow) return null;
            return this.getSelectedRow[itemName];
        },
        getSelectedRows:function(){
            return this.htSelection;
        },
        onSelect: function (firstSelectedRowData, selection){
            //TODO actions on/after row select by user or after call setSelectedRow/setSelectedRowByID
            this.setSelection(firstSelectedRowData, selection);
        },
        setSelection:function(firstSelectedRowData, selection){//callback onSelect
            if (firstSelectedRowData===undefined){
                this.handsonTable.getSettings().setDataSelectedProp(this.getSelectedRow());
                this.handsonTable.render();
                return;
            }
            var oldSelRow= this.getSelectedRow();                                                                       //console.log("HTableSimple setSelection",selection);
            this.handsonTable.getSettings().setDataSelectedProp(firstSelectedRowData, oldSelRow);
            this.htSelection= selection;
            this.handsonTable.render();
        },

        setMenuItem: function(itemID, itemName, callback){                                                              //console.log("HTableSimple setMenuItem",itemID,this.popupMenuItems,this);
            this.popupMenuItems[itemID]= {
                name:itemName,
                callback: function(key, options){
                    var startRowIndex= options.start.row, endRowIndex= options.end.row;
                    var selRowsData= [];
                    for(var r=startRowIndex; r<=endRowIndex; r++) selRowsData[r]= this.getContentRow(r);
                    callback(selRowsData);
                }
            };
            var popupMenuItems = this.popupMenuItems;
            this.handsonTable.updateSettings({ contextMenu: { items: popupMenuItems } });
        }
    });
});
