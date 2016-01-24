var TabGroupsManagerOptions=
{
  keyBindFormat:null,
  applyFlag:true,
  onLoad:function(event){
    window.removeEventListener("load",TabGroupsManagerOptions.onLoad,false);
    Components.utils.import("resource://tabgroupsmanager/modules/TabGroupsManager.jsm");
    TabGroupsManagerOptions.makeToolButton();
    setTimeout(function(){TabGroupsManagerOptions.delayInit();},0);
  },
  makeToolButton:function(){
    let dialog=document.getElementById("TabGroupsManagerPrefWindow");
    var _doButtonCommandBak=dialog._doButtonCommand;
    dialog._doButtonCommand=function(aDlgType){
      return this.getButton(aDlgType)?_doButtonCommandBak.apply(this,arguments):true;
    };
    dialog.getButton("extra1").hidden=dialog.getButton("accept").hidden;
    dialog.getButton("extra1").disabled=true;
    let extra2=dialog.getButton("extra2");
    extra2.type="menu";
    extra2.appendChild(document.getElementById("TabGroupsManagerSettingsMenu"));
  },
  delayInit:function(){
    var firefoxAppInfo=Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
    var versionComparator=Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
    var isAfterFirefox35=(versionComparator.compare(firefoxAppInfo.version,"3.1")>0);
    document.getElementById("TabGroupsManagerHideGroupBarByMouseoutTimerTextbox").disabled=!document.getElementById("TabGroupsManagerHideGroupBarByMouseoutCheckbox").checked;
    this.checkSessionStore(isAfterFirefox35);
    this.disableChangeOpenNewGroupOperationChild();
    this.sessionBackupByTimerCountChange();
    this.setKeyBindPage();
    this.tabTreeAnalysisChange();
    this.tabTreeRecordParentAndChildChange();
    this.dispGroupTabCountChange();
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleNormal"));
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleSelected"));
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleUnread"));
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleSuspended"));
    document.getElementById("TabGroupsManagerMoveGroupBeforeWindowCloseMenuitem").hidden=!isAfterFirefox35;
  },
  checkSessionStore:function(isFirefox35){
    if(true==document.getElementById("browserSessionstoreEnabled").value || isFirefox35){
      document.getElementById("TabGroupsManagerDisableSessionStoreGroupbox").hidden=true;
      document.getElementById("TabGroupsManagerSessionBackupSetting").hidden=false;
    }else{
      document.getElementById("TabGroupsManagerDisableSessionStoreGroupbox").hidden=false;
      document.getElementById("TabGroupsManagerSessionBackupSetting").hidden=true;
    }
  },
  hideGroupBarByMouseoutOnCommand:function(){
    document.getElementById("TabGroupsManagerHideGroupBarByMouseoutTimerTextbox").disabled=!document.getElementById("TabGroupsManagerHideGroupBarByMouseoutCheckbox").checked;
  },
  openNewGroupOperationOnCommand:function(){
    document.getElementById("TabGroupsManagerOpenNewGroupByShift").value=document.getElementById("TabGroupsManagerOpenNewGroupOperationCheckbox").checked;
    document.getElementById("TabGroupsManagerUseSearchPlugin").value=document.getElementById("TabGroupsManagerOpenNewGroupOperationCheckbox").checked;
    this.disableChangeOpenNewGroupOperationChild();
  },
  sessionBackupByTimerCountChange:function(){
    document.getElementById("TabGroupsManagerSessionBackupByTimerIntervalTextbox").disabled=document.getElementById("TabGroupsManagerSessionBackupByTimerCount").value<=0;
  },
  disableChangeOpenNewGroupOperationChild:function(){
    var openNewGroupOperation=document.getElementById("TabGroupsManagerOpenNewGroupOperationCheckbox").checked;
    var useSearchPlugin=document.getElementById("TabGroupsManagerUseSearchPluginCheckbox").checked;
    var disabled1=!openNewGroupOperation;
    var disabled2=!(openNewGroupOperation&&useSearchPlugin);
    document.getElementById("TabGroupsManagerOpenNewGroupByShiftCheckbox").disabled=disabled1;
    document.getElementById("TabGroupsManagerUseSearchPluginCheckbox").disabled=disabled1;
    document.getElementById("TabGroupsManagerSearchNoneSupKeyMenu").disabled=disabled2;
    document.getElementById("TabGroupsManagerSearchCtrlMenu").disabled=disabled2;
    document.getElementById("TabGroupsManagerSearchShiftMenu").disabled=disabled2;
    document.getElementById("TabGroupsManagerSearchCtrlShiftMenu").disabled=disabled2;
    document.getElementById("TabGroupsManagerSearchMClickMenu").disabled=disabled2;
    document.getElementById("TabGroupsManagerDefaultSearchPluginButton").disabled=disabled2;
  },
  restoreDefaultSearchPlugin:function(){
    TabGroupsManagerJsm.searchPlugins.searchPluginSettingChange(true);
  },
  setKeyBindPage:function(){
    var keyBindStrings=document.getElementById("TabGroupsManagerStringsKeyBind");
    var menupopup=document.getElementById("TabGroupsManagerKeyBindCommandMenupopup");
    this.keyBindFormat=new Array();
    for(let i=0;true;i++){
      try
      {
        var oneData=JSON.parse(keyBindStrings.getString("keyBind"+i));
        if(oneData.menuseparator){
          menupopup.appendChild(document.createElement("menuseparator"));
        }else{
          this.keyBindFormat.push(oneData);
          var menuitem=document.createElement("menuitem");
          menuitem.setAttribute("label",oneData.title);
          menuitem.setAttribute("tooltiptext",oneData.title);
          menuitem.data=this.keyBindFormat[this.keyBindFormat.length-1];
          menuitem.addEventListener("command",function(event){TabGroupsManagerOptions.selectKeyBindCommand(event)},false);
          menupopup.appendChild(menuitem);
        }
      }
      catch(e){
        break;
      }
    }
    this.setKeyBindListBox(document.getElementById("TabGroupsManagerKeyBindJson").value);
  },
  selectKeyBindCommand:function(event){
    let paramArea=document.getElementById("TabGroupsManagerKeyBindCommandParam");
    for(let i=0;i<paramArea.childNodes.length;i++){
      paramArea.removeChild(paramArea.childNodes[i]);
    }
    let param=event.target.data.param;
    if(param){
      let params=param.split(/\%/);
      for(let i=0;i<params.length;i++){
        if(params[i]!=""){
          if(params[i].match(/.*d ?$/)){
            let element=document.createElement("textbox");
            element.setAttribute("type","number");
            if(params[i].match(/s([0-9]+)/i))element.setAttribute("size",RegExp.$1);
            if(params[i].match(/([0-9]+)-/i))element.setAttribute("min",RegExp.$1);
            if(params[i].match(/-([0-9]+)/i))element.setAttribute("max",RegExp.$1);
            if(params[i].match(/=([0-9]+)/i))element.setAttribute("value",RegExp.$1);
            paramArea.appendChild(element);
          }
        }
      }
    }
  },
  setKeyBindListBox:function(jsonText){
    var keyBind=JSON.parse(jsonText);
    var listbox=document.getElementById("TabGroupsManagerKeyBindListbox");
    for(var i=listbox.itemCount-1;i>=0;i--){
      listbox.removeItemAt(i);
    }
    for(var i=0;i<keyBind.length;i++){
      let key=keyBind[i][0];
      let code=keyBind[i][1];
      let params=null;
      if(keyBind[i].length>2){
        params=new Array();
        for(let j=2;j<keyBind[i].length;j++){
          params.push(keyBind[i][j]);
        }
      }
      var data=null;
      for(var j=0;j<this.keyBindFormat.length;j++){
        if(this.keyBindFormat[j].code==code){
          data=this.keyBindFormat[j];
          break;
        }
      }
      this.addKeyBindToList(data,key,params);
    }
  },
  setShortcutKey:function(event){
    var key="";
    for(var i in event){
      if(0==i.indexOf("DOM_VK")){
        if(event[i]==event.keyCode){
          key=i;
          break;
        }
      }
    }
    if(key.length==8){
      key=key.substr(7,1);
    }else if(0==key.indexOf("DOM_VK_NUMPAD")){
      key=key.substr(13,1);
    }else if(key=="DOM_VK_SHIFT" || key=="DOM_VK_CONTROL" || key=="DOM_VK_ALT" || key=="DOM_VK_META"){
      key="";
    }else{
      key=key.substr(7);
    }
    var modifiers="";
    if(event.ctrlKey)modifiers+="c ";
    if(event.shiftKey)modifiers+="s ";
    if(event.altKey)modifiers+="a ";
    if(event.metaKey)modifiers+="m ";
    var data=modifiers+"| "+key;
    event.currentTarget.setAttribute("value",data);
  },
  addKeyBind:function(){
    let menulist=document.getElementById("TabGroupsManagerKeyBindCommandMenulist");
    let data=menulist.selectedItem.data;
    var key=document.getElementById("TabGroupsManagerKeyBindShortcutKeyTextbox").value;
    if(data==null){
      alert(document.getElementById("TabGroupsManagerStringsKeyBind").getString("keyBindCommandAlertMessage"));
      return;
    }
    var keySplit=key.split(/ *\| */);
    if(keySplit.length<2 || keySplit[1]==""){
      alert(document.getElementById("TabGroupsManagerStringsKeyBind").getString("keyBindKeyAlertMessage"));
      return;
    }
    var listbox=document.getElementById("TabGroupsManagerKeyBindListbox");
    for(var i=listbox.itemCount-1;i>=0;i--){
      var item=listbox.getItemAtIndex(i);
      if(item.childNodes.length>0&&item.childNodes[2].getAttribute("label")==key){
        listbox.removeItemAt(i);
      }
    }
    let params=null;
    let paramArea=document.getElementById("TabGroupsManagerKeyBindCommandParam");
    if(paramArea.childNodes.length>0){
      params=new Array();
      for(let i=0;i<paramArea.childNodes.length;i++){
        let param=paramArea.childNodes[i].type=="number"?paramArea.childNodes[i].valueNumber:paramArea.childNodes[i].value;
        params.push(param);
      }
    }
    this.addKeyBindToList(data,key,params);
    this.keyBindListboxToJson();
  },
  deleteKeyBind:function(){
    var listbox=document.getElementById("TabGroupsManagerKeyBindListbox");
    if(-1<listbox.selectedIndex){
      var tmp=listbox.selectedIndex;
      listbox.removeItemAt(tmp);
      listbox.selectedIndex=(tmp<listbox.itemCount)?tmp:listbox.itemCount-1;
    }
    this.keyBindListboxToJson();
  },
  allDeleteKeyBind:function(){
    var keyBindPreference=document.getElementById("TabGroupsManagerKeyBindJson");
    if(keyBindPreference.hasUserValue){
      keyBindPreference.value="[]";
    }
    this.setKeyBindListBox(document.getElementById("TabGroupsManagerKeyBindJson").value);
  },
  recommendKeyBind:function(){
    var jsonText=document.getElementById("TabGroupsManagerStringsKeyBind").getString("keybindRecommend1");
    document.getElementById("TabGroupsManagerKeyBindJson").value=jsonText;
    this.setKeyBindListBox(jsonText);
  },
  recommend2KeyBind:function(){
    var jsonText=document.getElementById("TabGroupsManagerStringsKeyBind").getString("keybindRecommend2");
    document.getElementById("TabGroupsManagerKeyBindJson").value=jsonText;
    this.setKeyBindListBox(jsonText);
    document.getElementById("TabGroupsManagerKeyBindOverride").value=true;
  },
  addKeyBindToList:function(data,key,params){
    let parent=document.getElementById("TabGroupsManagerKeyBindListbox");
    var listitem=document.createElement("listitem");
    listitem.data=data;
    listitem.params=params;
    listitem.appendChild(document.createElement("listcell")).setAttribute("label",data.title);
    let paramItem=listitem.appendChild(document.createElement("listcell"));
    if(params){
       paramItem.setAttribute("label",params.toString());
    }
    listitem.appendChild(document.createElement("listcell")).setAttribute("label",key);
    listitem.data=data;
    parent.appendChild(listitem);
  },
  keyBindListboxToJson:function(){
    var keyBind=new Array();
    var listbox=document.getElementById("TabGroupsManagerKeyBindListbox");
    for(var i=0;i<listbox.itemCount;i++){
      var item=listbox.getItemAtIndex(i);
      if(item.data){
        let obj=[item.childNodes[2].getAttribute("label"),item.data.code];
        if(item.params){
          for(let j=0;j<item.params.length;j++){
            obj.push(item.params[j]);
          }
        }
        keyBind.push(obj);
      }
    }
    document.getElementById("TabGroupsManagerKeyBindJson").value=JSON.stringify(keyBind);
  },
  tabTreeAnalysisChange:function(){
    var tmp=!document.getElementById("TabGroupsManagerTabTreeAnalysis").value;
    document.getElementById("TabGroupsManagerTabTreeOpenTabByExternalApplicationCheckBox").disabled=tmp;
    document.getElementById("TabGroupsManagerTabTreeOpenTabByJavaScriptCheckBox").disabled=tmp;
    document.getElementById("TabGroupsManagerTabTreeRecordParentAndChildCheckBox").disabled=tmp;
    if(tmp){
      document.getElementById("TabGroupsManagerTabTreeOpenTabByExternalApplication").value=false;
      document.getElementById("TabGroupsManagerTabTreeOpenTabByJavaScript").value=false;
      document.getElementById("TabGroupsManagerTabTreeRecordParentAndChild").value=false;
    }
  },
  tabTreeRecordParentAndChildChange:function(){
    var tmp=!document.getElementById("TabGroupsManagerTabTreeRecordParentAndChild").value;
    document.getElementById("TabGroupsManagerTabTreeDisplayParentAndChildCheckBox").disabled=tmp;
    document.getElementById("TabGroupsManagerTabTreeFocusTabByParentAndChildCheckBox").disabled=tmp;
    if(tmp){
      document.getElementById("TabGroupsManagerTabTreeDisplayParentAndChild").value=false;
      document.getElementById("TabGroupsManagerTabTreeFocusTabByParentAndChild").value=false;
    }
  },
  dispGroupTabCountChange:function(){
    var tmp=document.getElementById("TabGroupsManagerDispGroupTabCount").value;
    document.getElementById("TabGroupsManagerDispGroupTabCountReadingCheckbox").disabled=!tmp
  },
  useGroupStyle:function(event){
    event.target.nextSibling.childNodes[0].disabled=!event.target.checked;
    event.target.nextSibling.childNodes[1].disabled=!event.target.checked ||!event.target.nextSibling.childNodes[0].checked;
    event.target.nextSibling.childNodes[2].disabled=!event.target.checked;
    event.target.nextSibling.childNodes[3].disabled=!event.target.checked ||!event.target.nextSibling.childNodes[2].checked;
    event.target.nextSibling.childNodes[4].disabled=!event.target.checked;
    event.target.nextSibling.childNodes[5].disabled=!event.target.checked;
    event.target.nextSibling.nextSibling.disabled=!event.target.checked;
    event.target.nextSibling.nextSibling.nextSibling.disabled=!event.target.checked;
    if(!event.target.checked){
      document.getElementById(event.target.previousSibling.getAttribute("preference")).value="";
    }else if(document.getElementById(event.target.previousSibling.getAttribute("preference")).value==""){
      this.makeGroupsStyleText(event.target.parentNode);
    }
  },
  useGroupStyleUseColor:function(event){
    event.target.nextSibling.disabled=!event.target.checked;
    this.makeGroupsStyleText(event.target.parentNode.parentNode);
  },
  groupStylePartChange:function(event){
    this.makeGroupsStyleText(event.target.parentNode.parentNode);
  },
  selectedGroupStyleAdvance:function(event){
    if(!event.target.checked){
      this.makeGroupsStyleText(event.target.parentNode);
    }
    event.target.previousSibling.previousSibling.hidden=event.target.checked;
    event.target.previousSibling.hidden=!event.target.checked;
  },
  editGroupStyle:function(event){
    var pref=document.getElementById(event.target.parentNode.childNodes[0].getAttribute("preference"));
    var tmp=window.prompt(event.target.label,pref.value);
    if(tmp){
      pref.value=tmp;
    }
  },
  makeGroupsStyleText:function(parent){
    var src=parent.childNodes[2];
    var dest=document.getElementById(parent.childNodes[0].getAttribute("preference"));
    var text="";
    if(src.childNodes[0].checked){
      text+="color: "+src.childNodes[1].color+" !important; "
    }
    if(src.childNodes[2].checked){
      text+="background-color: "+src.childNodes[3].color+" !important; "
    }
    text+="font-weight: "+(src.childNodes[4].checked?"bold":"normal")+" !important; "
    text+="font-style: "+(src.childNodes[5].checked?"italic":"normal")+" !important; "
    dest.value=text;
  },
  makeStyleCheckboxEtc:function(parent){
    var src=document.getElementById(parent.childNodes[0].getAttribute("preference"));
    var dest=parent.childNodes[2];
    if(!src.value){
      parent.childNodes[1].checked=false;
      parent.childNodes[1].doCommand();
      return;
    }else if(src.value.match(/^(?:color: ([^;]+?) \!important; *| *)(?:background-color: ([^;]+?) \!important; *| *)(?:font-weight: ([^;]+?) \!important; *| *)(?:font-style: ([^;]+?) \!important; *| *)$/)){
      if(RegExp.$1){
        dest.childNodes[0].checked=true;
        dest.childNodes[1].color=RegExp.$1;
      }else{
        dest.childNodes[0].checked=false;
        dest.childNodes[1].color="#000000";
      }
      if(RegExp.$2){
        dest.childNodes[2].checked=true;
        dest.childNodes[3].color=RegExp.$2;
      }else{
        dest.childNodes[2].checked=false;
        dest.childNodes[3].color="#c0c0c0"
      }
      dest.childNodes[4].checked=(RegExp.$3=="bold");
      dest.childNodes[5].checked=(RegExp.$4=="italic");
      parent.childNodes[1].checked=true;
      parent.childNodes[1].doCommand();
    }else{
      parent.childNodes[4].checked=true;
      parent.childNodes[4].doCommand();
      parent.childNodes[1].checked=true;
      parent.childNodes[1].doCommand();
    }
  },
  defaultGroupStyle:function(event){
    document.getElementById("TabGroupsManagerNormalGroupStyle").value="";
    document.getElementById("TabGroupsManagerSelectedGroupStyle").value="font-weight: bold !important; font-style: normal !important; ";
    document.getElementById("TabGroupsManagerUnreadGroupStyle").value="color: #0000ff !important; font-weight: bold !important; font-style: normal !important; ";
    document.getElementById("TabGroupsManagerSuspendedGroupStyle").value="color: #C0C0C0 !important; background-color: #333333 !important; font-weight: normal !important; font-style: normal !important; ";
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleNormal"));
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleSelected"));
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleUnread"));
    this.makeStyleCheckboxEtc(document.getElementById("TabGroupsManagerGroupStyleSuspended"));
  },
  hideGroupBarByGroupCountButtonCommand:function(){
    var data={old:document.getElementById("TabGroupsManagerHideGroupBarByTabGroupCount").value};
    document.documentElement.openSubDialog("chrome://tabgroupsmanager/content/HideGroupBarDialogBox.xul","chrome,modal,dialog,centerscreen,resizable",data);
    if(data.result!=null){
      document.getElementById("TabGroupsManagerHideGroupBarByTabGroupCount").value=data.result;
    }
  },
  settingsDefault:function(){
    if(window.confirm(document.getElementById("TabGroupsManagerSettingDefaultMessage").value.replace(/\\n/g,"\n"))){
      TabGroupsManagerJsm.globalPreferences.defaultSettings();
      this.repaintSettingsWindow();
      alert(document.getElementById("TabGroupsManagerSettingDefaultAfterMessage").value.replace(/\\n/g,"\n"));
    }
  },
  createFilePickerForSettings:function(mode){
    let nsIFilePicker=Components.interfaces.nsIFilePicker;
    let filePicker=Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    filePicker.init(window,null,mode);
    filePicker.appendFilter(document.getElementById("TabGroupsManagerSettingFile").value+"(*."+TabGroupsManagerJsm.constValues.settingsExt+")","*."+TabGroupsManagerJsm.constValues.settingsExt);
    filePicker.appendFilters(nsIFilePicker.filterAll);
    filePicker.defaultExtension="*."+TabGroupsManagerJsm.constValues.settingsExt;
    filePicker.defaultString="TabGroupsManagerSettings.tgms";
    return filePicker;
  },
  settingsExport:function(){
    let nsIFilePicker=Components.interfaces.nsIFilePicker;
    let filePicker=this.createFilePickerForSettings(nsIFilePicker.modeSave);
    switch(filePicker.show()){
      case nsIFilePicker.returnOK:
      case nsIFilePicker.returnReplace:
        let file=new TabGroupsManagerJsm.NsIFileWrapper(filePicker.file);
        TabGroupsManagerJsm.globalPreferences.exportSettings(file);
      break;
    }
  },
  settingsImport:function(){
    let nsIFilePicker=Components.interfaces.nsIFilePicker;
    let filePicker=this.createFilePickerForSettings(nsIFilePicker.modeOpen);
    switch(filePicker.show()){
      case nsIFilePicker.returnOK:
        let file=new TabGroupsManagerJsm.NsIFileWrapper(filePicker.file);
        if(TabGroupsManagerJsm.globalPreferences.importSettings(file)){
          this.repaintSettingsWindow();
          alert(document.getElementById("TabGroupsManagerSettingImportSuccessMessage").value.replace(/\\n/g,"\n"));
        }else{
          alert(document.getElementById("TabGroupsManagerSettingImportFailMessage").value.replace(/\\n/g,"\n"));
        }
      break;
    }
  },
  onApplyButton:function(event){
    let dialog=document.getElementById("TabGroupsManagerPrefWindow");
    dialog.getButton("extra1").disabled=true;
    this.applyFlag=false;
    try
    {
      dialog.acceptDialog();
    }
    finally
    {
      this.applyFlag=true;
    }
  },
  onDialogAccept:function(event){
    return this.applyFlag;
  },
  onDialogChange:function(event){
    let dialog=document.getElementById("TabGroupsManagerPrefWindow");
    dialog.getButton("extra1").disabled=false;
  },
  repaintSettingsWindow:function(){
    window.openDialog("chrome://tabgroupsmanager/content/options.xul","TabGroupsManagerSettingsWindow","chrome,titlebar,toolbar,centerscreen");
  },
};
window.addEventListener("load",TabGroupsManagerOptions.onLoad,false);