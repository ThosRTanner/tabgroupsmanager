
var EXPORTED_SYMBOLS=["AxelUtils"];

var AxelUtils={};
AxelUtils.setTimeoutDelegator=
{
  exec:function(execWindow,object,func,time,arg){
    var data={object:object,func:func,arg:arg};
    execWindow.setTimeout(this.delegate,time,data);
  },
  delegate:function(data){
    data.func.apply(data.object,data.arg);
  },
};

/* replace callers with 
const { clearTimeout, setTimeout } = Components.utils.import(
  "resource://gre/modules/Timer.jsm",
  {}
);
and bind
*/