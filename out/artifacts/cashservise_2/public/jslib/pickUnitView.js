/**
 * Created by ianagez on 30.12.2016.
 */
define(["dojo/_base/declare","dojox/mobile/View","dojox/mobile/Heading", "dojox/mobile/RoundRectList", "dojox/mobile/ToggleButton","dojox/mobile/ListItem",
        "dojox/mobile/ToolBarButton"],
    function(declare, View, Heading, RoundRectList, ToggleButton,ListItem, ToolBarButton){
        return declare("PickUnitView", [View], {
            heading:null,
            constructor: function (args, parentName) {
                declare.safeMixin(this, args);
            },
            postCreate: function(){
                this.hide();
                document.getElementById('body').appendChild(this.domNode);
                this.heading=new Heading({
                    transition: "none",
                    label: "Выберите филиал",
                    back: "Назад"
                });
                this.addChild(this.heading);
                this.heading.startup();

                this.accept_heading = new Heading({});
                this.confirmBtn = new ToolBarButton({
                        transition: "none",
                        label: "Выбрать"
                });
                this.addChild(this.accept_heading);
                this.accept_heading.addChild(this.confirmBtn);
                this.accept_heading.startup();
                this.startup();
            },
            setContent:function(btn, parentView){
                this.heading.set("moveTo", parentView.id);
                this.listUnitButtons = [];
                var data;

                if (this.list_of_units) this.list_of_units.destroy();
                this.list_of_units = new RoundRectList({
                    style: "background-color:white",
                    "id": parentView.id + "list_of_units"
                });
                this.addChild(this.list_of_units,1);
                this.list_of_units.startup();
                data = btn.units_data;

                for (var i in data) {
                    var dataItem = data[i];
                    var tooggleBtn = new ToggleButton({
                        label: dataItem.short_name,
                        style: "font-size: 1em; width:100px; text-align:left"
                    });
                    tooggleBtn.unit_id = dataItem.id;
                    var item = new ListItem({
                        preventTouch: true,
                        innerHTML: " " + dataItem.name,
                        style: "background-color:white"
                    });
                    for (var s = 0; s < btn.selected_units.length; s++) {
                        if (tooggleBtn.unit_id == btn.selected_units[s].id) tooggleBtn.set("checked", true);
                    }
                    this.list_of_units.addChild(item);
                    this.listUnitButtons[i] = tooggleBtn;
                    item.addChild(tooggleBtn, 0);
                }
                this.confirmBtn.parentBtn = btn;
                var instance=this;
                this.confirmBtn.onClick = function () {
                    var selected_units = [], string_units;
                    var d = 0;
                    for (var j = 0; j < instance.listUnitButtons.length; j++) {
                        var dataItem = data[j];
                        if (instance.listUnitButtons[j].get("checked") == true) {
                            string_units = (!string_units) ? dataItem.short_name : string_units + " | " + dataItem.short_name;
                            selected_units[d] = dataItem;
                            d++;
                        }
                    }
                    if (selected_units.length > 0) {
                        this.parentBtn.selected_units = selected_units;
                        this.parentBtn.set("label", string_units);
                        instance.confirmBtn.set("moveTo", parentView.id);
                        parentView.loadDetailContent(parentView);
                    } else
                        instance.confirmBtn.set("moveTo", null);
                };
            }
        });
        }
    );