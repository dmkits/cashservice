/**
 * Created by ianagez on 15.02.2017.
 */
define(["dijit/registry"],
    function (registry) {
        return {
            /**
             * Inited DOJO element for HTML element
             * @param registry
             * @param ID
             * @param htmlElemName
             * @param Class
             * @param Params
             * @returns {*}
             */
            initElem: function (htmlElemName, Class, Params) {      console.log("initElem");
                var Object = null;
                if (registry!=null) Object = registry.byId(htmlElemName);
                if (Object==null) {
                    Params.id = htmlElemName;
                    Object = new Class(Params, htmlElemName);
                }
                return Object;
            },
            /**
             * Inited DOJO child element for DOJO parent element
             * @param registry
             * @param ID
             * @param Parent
             * @param Class
             * @param Params
             * @returns {*}
             */
            initChildTo: function (Parent, ID, Class, Params) {
                var Object = null;
                if (registry!=null) Object = registry.byId(ID);
                if (Object==null) {
                    Params.id = ID;
                    Object = new Class(Params);
                    if (Parent!=null) Parent.addChild(Object);
                }
                return Object;
            },

            doDialogMsg: function (params){
                //dialog msg
            },
            doRequestErrorDialog: function (){
                this.doDialogMsg({title:"Внимание",content:"Невозможно завершить операцию! <br>Нет всязи с сервером!",
                    style:"width:300px;", btnOkLabel:"OK", btnCancelLabel:"Закрыть"});
            },

            today: function (){
                return moment().toDate();
            },
            curMonthBDate: function (){
                return moment().startOf('month').toDate();
            },
            curMonthEDate: function (){
                return moment().endOf('month').toDate();
            }
        }
    });
