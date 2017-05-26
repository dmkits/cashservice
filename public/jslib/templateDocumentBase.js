/**
 * Created by dmkits on 16.02.17.
 */
define(["dojo/_base/declare", "dijit/layout/BorderContainer", "dijit/layout/LayoutContainer", "dijit/layout/ContentPane",
        "dijit/form/Button","dijit/form/TextBox","dijit/form/DateTextBox","dijit/form/NumberTextBox", "dojo/dom-style"],
    function(declare, BorderContainer, LayoutContainer, ContentPane, Button, TextBox,DateTextBox,NumberTextBox) {
        return declare("TemplateDocumentBase", [BorderContainer], {
            constructor: function(args,parentName){
                declare.safeMixin(this,args);
                if (this.printFormats === undefined)
                    this.printFormats = {
                        dateFormat:"DD.MM.YY", numericFormat:"#,###,###,###,##0.#########", currencyFormat:"#,###,###,###,##0.00#######"
                    };
            },
            postCreate: function(){
                //TODO actions of create document elements on parent
            },
            setContainer: function(params, style, tagName){
                if (!params) params={};
                if (style) params.style= style;
                var container;
                if (!tagName)
                    container= new LayoutContainer(params);
                else
                    container= new LayoutContainer(params, tagName);
                return container;
            },
            setChildContainer: function(params, style, tagName){
                var container= this.setContainer(params, style, tagName);
                this.addChild(container);
                return container;
            },
            setContentPane: function(params, style, tagName){
                if (!params) params={};
                if (style) params.style= style;
                var contentPane;
                if (!tagName)
                    contentPane= new ContentPane(params);
                else
                    contentPane= new ContentPane(params, tagName);
                return contentPane;
            },
            setChildContentPaneTo: function(parent, params, style){
                var contentPane= this.setContentPane(params, style);
                parent.addChild(contentPane);
                return contentPane;
            },
            setBorderedStyleFor: function(domNode){
                domNode.classList.remove("dijitLayoutContainer-child");
                domNode.classList.add("dijitBorderContainer-child");
                domNode.classList.remove("dijitLayoutContainer-dijitContentPane");
                domNode.classList.add("dijitBorderContainer-dijitContentPane");
                domNode.classList.remove("dijitLayoutContainerPane");
                domNode.classList.add("dijitBorderContainerPane");
            },
            //createTopContentPane: function(){
            //
            //},

            addTableTo: function(node, style){
                var table = document.createElement("table");
                if (!style) style="";
                table.setAttribute("style","width:100%;height:100%;"+style);
                node.appendChild(table);
                var tableBody = document.createElement("tbody");
                table.appendChild(tableBody);
                return tableBody;
            },
            addRowToTable: function(table,height,style){
                var tableRow = document.createElement("tr");
                if (height!=undefined) tableRow.setAttribute("height", height);
                if (!style) style="";
                style= "white-space:nowrap;"+style;
                tableRow.setAttribute("style", style);
                table.appendChild(tableRow);
                return tableRow;
            },
            addHeaderCellToTableRow: function(tableRow, content, style) {
                var tableCell = document.createElement("th");
                if (!style) style="";
                style= "white-space:nowrap;"+style;
                tableCell.setAttribute("style", style);
                tableRow.appendChild(tableCell);
                if (content) tableCell.innerHTML= content;
                return tableCell;
            },
            //addCellFromLeftToTableRow: function(tableRow){
            //    if (tableRow.children.length===0) {
            //        var tableCell100p = document.createElement("td");
            //        tableCell100p.setAttribute("width", "100%");
            //        tableRow.appendChild(tableCell100p);
            //    }
            //    var tableCell = document.createElement("td");
            //    tableCell.setAttribute("style", "white-space:nowrap;");
            //    tableRow.insertBefore(tableCell, tableRow.lastChild);
            //    return tableCell;
            //},
            addLeftCellToTableRow: function(tableRow, width, style){
                if (tableRow.children.length===0) {
                    var tableCellEmpty = document.createElement("td");
                    tableRow.appendChild(tableCellEmpty);
                }
                var tableCell = document.createElement("td");
                if (width!=undefined) tableCell.setAttribute("width", width+"px");
                if (!style) style="";
                tableCell.setAttribute("style", "white-space:nowrap;"+style);                                           //console.log("addLeftCellToTableRow ",style);
                tableRow.insertBefore(tableCell, tableRow.lastChild);
                return tableCell;
            },

            /*
             * params= {labelText, cellWidth, cellStyle, btnStyle, btnParameters}
             */
            addTableCellButtonTo: function(tableRowNode, params){
                var tableCell = this.addLeftCellToTableRow(tableRowNode, params.cellWidth, params.cellStyle);
                var btnParameters={};
                if (params.btnParameters) btnParameters=params.btnParameters;
                if (params.labelText) btnParameters.label=params.labelText;
                var button = new Button(btnParameters);
                var btnStyle="";
                if (params.btnStyle) btnStyle=params.btnStyle;
                var existsStyle=button.domNode.firstChild.getAttribute("style");
                if (existsStyle) btnStyle=existsStyle+btnStyle;
                button.domNode.firstChild.setAttribute("style",btnStyle);
                tableCell.appendChild(button.domNode);
                return button;
            },
            createInputTo: function(parent, label, labelStyle){
                var labelTag;
                if (label){
                    labelTag = document.createElement("label");
                    labelTag.innerText=label+" ";
                    if (labelStyle) labelTag.setAttribute("style",labelStyle);
                    parent.appendChild(labelTag);
                }
                var tag = document.createElement("input");
                //if (label) labelTag.setAttribute("for",tag.getAttribute("id"));
                parent.appendChild(tag);
                return tag;
            },
            /*
             * params= {labelText,labelStyle, inputStyle, cellWidth,cellStyle, initValueText, inputParams}
             */
            addTableCellTextBoxTo: function(tableRowNode, params){
                if (!params) params={};
                var tableCell = this.addLeftCellToTableRow(tableRowNode, params.cellWidth, params.cellStyle);
                var inputTextBox= this.createInputTo(tableCell, params.labelText, params.labelStyle);
                var textBoxParams={};
                if (params.inputParams) textBoxParams=params.inputParams;
                if (params.initValueText!==undefined) textBoxParams.value=params.initValueText;
                if (params.inputStyle!==undefined) textBoxParams.style=params.inputStyle;
                return new TextBox(textBoxParams,inputTextBox);
            },
            /*
             * params= {labelText,labelStyle, inputStyle, cellWidth,cellStyle, initValueDate, inputParams}
             */
            addTableCellDateBoxTo: function(tableRowNode, params){
                if (!params) params={};
                var tableCell = this.addLeftCellToTableRow(tableRowNode, params.cellWidth, params.cellStyle);
                var inputDateBox= this.createInputTo(tableCell, params.labelText, params.labelStyle);
                var dateBoxParams={};
                if (params.inputParams) dateBoxParams=params.inputParams;
                if (params.initValueDate!==undefined) dateBoxParams.value= params.initValueDate;
                dateBoxParams.style= "width:85px";
                if (params.inputStyle) dateBoxParams.style=params.inputStyle;
                return new DateTextBox(dateBoxParams,inputDateBox);
            },
            /*
             * params= {cellWidth, cellStyle, labelText, labelStyle, inputParam, inputStyle, initValues}
             */
            addTableCellNumberTextBoxTo: function(tableRowNode, params){
                if (!params) params={};
                var tableCell = this.addLeftCellToTableRow(tableRowNode, params.cellWidth, params.cellStyle);
                var inputNumberTextBox= this.createInputTo(tableCell, params.labelText, params.labelStyle);
                var numberTextBoxParams={};
                if (params.inputParams) numberTextBoxParams=params.inputParams;
                if (params.initValue!==undefined) numberTextBoxParams.value= params.initValue;
                if (params.inputStyle) numberTextBoxParams.style=params.inputStyle;
                return new NumberTextBox(numberTextBoxParams,inputNumberTextBox);
            },
            /*
             * params { style, newTable:true/false }
             */
            addPrintDataItemTo: function(printData, sectionName, params){
                if (!printData[sectionName]) printData[sectionName]=[];
                var sectionItems= printData[sectionName];
                var sectionItemData={items:[]};
                if (params&&params.style) sectionItemData["style"]= params.style;
                if (params&&params.newTable) sectionItemData["newTable"]= params.newTable;
                sectionItems.push(sectionItemData);
                return printData;
            },
            /*
             * params { width, style, contentStyle, label, labelStyle, value, type, valueStyle, printFormat }
             */
            addPrintDataSubItemTo: function(printData, sectionName, params){
                if (!printData[sectionName]) printData[sectionName]=[];
                var sectionData= printData[sectionName];
                if (sectionData.length==0) sectionData.push({items:[]});
                var sectionSubItems= sectionData[sectionData.length-1].items;
                var printDataItem= {};
                if (!params){
                    sectionSubItems.push(printDataItem);
                    return printDataItem;
                }
                if (params.style!==undefined) printDataItem["style"]= params.style;
                if (params.width!==undefined) printDataItem["width"]= params.width;
                if (params.contentStyle!==undefined) printDataItem["contentStyle"]= params.contentStyle;
                if (params.label!==undefined) printDataItem["label"]= params.label;
                if (params.labelStyle!==undefined) printDataItem["labelStyle"]= params.labelStyle;
                if (params.value!==undefined) printDataItem["value"]= params.value;
                if (params.type!==undefined) printDataItem["type"]= params.type;
                if (params.valueStyle!==undefined) printDataItem["valueStyle"]= params.valueStyle;
                if (params.printFormat!==undefined) printDataItem["printFormat"]= params.printFormat;
                sectionSubItems.push(printDataItem);
            },
            /*
             * printFormats = { dateFormat:"DD.MM.YY", numericFormat:"#,###,###,###,##0.#########", currencyFormat:"#,###,###,###,##0.00#######" }
             */
            setPrintDataFormats: function(printData, printFormats){
                if (!printData) return;
                if (!printFormats) printFormats= this.printFormats;
                if (printData.columns){
                    for(var colIndex in printData.columns){
                        var colData= printData.columns[colIndex];
                        if(!colData.type||colData.type==="text"||colData.format||colData.printFormat) continue;
                        if (colData.type==="date"&&printFormats.dateFormat) colData.printFormat= printFormats.dateFormat;
                        if (colData.type==="numeric"&&printFormats.numericFormat) colData.printFormat= printFormats.numericFormat;
                        if (colData.type==="currency"&&printFormats.currencyFormat) colData.printFormat= printFormats.currencyFormat;
                        //if (printFormats.dateFormat&&colData.type==="text"&&colData.dateFormat) colData.dateFormat= printFormats.dateFormat;
                    }
                }
            }
        })
    });
