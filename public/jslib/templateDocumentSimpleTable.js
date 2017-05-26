/**
 * Created by dmkits on 18.12.16.
 */
define(["dojo/_base/declare", "app", "templateDocumentBase", "hTableSimpleFiltered"],
    function(declare, APP, DocumentBase, HTable) {
        return declare("TemplateDocumentSimpleTable", [DocumentBase], {
            /*
            * args: {titleText, dataURL, condition={...}, buttonUpdate, buttonPrint, printFormats={ ... } }
            * default:
            * buttonUpdate=true, buttonPrint=true,
            * default printFormats={ dateFormat:"DD.MM.YY", numericFormat:"#,###,###,###,##0.#########", currencyFormat:"#,###,###,###,##0.00#######" }
            * */
            constructor: function(args,parentName){
                this.srcNodeRef = document.getElementById(parentName);
                declare.safeMixin(this,args);
                if (this.buttonUpdate===undefined) this.buttonUpdate= true;
                if (this.buttonPrint===undefined) this.buttonPrint= true;
                if (this.printFormats===undefined)
                    this.printFormats= { dateFormat:"DD.MM.YY", numericFormat:"#,###,###,###,##0.#########", currencyFormat:"#,###,###,###,##0.00#######" };
                if (this.detailContentErrorMsg===undefined) this.detailContentErrorMsg="Failed get data!";
            },

            postCreate: function(){
                this.topContent = this.setChildContentPaneTo(this, {region:'top'}, "margin:0;padding:0;border:none");
                var topTable = this.addTableTo(this.topContent.containerNode);
                this.topTableRow = this.addRowToTable(topTable);
                var topTableHeaderCell = this.addLeftCellToTableRow(this.topTableRow,1);
                this.topTableErrorMsg= this.topTableRow.children[this.topTableRow.children.length-1];
                var topHeader = document.createElement("h1");
                topHeader.appendChild(document.createTextNode(this.titleText));
                topTableHeaderCell.appendChild(topHeader);
                this.detailContentHTable =
                    new HTable({region:'center',style:"margin:0;padding:0;", readOnly:true, wordWrap:true, useFilters:true /*,allowFillHandle:false,*/});
                this.addChild(this.detailContentHTable);
                var instance = this;
                this.detailContentHTable.onUpdateContent = function(){ instance.onUpdateDetailContent(); };
                this.detailContentHTable.onSelect = function(firstSelectedRowData, selection){
                    this.setSelection(firstSelectedRowData, selection);
                    instance.onSelectDetailContent(firstSelectedRowData, selection);
                };
            },
            setDetailContent: function(){                                                                           //console.log("TemplateDocumentSimpleTable setDetailContent");
                var condition = (this.condition)?this.condition:{};
                if (this.beginDateBox) condition[this.beginDateBox.conditionName] =
                    this.beginDateBox.format(this.beginDateBox.get("value"),{selector:"date",datePattern:"yyyy-MM-dd"});
                if (this.endDateBox) condition[this.endDateBox.conditionName] =
                    this.endDateBox.format(this.endDateBox.get("value"),{selector:"date",datePattern:"yyyy-MM-dd"});
                this.loadDetailContent(this.detailContentHTable, this.dataURL,condition);
            },
            setLoadDetailContent: function(loadDetailContentCallback){
                if (loadDetailContentCallback) this.loadDetailContent= loadDetailContentCallback;
                return this;
            },
            loadDetailContent: function(detailContentHTable, url, condition){                                       //console.log("TemplateDocumentSimpleTable loadDetailContent");
                detailContentHTable.setContentFromUrl({url:url,condition:condition});
            },
            setDetailContentErrorMsg: function(detailContentErrorMsg){
                this.detailContentErrorMsg= detailContentErrorMsg;
                return this;
            },
            getDetailContent: function(){
                return this.detailContentHTable.getContent();
            },
            getDetailContentSelectedRow: function(){
                return this.detailContentHTable.getSelectedRow();
            },
            getDetailContentItemSum: function(tableItemName){
                return this.detailContentHTable.getContentItemSum(tableItemName);
            },
            onUpdateDetailContent: function(){

                //------------------ON DATA ERROR!!!-----------------------
                //var topTableErrorMsg= this.topTableErrorMsg, detailContentErrorMsg=this.detailContentErrorMsg;
                //if (!success || (success&&result.error)) topTableErrorMsg.innerHTML= "<b style='color:red'>"+detailContentErrorMsg+"</b>";
                //else topTableErrorMsg.innerHTML="";

                if (!this.totals) return;
                for(var tableItemName in this.totals){
                    var totalBox = this.totals[tableItemName];
                    totalBox.updateValue();
                }
                if (this.infoPane&&this.infoPane.updateCallback) this.infoPane.updateCallback(this.infoPane, this);
            },
            onSelectDetailContent: function(firstSelectedRowData, selection){
                if (this.infoPane&&this.infoPane.updateCallback) this.infoPane.updateCallback(this.infoPane, this);
            },

            addBeginDateBox: function(labelText, conditionName, initValueDate){
                if (initValueDate===undefined||initValueDate===null) initValueDate= APP.curMonthBDate();
                this.beginDateBox= this.addTableCellDateBoxTo(this.topTableRow,
                    {labelText:labelText, labelStyle:"margin-left:5px;", cellWidth:110, cellStyle:"text-align:right;",
                        inputParams:{conditionName:conditionName}, initValueDate:initValueDate});
                var instance = this;
                this.beginDateBox.onChange = function(){
                    instance.setDetailContent();
                };
                return this;
            },
            addEndDateBox: function(labelText, conditionName, initValueDate){
                if (initValueDate===undefined||initValueDate===null) initValueDate= APP.today();
                this.endDateBox= this.addTableCellDateBoxTo(this.topTableRow,
                    {labelText:labelText, labelStyle:"margin-left:5px;", cellWidth:110, cellStyle:"text-align:right;",
                        inputParams:{conditionName:conditionName}, initValueDate:initValueDate});
                var instance = this;
                this.endDateBox.onChange = function(){
                    instance.setDetailContent();
                };
                return this;
            },
            addBtnUpdate: function(width, labelText){
                if (width===undefined) width=200;
                if (!labelText) labelText="Обновить";
                this.btnUpdate= this.addTableCellButtonTo(this.topTableRow, {labelText:labelText, cellWidth:width, cellStyle:"text-align:right;"});
                var instance= this;
                this.btnUpdate.onClick = function(){
                    instance.setDetailContent();
                };
                return this;
            },
            addBtnPrint: function(width, labelText, printFormats){
                if (width===undefined) width=100;
                if (!this.btnUpdate) this.addBtnUpdate(width);
                if (!labelText) labelText="Печатать";
                this.btnPrint= this.addTableCellButtonTo(this.topTableRow, {labelText:labelText, cellWidth:1, cellStyle:"text-align:right;"});
                var instance = this;
                this.btnPrint.onClick = function(){
                    instance.doPrint();
                };
                return this;
            },

            setTotalContent: function(){
                if (!this.totalContent) {
                    this.totalContent = this.setChildContentPaneTo(this, {region:'bottom',style:"margin:0;padding:0;border:none;"});
                    this.totalTable = this.addTableTo(this.totalContent.containerNode);
                    this.addTotalRow();
                }
                return this;
            },
            addTotalRow: function(){
                this.totalTableRow = this.addRowToTable(this.totalTable);
                if (!this.totalTableData) this.totalTableData= [];
                this.totalTableData.push([]);
                return this;
            },
            addTotalEmpty: function(width){
                this.setTotalContent();
                this.addLeftCellToTableRow(this.totalTableRow, width);
                var totalTableRowData= this.totalTableData[this.totalTableData.length-1];
                totalTableRowData.push(null);
                return this;
            },
            addTotalText: function(text, width){
                this.setTotalContent();
                var totalTableCell = this.addLeftCellToTableRow(this.totalTableRow, width);
                //var totalTableCellDiv = document.createElement("div");
                //totalTableCellDiv.setAttribute("style","width:"+width+"px");
                //totalTableCell.appendChild(totalTableCellDiv);
                if (text) totalTableCell.appendChild(document.createTextNode(text));
                return this;
            },
            /*
             * params { style, inputStyle, pattern }
             * default pattern="#,###,###,###,##0.#########"
             */
            addTotalNumberBox: function(labelText, width, tableItemName, params){
                this.setTotalContent();
                var style="",inputStyle="", pattern="#,###,###,###,##0.#########";
                if (params&&params.style) style=params.style;
                if (params&&params.inputStyle) inputStyle=params.inputStyle;
                if (params&&params.pattern) pattern=params.pattern;
                var totalNumberTextBox= this.addTableCellNumberTextBoxTo(this.totalTableRow,
                    {cellWidth:width, cellStyle:"text-align:right;",
                        labelText:labelText, labelStyle:style, inputStyle:"text-align:right;"+style+inputStyle,
                        inputParams:{constraints:{pattern:pattern}, readOnly:true,
                            /*it's for print*/cellWidth:width, labelText:labelText, printStyle:style, inputStyle:inputStyle, typeFormat:pattern } });
                if (!this.totals) this.totals = {};
                this.totals[tableItemName]= totalNumberTextBox;
                var totalTableRowData= this.totalTableData[this.totalTableData.length-1];
                totalTableRowData.push(totalNumberTextBox);
                return totalNumberTextBox;
            },
            /*
             * params { style, inputStyle }
             */
            addTotalCountNumberBox: function(labelText, width, params){
                var totalNumberTextBox= this.addTotalNumberBox(labelText, width, "TableRowCount", params);
                var thisInstance = this;
                totalNumberTextBox.updateValue = function(){
                    this.set("value", thisInstance.getDetailContent().length);
                };
                return this;
            },
            /*
             * params { style, inputStyle, pattern }
             * default pattern="#,###,###,###,##0.#########"
             */
            addTotalSumNumberTextBox: function(labelText, width, tableItemName, params){
                var totalNumberTextBox= this.addTotalNumberBox(labelText, width, tableItemName, params);
                var thisInstance = this;
                totalNumberTextBox.updateValue = function(){
                    this.set("value", thisInstance.getDetailContentItemSum(tableItemName));
                };
                return this;
            },

            setPopupMenuItem: function(itemID, itemName, callback){
                this.detailContentHTable.setMenuItem(itemID, itemName, callback);
                return this;
            },

            setInfoPane: function(width, updateInfoPaneCallback){
                if (!this.infoPane) {
                    if (width===undefined) width=100;
                    this.infoPane = this.setChildContentPaneTo(this, {region:'right'}, "height:100%;width:"+width+"px;");
                    this.addChild(this.infoPane);
                    if (updateInfoPaneCallback) this.infoPane.updateCallback = updateInfoPaneCallback;
                }
                return this;
            },

            startUp: function(){
                if (this.buttonUpdate!=false&&!this.btnUpdate) this.addBtnUpdate();
                if (this.buttonPrint!=false&&!this.btnPrint) this.addBtnPrint();
                this.setDetailContent();
                this.layout();
                return this;
            },

            doPrint: function(printFormats){
                var printData = {};
                if (this.titleText) {
                    this.addPrintDataSubItemTo(printData, "header",
                        {label:this.titleText, width:0, style:"width:100%;font-size:14px;font-weight:bold;text-align:center;", contentStyle:"margin-top:5px;margin-bottom:3px;"});
                }
                var headerTextStyle="font-size:14px;", headerDateContentStyle="margin-bottom:3px;";
                if (this.beginDateBox||this.endDateBox){
                    this.addPrintDataItemTo(printData, "header", {newTable:true, style:headerTextStyle});
                    this.addPrintDataSubItemTo(printData, "header");
                    this.addPrintDataSubItemTo(printData, "header", {label:"Период:", width:80,style:headerTextStyle+"text-align:right;", contentStyle:headerDateContentStyle});
                }
                if (this.beginDateBox)
                    this.addPrintDataSubItemTo(printData, "header",
                        {label:"с ", width:110,style:headerTextStyle, contentStyle:headerDateContentStyle, value:this.beginDateBox.get("value"),type:"date"});
                if (this.endDateBox)
                    this.addPrintDataSubItemTo(printData, "header",
                        {label:"по ", width:110,style:headerTextStyle, contentStyle:headerDateContentStyle, value:this.endDateBox.get("value"),type:"date"});
                this.addPrintDataSubItemTo(printData, "header");
                printData.columns = this.detailContentHTable.getVisibleColumns();                                       //console.log("doPrint printData.columns=",this.detailContentHTable.getVisibleColumns());
                printData.data = this.detailContentHTable.getContent();
                var totalStyle="font-size:12px;";
                if (this.totals){
                    for(var tRowIndex in this.totalTableData){
                        var tRowData= this.totalTableData[tRowIndex];
                        this.addPrintDataItemTo(printData, "total", {style:totalStyle});
                        for(var tCellIndex in tRowData){
                            var tCellData= tRowData[tCellIndex];
                            if (tCellData===null) {
                                this.addPrintDataSubItemTo(printData, "total");
                                continue
                            }
                            this.addPrintDataSubItemTo(printData, "total", {width:tCellData.cellWidth+5, style:tCellData.printStyle,
                                contentStyle:"margin-top:3px;", label:tCellData.labelText, value:tCellData.textbox.value, type:"text", valueStyle:"text-align:right;"+tCellData.inputStyle});
                        }
                    }
                }
                this.setPrintDataFormats(printData, printFormats);
                var printWindow= window.open("/print/printSimpleDocument");                                             //console.log("doPrint printWindow printData=",printData);
                printWindow["printTableContentData"]= printData;
            }
        });
    });


