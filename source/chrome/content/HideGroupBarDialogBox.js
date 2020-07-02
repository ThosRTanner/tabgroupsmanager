var TabGroupsManagerHideGroupBarDialogBox=
{
  data:null,
  initialize:function(event){
    this.data=window.arguments[0];
    let hideGroupBarWhenOneTab=document.getElementById("hideGroupBarWhenOneTab");
    let hideGroupBarWhenOneGroup=document.getElementById("hideGroupBarWhenOneGroup");
    let hideGroupBarWhenOneTabWithMultipleFirefox=document.getElementById("hideGroupBarWhenOneTabWithMultipleFirefox");
    let hideGroupBarWhenOneGroupWithMultipleFirefox=document.getElementById("hideGroupBarWhenOneGroupWithMultipleFirefox");
    let hideGroupBarTabBarWhenOneTabWithMultipleFirefox=document.getElementById("hideGroupBarTabBarWhenOneTabWithMultipleFirefox");
    if(this.data.old&1)hideGroupBarWhenOneTab.checked=true;
    if(this.data.old&2)hideGroupBarWhenOneGroup.checked=true;
    if(this.data.old&4)hideGroupBarWhenOneTabWithMultipleFirefox.checked=true;
    if(this.data.old&8)hideGroupBarWhenOneGroupWithMultipleFirefox.checked=true;
    if(this.data.old&16)hideGroupBarTabBarWhenOneTabWithMultipleFirefox.checked=true;
  },
  doOK:function(event){
    let hideGroupBarWhenOneTab=document.getElementById("hideGroupBarWhenOneTab");
    let hideGroupBarWhenOneGroup=document.getElementById("hideGroupBarWhenOneGroup");
    let hideGroupBarWhenOneTabWithMultipleFirefox=document.getElementById("hideGroupBarWhenOneTabWithMultipleFirefox");
    let hideGroupBarWhenOneGroupWithMultipleFirefox=document.getElementById("hideGroupBarWhenOneGroupWithMultipleFirefox");
    let hideGroupBarTabBarWhenOneTabWithMultipleFirefox=document.getElementById("hideGroupBarTabBarWhenOneTabWithMultipleFirefox");
    this.data.result=0;
    if(hideGroupBarWhenOneTab.checked)this.data.result |=1;
    if(hideGroupBarWhenOneGroup.checked)this.data.result |=2;
    if(hideGroupBarWhenOneTabWithMultipleFirefox.checked)this.data.result |=4;
    if(hideGroupBarWhenOneGroupWithMultipleFirefox.checked)this.data.result |=8;
    if(hideGroupBarTabBarWhenOneTabWithMultipleFirefox.checked)this.data.result |=16;
    return true;
  },
  doCancel:function(event){
    this.data.result=null;
    return true;
  },
};