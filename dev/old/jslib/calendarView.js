
define(["dojo/_base/declare", "dojox/mobile/View","dojox/mobile/Heading", "dojox/mobile/ToolBarButton", "dijit/CalendarLite"],
    function(declare, View, Heading, ToolBarButton, CalendarLite) {
        return declare("CalendarView", [View], {
            heading:null,
            constructor: function(args,parentName){
                declare.safeMixin(this,args);
            },
            postCreate: function(){
                this.hide();
                document.getElementById("body").appendChild(this.domNode);

                this.heading = new Heading({
                    transition: "none",
                    id: "heading",
                    back: "Назад"
                });
                this.addChild(this.heading);

                this.date_picker = new CalendarLite({lang: 'ru',id: "date_picker"});
                this.addChild(this.date_picker);
                this.date_picker.startup();

                var accept_heading = new Heading();
                this.accept_btn = new ToolBarButton({id: "accept_btn", label: "Выбрать",
                    style: "width:75px;align",transition: "none"});
                accept_heading.addChild(this.accept_btn);
                this.addChild(accept_heading);
                accept_heading.startup();

                this.startup();
            },
            setContent: function(parentView, parentDateButton){
                this.heading.set("moveTo", parentView.id);
                this.date_picker.set("value", parentDateButton.dateValue);
                this.accept_btn.set("moveTo", parentView.id);
                var instance= this;
                this.accept_btn.onClick = function () {
                    var selected_date = moment(instance.date_picker.get("value"));
                    parentDateButton.dateValue = selected_date;
                    parentDateButton.set("label", selected_date.format("DD.MM.YYYY"));
                    parentView.loadDetailContent(parentView);
                };
            }
        });
    });