var EXPORTED_SYMBOLS=["TabGroupsManagerJsm"];

//The paths for all devtools JS modules have changed to resource://devtools/*.
//See https://bugzil.la/1203159 for more information.
Components.utils.import("resource://gre/modules/devtools/Console.jsm");
//var {PrivateBrowsingUtils} = Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

var TabGroupsManagerJsm=
{
  constValues:
  {
    sessionDataExt:"tgm",
    sessionDataType:"TabGroupsManager:SaveData",
    sessionDataExt2:"tgm2",
    sessionDataType2:"TabGroupsManager:SaveData:version 2.0",
    groupDataExt:"tgmg",
    groupDataType:"TabGroupsManager:GroupData",
    settingsExt:"tgms",
    settingsType:"TabGroupsManager:Settings"
  },
  folderLocation:null,
  globalPreferences:null,
  applicationStatus:null,
  utils:null,
  saveData:null,
  privateBrowsing:null,
  quitApplicationObserver:null
};
TabGroupsManagerJsm.initialize=function(){
  try
  {
    this.globalPreferences=new this.GlobalPreferences();
    this.folderLocation=new this.FolderLocation();
    this.applicationStatus=new this.ApplicationStatus();
    this.utils=new this.Utils();
    this.saveData=new this.SaveData();
    this.searchPlugins=new this.SearchPlugins();
    this.privateBrowsing=new this.PrivateBrowsing();
    this.quitApplicationObserver=new this.QuitApplicationObserver();
  }
  catch(e){
    alertErrorIfDebug(e,"TabGroups Manager: code module initialize error");
  }
};
TabGroupsManagerJsm.finalize=function(){
  this.quitApplicationObserver.destructor();
  this.globalPreferences.finalize();
};
TabGroupsManagerJsm.Utils=function(){
};
TabGroupsManagerJsm.Utils.prototype.formatNumberLength=function(text,length,char){
  text+="";
  for(var i=text.length;i<length;i++){
    text=char+text;
  }
  return text;
};
TabGroupsManagerJsm.GlobalPreferences=function(){
  try
  {
    this.prefService=Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
    this.prefBranch=this.prefService.getBranch("extensions.tabgroupsmanager.");
    this.prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    this.lastSessionFinalized=!this.prefBranch.prefHasUserValue("executing");
    this.prefBranch.setBoolPref("executing",true);
    if(this.prefBranch.prefHasUserValue("groupBarBelow")){
      this.prefBranch.setIntPref("groupBarPosition",2);
    }
    this.convertKeyBindJson();
    this.prefBranch.addObserver("",this,false);
    this.debug=this.prefBranch.getBoolPref("debug");
    this.bookmarkFolderLClick=this.prefBranch.getIntPref("bookmarkFolderLClick");
    this.bookmarkFolderMClick=this.prefBranch.getIntPref("bookmarkFolderMClick");
    this.bookmarkFolderDblClick=this.prefBranch.getIntPref("bookmarkFolderDblClick");
    this.sessionBackupByWindowCloseCount=this.prefBranch.getIntPref("sessionBackupByWindowCloseCount");
    this.sessionBackupByTimerCount=this.prefBranch.getIntPref("sessionBackupByTimerCount");
    this.sessionBackupByTimerInterval=this.prefBranch.getIntPref("sessionBackupByTimerInterval");
    this.windowCloseWhenLastGroupClose=this.prefBranch.getBoolPref("windowCloseWhenLastGroupClose");
    this.suspendWhenFirefoxClose=this.prefBranch.getBoolPref("suspendWhenFirefoxClose");
    this._groupNameRegistered=this.jsonPrefToObject("groupNameRegistered");
    this._groupNameHistory=this.jsonPrefToObject("groupNameHistory");
    this.__defineGetter__("groupNameRegistered",function(){return this._groupNameRegistered;});
    this.__defineGetter__("groupNameHistory",function(){return this._groupNameHistory;});
    this.deletePrefValue("dispButtonOpen");
    this.deletePrefValue("dispButtonSleep");
    this.deletePrefValue("dispButtonClose");
    this.deletePrefValue("sessionBackupEnabled");
    this.deletePrefValue("sessionBackupInProfileFolder");
    this.deletePrefValue("sessionBackupMenu");
    this.deletePrefValue("sessionSaveCount");
    this.deletePrefValue("sessionBackupByGroupSleepCount");
    this.deletePrefValue("overrideTabMixPlusTabBarMethod");
    this.deletePrefValue("groupBarBelow");
  }
  catch(e){
    if(this.debug){
      alertError(e);
    }
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.finalize=function(){
  this.deletePrefValue("executing");
};
TabGroupsManagerJsm.GlobalPreferences.prototype.deletePrefValue=function(pref){
  if(this.prefBranch.prefHasUserValue(pref)){
    this.prefBranch.clearUserPref(pref);
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.observe=function(aSubject,aTopic,aData){
  if(aTopic!="nsPref:changed"){
    return;
  }
  switch(aData){
    case"bookmarkFolderLClick":this.bookmarkFolderLClick=this.prefBranch.getIntPref("bookmarkFolderLClick");break;
    case"bookmarkFolderMClick":this.bookmarkFolderMClick=this.prefBranch.getIntPref("bookmarkFolderMClick");break;
    case"bookmarkFolderDblClick":this.bookmarkFolderDblClick=this.prefBranch.getIntPref("bookmarkFolderDblClick");break;
    case"sessionBackupByWindowCloseCount":
      this.sessionBackupByWindowCloseCount=this.prefBranch.getIntPref("sessionBackupByWindowCloseCount");
      TabGroupsManagerJsm.saveData.sessionBackupByWindowCloseCountChange();
    break;
    case"sessionBackupByTimerCount":
      this.sessionBackupByTimerCount=this.prefBranch.getIntPref("sessionBackupByTimerCount");
      TabGroupsManagerJsm.saveData.sessionBackupByTimerChange();
    break;
    case"sessionBackupByTimerInterval":
      this.sessionBackupByTimerInterval=this.prefBranch.getIntPref("sessionBackupByTimerInterval");
      TabGroupsManagerJsm.saveData.sessionBackupByTimerChange();
    break;
    case"openNewGroupOperation":
    case"useSearchPlugin":
      TabGroupsManagerJsm.searchPlugins.searchPluginSettingChange(this.prefBranch.getBoolPref("useSearchPlugin")&&this.prefBranch.getBoolPref("openNewGroupOperation"));
    break;
    case"windowCloseWhenLastGroupClose":this.windowCloseWhenLastGroupClose=this.prefBranch.getBoolPref("windowCloseWhenLastGroupClose");break;
    case"suspendWhenFirefoxClose":this.suspendWhenFirefoxClose=this.prefBranch.getBoolPref("suspendWhenFirefoxClose");break;
    case"debug":this.debug=this.prefBranch.getBoolPref("debug");break;
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.convertKeyBindJson=function(){
  let oldKeyBindJson=this.prefBranch.getCharPref("keyBindJson");
  if(oldKeyBindJson.charAt(1)=="{"){
    let oldKeyBind=JSON.parse(oldKeyBindJson);
    let newKeyBind=new Array();
    for(let i=0;i<oldKeyBind.length;i++){
      newKeyBind.push([oldKeyBind[i].key,this.convertKeyBindCommandToCode(oldKeyBind[i].command)]);
    }
    this.prefBranch.setCharPref("keyBindJson",JSON.stringify(newKeyBind));
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.convertKeyBindCommandToCode=function(command){
  switch(command){
    case"OpenNewGroup":return 0;
    case"OpenNewGroupActive":return 1;
    case"OpenNewGroupRename":return 2;
    case"OpenNewGroupRenameActive":return 3;
    case"OpenNewGroupHome":return 4;
    case"OpenNewGroupHomeActive":return 5;
    case"SleepActiveGroup":return 10;
    case"RestoreLatestSleepedGroup":return 11;
    case"SleepingGroupList":return 12;
    case"CloseActiveGroup":return 20;
    case"RestoreLatestClosedGroup":return 21;
    case"ClosedGroupList":return 22;
    case"SuspendActiveGroup":return 30;
    case"SelectLeftGroup":return 40;
    case"SelectRightGroup":return 41;
    case"SelectLeftTabInGroup":return 44;
    case"SelectRightTabInGroup":return 45;
    case"DisplayHideGroupBar":return 50;
    case"ActiveGroupMenu":return 60;
    case"GroupBarMenu":return 61;
  }
  return-1;
};
TabGroupsManagerJsm.GlobalPreferences.prototype.getBoolPrefDefaultFromRoot=function(key,defaultValue){
  try
  {
    this.prefService.getBoolPref(key);
  }
  catch(e){
    return defaultValue;
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.getIntPrefDefaultFromRoot=function(key,defaultValue){
  try
  {
    this.prefService.getIntPref(key);
  }
  catch(e){
    return defaultValue;
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.jsonPrefToObject=function(key){
  return JSON.parse(this.prefBranch.getComplexValue(key,Ci.nsISupportsString).data);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.objectToJsonPref=function(key,object){
  var str=Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
  str.data=JSON.stringify(object);
  this.prefBranch.setComplexValue(key,Ci.nsISupportsString,str);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.addGroupNameRegistered=function(name){
  this._groupNameRegistered.push(name);
  this.objectToJsonPref("groupNameRegistered",this._groupNameRegistered);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.deleteGroupNameRegistered=function(index){
  this._groupNameRegistered.splice(index,1);
  this.objectToJsonPref("groupNameRegistered",this._groupNameRegistered);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.addGroupNameHistory=function(name){
  let duplicateIndex=this._groupNameHistory.indexOf(name);
  if(duplicateIndex>=0){
    this._groupNameHistory.splice(duplicateIndex,1);
  }
  this._groupNameHistory.unshift(name);
  if(this._groupNameHistory.length>10){
    this._groupNameHistory.splice(10,this._groupNameHistory.length-10);
  }
  this.objectToJsonPref("groupNameHistory",this._groupNameHistory);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.deleteGroupNameHistory=function(index){
  this._groupNameHistory.splice(index,1);
  this.objectToJsonPref("groupNameHistory",this._groupNameHistory);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.clearGroupNameHistory=function(){
  this._groupNameHistory.splice(0,this._groupNameHistory.length);
  this.objectToJsonPref("groupNameHistory",this._groupNameHistory);
};
TabGroupsManagerJsm.GlobalPreferences.prototype.defaultSettings=function(){
  var nameList=this.prefBranch.getChildList("",{});
  for(let i=0;i<nameList.length;i++){
    if(this.prefBranch.prefHasUserValue(nameList[i])){
      this.prefBranch.clearUserPref(nameList[i]);
    }
  }
};
TabGroupsManagerJsm.GlobalPreferences.prototype.exportSettings=function(file){
  var nameList=this.prefBranch.getChildList("",{});
  let data=new Array(nameList.length+1);
  data[0]={type:TabGroupsManagerJsm.constValues.settingsType};
  for(let i=0;i<nameList.length;i++){
    let oneData={};
    oneData.name=nameList[i];
    oneData.type=this.prefBranch.getPrefType(nameList[i]);
    oneData.value=null;
    switch(oneData.type){
      case this.prefBranch.PREF_INT:oneData.value=this.prefBranch.getIntPref(nameList[i]);break;
      case this.prefBranch.PREF_BOOL:oneData.value=this.prefBranch.getBoolPref(nameList[i]);break;
      case this.prefBranch.PREF_STRING:oneData.value=this.prefBranch.getComplexValue(nameList[i],Ci.nsISupportsString).data;break;
    }
    data[i+1]=oneData;
  }
  file.writeFileAsText(JSON.stringify(data));
};
TabGroupsManagerJsm.GlobalPreferences.prototype.importSettings=function(file){
  try
  {
    let data=JSON.parse(file.readFileAsText());
    if(data[0].type==TabGroupsManagerJsm.constValues.settingsType){
      for(let i=1;i<data.length;i++){
        switch(data[i].type){
          case this.prefBranch.PREF_INT:this.prefBranch.setIntPref(data[i].name,data[i].value);break;
          case this.prefBranch.PREF_BOOL:this.prefBranch.setBoolPref(data[i].name,data[i].value);break;
          case this.prefBranch.PREF_STRING:
            let str=Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            str.data=data[i].value;
            this.prefBranch.setComplexValue(data[i].name,Ci.nsISupportsString,str);
          break;
        }
      }
      return true;
    }
  }
  catch(e){
  }
  return false;
};
TabGroupsManagerJsm.ApplicationStatus=function(){
  this.windows=new Array();
  this.lastId=0;
  this.dateBackup=null;
};
TabGroupsManagerJsm.ApplicationStatus.prototype.getNowString=function(){
  let now=null;
  try
  {
    now=new(nsIWindowMediator.getMostRecentWindow('navigator:browser').Date)();
  }
  catch(e){
    now=this.dateBackup;
  }
  try
  {
    let year=TabGroupsManagerJsm.utils.formatNumberLength(now.getFullYear(),4,"0");
    let month=TabGroupsManagerJsm.utils.formatNumberLength(now.getMonth()+1,2,"0");
    let date=TabGroupsManagerJsm.utils.formatNumberLength(now.getDate(),2,"0");
    let hours=TabGroupsManagerJsm.utils.formatNumberLength(now.getHours(),2,"0");
    let minutes=TabGroupsManagerJsm.utils.formatNumberLength(now.getMinutes(),2,"0");
    let seconds=TabGroupsManagerJsm.utils.formatNumberLength(now.getSeconds(),2,"0");
    return year+"_"+month+"_"+date+"_"+hours+"_"+minutes+"_"+seconds;
  }
  catch(e){
    return"0000_00_00_00_00_00";
  }
};
TabGroupsManagerJsm.ApplicationStatus.prototype.addWindow=function(window){
  if(-1==this.searchWindow(window)){
    this.windows.push(window);
  }
};
TabGroupsManagerJsm.ApplicationStatus.prototype.removeWindow=function(window){
  var index=this.searchWindow(window);
  if(index>-1){
    this.windows.splice(index,1);
  }
};
TabGroupsManagerJsm.ApplicationStatus.prototype.searchWindow=function(window){
  for(var i=0;i<this.windows.length;i++){
    if(this.windows[i]==window){
      return i;
    }
  }
  return-1;
};
TabGroupsManagerJsm.ApplicationStatus.prototype.searchMainWindow=function(excludeWindow){
  var mainWindow=null;
  var mainWindowGroupsLength=-1;
  for(var i=0;i<this.windows.length;i++){
    if(this.windows[i]!=excludeWindow&&this.windows[i].TabGroupsManager.allGroups.childNodes.length>mainWindowGroupsLength){
      mainWindow=this.windows[i];
      mainWindowGroupsLength=this.windows[i].TabGroupsManager.allGroups.childNodes.length;
    }
  }
  return mainWindow;
};
TabGroupsManagerJsm.ApplicationStatus.prototype.groupBarIsDisplayedInOtherWindow=function(excludeWindow){
  for(var i=0;i<this.windows.length;i++){
    if(this.windows[i]!=excludeWindow&&this.windows[i].TabGroupsManager.groupBarDispHide.dispGroupBar){
      return true;
    }
  }
  return false;
};
TabGroupsManagerJsm.ApplicationStatus.prototype.makeNewId=function(){
  var backup=this.lastId;
  do
  {
    this.lastId=(this.lastId)% 1000000+1;
    if(null==this.getGroupById(this.lastId)&&
       null==TabGroupsManagerJsm.saveData.getGroupById(this.lastId)){
      return this.lastId;
    }
  }while(backup!=this.lastId);
  return-1;
};
TabGroupsManagerJsm.ApplicationStatus.prototype.getGroupById=function(id){
  for(var i=0;i<this.windows.length;i++){
    if(this.windows[i].TabGroupsManager){
      var group=this.windows[i].TabGroupsManager.allGroups.getGroupById(id);
      if(group){
        return group;
      }
    }
  }
  return null;
};
TabGroupsManagerJsm.ApplicationStatus.prototype.modifyGroupId=function(groupData,id){
  groupData.id=id || this.makeNewId();
  for(var i=0;i<groupData.tabs.length;i++){
    let tabData=JSON.parse(groupData.tabs[i]);
    tabData.extData.TabGroupsManagerGroupId=groupData.id;
    groupData.tabs[i]=JSON.stringify(tabData);
  }
};
TabGroupsManagerJsm.SearchPlugins=function(){
  try
  {
    this.searchPluginHidden();
  }
  catch(e){
    alertErrorIfDebug(e);
  }
};
TabGroupsManagerJsm.SearchPlugins.prototype.getSearchPlugins=function(visible){
  var searchService=Cc["@mozilla.org/browser/search-service;1"].getService(Ci.nsIBrowserSearchService);
  var count={};
  var tmp=this;
  if (visible == true) {
	//we have only a problem on fx startup due async changes in Bug 760036 
	searchService.init(function() {
		var localeNow=tmp.selectLocale();
		var engines = searchService.getVisibleEngines(count);
		for(var i=0;i<engines.length;i++){
			if(engines[i].description&&engines[i].description.match(/\(TabGroupsManagerSearchPlugin\:default\,(.+?)\)/)){
				var localeOfPlugin=RegExp.$1.split(",");
				if(!tmp.checkSearchPluginLocale(localeOfPlugin,localeNow)){
					engines[i].hidden=true;
				}
			}
		}
	});
  } else {
	//on simple pref change later we can return result immediately
	//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIBrowserSearchService#async_warning
	//searchService.init(function() {
	//    var engines = searchService.getEngines(count);
	//});

	return searchService.getEngines(count);
  }
};
TabGroupsManagerJsm.SearchPlugins.prototype.searchPluginHidden=function(){
  this.getSearchPlugins(true);
};
TabGroupsManagerJsm.SearchPlugins.prototype.searchPluginSettingChange=function(display){
  var localeNow=this.selectLocale();
  var engines=this.getSearchPlugins(false);
  for(var i=0;i<engines.length;i++){
    if(engines[i].description&&engines[i].description.match(/\(TabGroupsManagerSearchPlugin\:default\,(.+?)\)/)){
      var localeOfPlugin=RegExp.$1.split(",");
      engines[i].hidden=this.checkSearchPluginLocale(localeOfPlugin,localeNow)?!display:true;
    }
  }
};
TabGroupsManagerJsm.SearchPlugins.prototype.registRemoveInQuitApplication=function(){
  try
  {
    var searchPluginsFolder=TabGroupsManagerJsm.folderLocation.myRootFolder.appendWithClone("searchplugins");
    var otherLocaleFolder=searchPluginsFolder.appendWithClone("otherlocale");
    if(!this.needRegistRemoveInQuitApplication(searchPluginsFolder,otherLocaleFolder)){
      return;
    }
    var nextUseLocale=this.selectLocale();
    var searchPluginList=JSON.parse(searchPluginsFolder.readFileAsText("index.json"));
    for(var i=0;i<searchPluginList.length;i++){
      if(this.checkSearchPluginLocale(searchPluginList[i].locale,nextUseLocale)){
        otherLocaleFolder.moveTo(searchPluginList[i].filename,searchPluginsFolder);
      }else{
        searchPluginsFolder.moveTo(searchPluginList[i].filename,otherLocaleFolder);
      }
    }
  }
  catch(e){
    alertErrorIfDebug(e);
  }
};
TabGroupsManagerJsm.SearchPlugins.prototype.checkSearchPluginLocale=function(localeOfPlugin,localeList){
  for(var i=0;i<localeList.length;i++){
    if(-1!=localeOfPlugin.indexOf(localeList[i])){
      return true;
    }
  }
  return false;
};
TabGroupsManagerJsm.SearchPlugins.prototype.selectLocale=function(){
  try
  {
    let prefRoot=Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
    let locale=prefRoot.getCharPref("general.useragent.locale");
    var shortLocale=locale.split("-")[0];
    var searchPluginsFolder=TabGroupsManagerJsm.folderLocation.myRootFolder.appendWithClone("searchplugins");
    var localeList=JSON.parse(searchPluginsFolder.readFileAsText("localelist.json"));
    if(-1!=localeList.indexOf(locale)){
      return[locale];
    }else if(-1!=localeList.indexOf(shortLocale)){
      return[shortLocale];
    }
    var useLocale=new Array();
    for(var i=0;i<localeList.length;i++){
      if(localeList[i].split("-")[0]==shortLocale){
        useLocale.push(localeList[i]);
      }
    }
    if(useLocale.length>0){
      return useLocale;
    }
  }
  catch(e){
    alertErrorIfDebug(e);
  }
  return["en-US"];
};
TabGroupsManagerJsm.SearchPlugins.prototype.needRegistRemoveInQuitApplication=function(searchPluginsFolder,otherLocaleFolder){
  if(TabGroupsManagerJsm.globalPreferences.prefBranch.getCharPref("localeBak")=="development"){
    return;
  }
  if(!otherLocaleFolder.existsAndIsFolder){
    otherLocaleFolder.createFolder("");
    return true;
  }
  let prefRoot=Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
  let nextLocale=prefRoot.getCharPref("general.useragent.locale");
  if(nextLocale!=TabGroupsManagerJsm.globalPreferences.prefBranch.getCharPref("localeBak")){
    TabGroupsManagerJsm.globalPreferences.prefBranch.setCharPref("localeBak",nextLocale);
    return true;
  }
  return false;
};
TabGroupsManagerJsm.SaveData=function(){
  try
  {
    this.data=
    {
      type:TabGroupsManagerJsm.constValues.sessionDataType2,
      sleeping:new Array(),
      closed:new Array()
    };
    this.sessionStore=Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    this.dataFolder=TabGroupsManagerJsm.folderLocation.dataFolderInProfile.createFolder("save_data");
    this.dataFilePrefix="save_data_";
    this.backupSwapFilePrefix="backup_data_swap_";
    this.backupManuallyFilePrefix="backup_data_manually_";
    this.backupWindowCloseFilePrefix="backup_data_window_close_";
    this.backupTimerFilePrefix="backup_data_timer_";
    this.dataFileNowRegexp=new RegExp(this.dataFilePrefix+"0\."+TabGroupsManagerJsm.constValues.sessionDataExt2);
    this.dataFileMirrorRegexp=new RegExp(this.dataFilePrefix+"0\.mirror."+TabGroupsManagerJsm.constValues.sessionDataExt2);
    this.dataFileRegexp=new RegExp(this.dataFilePrefix+"([0-5])\.(?:mirror.)?"+TabGroupsManagerJsm.constValues.sessionDataExt2);
    this.backupSwapFileRegexp=new RegExp(this.backupSwapFilePrefix+"([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_[0-9]+\."+TabGroupsManagerJsm.constValues.sessionDataExt2+"?");
    this.backupManuallyFileRegexp=new RegExp(this.backupManuallyFilePrefix+"([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_[0-9]+\."+TabGroupsManagerJsm.constValues.sessionDataExt2+"?");
    this.backupWindowCloseFileRegexp=new RegExp(this.backupWindowCloseFilePrefix+"([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_[0-9]+\."+TabGroupsManagerJsm.constValues.sessionDataExt2+"?");
    this.backupTimerFileRegexp=new RegExp(this.backupTimerFilePrefix+"([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_([0-9]+)_[0-9]+\."+TabGroupsManagerJsm.constValues.sessionDataExt2+"?");
    this.sessionDataFilename=
    [
      this.dataFilePrefix+"0."+TabGroupsManagerJsm.constValues.sessionDataExt2,
      this.dataFilePrefix+"1."+TabGroupsManagerJsm.constValues.sessionDataExt2,
      this.dataFilePrefix+"2."+TabGroupsManagerJsm.constValues.sessionDataExt2,
      this.dataFilePrefix+"3."+TabGroupsManagerJsm.constValues.sessionDataExt2,
      this.dataFilePrefix+"4."+TabGroupsManagerJsm.constValues.sessionDataExt2,
      this.dataFilePrefix+"5."+TabGroupsManagerJsm.constValues.sessionDataExt2
    ];
    this.sessionDataTmpFilename=this.dataFilePrefix+"0.tmp."+TabGroupsManagerJsm.constValues.sessionDataExt2;
    this.sessionDataMirrorFilename=this.dataFilePrefix+"0.mirror."+TabGroupsManagerJsm.constValues.sessionDataExt2;
    try
    {
      this.loadLatestData();
    }
    catch(e){
      alertErrorIfDebug(e);
    }
    this.sessionBackupByWindowCloseCountChange();
    this.sessionBackupTimer=Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.sessionBackupByTimerChange();
    this.convertOldSessionBackupFiles();
  }
  catch(e){
    alertErrorIfDebug(e);
  }
};
TabGroupsManagerJsm.SaveData.prototype.convertOldSessionBackupFiles=function(){
  try
  {
    var oldFolder=TabGroupsManagerJsm.folderLocation.dataFolderInProfile.appendWithClone("sessionbackup");
    if(!oldFolder.existsAndIsFolder){
      return;
    }
    var filenameConvertList=
    [
      ["session_backup_swapped_([0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+)\.js","backup_data_swap_$1."+TabGroupsManagerJsm.constValues.sessionDataExt],
      ["session_save_([0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+)\.js","backup_data_manually_$1."+TabGroupsManagerJsm.constValues.sessionDataExt],
      ["session_backup_group_hibernate_([0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+)\.js","backup_data_window_close_$1."+TabGroupsManagerJsm.constValues.sessionDataExt],
      ["session_backup_window_closed_([0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+)\.js","backup_data_window_close_$1."+TabGroupsManagerJsm.constValues.sessionDataExt],
      ["session_backup_timer_([0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+_[0-9]+)\.js","backup_data_timer_$1."+TabGroupsManagerJsm.constValues.sessionDataExt]
    ];
    for(var i=0;i<filenameConvertList.length;i++){
      var partList=oldFolder.getArrayOfFileRegex(filenameConvertList[i][0]);
      for(var j=0;j<partList.length;j++){
        partList[j].removeFile();
      }
    }
    oldFolder.removeFile();
  }
  catch(e){
    alertErrorIfDebug(e);
  }
};
TabGroupsManagerJsm.SaveData.prototype.getSleepingGroups=function(){
  return TabGroupsManagerJsm.saveData.data.sleeping;
};
TabGroupsManagerJsm.SaveData.prototype.getClosedGroups=function(){
  return TabGroupsManagerJsm.saveData.data.closed;
};
TabGroupsManagerJsm.SaveData.prototype.loadLatestData=function(){
  if(this.loadDataAndSetGroupsStore(this.sessionDataFilename[0])){
    return 0;
  }
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"0."+TabGroupsManagerJsm.constValues.sessionDataExt)){
    return 1;
  }
  if(this.loadDataAndSetGroupsStore(this.sessionDataMirrorFilename))return 2;
  if(this.loadDataAndSetGroupsStore(this.sessionDataTmpFilename))return 3;
  if(this.loadDataAndSetGroupsStore(this.sessionDataFilename[1]))return 4;
  if(this.loadDataAndSetGroupsStore(this.sessionDataFilename[2]))return 5;
  if(this.loadDataAndSetGroupsStore(this.sessionDataFilename[3]))return 6;
  if(this.loadDataAndSetGroupsStore(this.sessionDataFilename[4]))return 7;
  if(this.loadDataAndSetGroupsStore(this.sessionDataFilename[5]))return 8;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"0.mirror."+TabGroupsManagerJsm.constValues.sessionDataExt))return 9;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"0.tmp."+TabGroupsManagerJsm.constValues.sessionDataExt))return 10;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"1."+TabGroupsManagerJsm.constValues.sessionDataExt))return 11;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"2."+TabGroupsManagerJsm.constValues.sessionDataExt))return 12;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"3."+TabGroupsManagerJsm.constValues.sessionDataExt))return 13;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"4."+TabGroupsManagerJsm.constValues.sessionDataExt))return 14;
  if(this.loadSessionDataInDataFolder(this.dataFilePrefix+"5."+TabGroupsManagerJsm.constValues.sessionDataExt))return 15;
  return-1;
};
TabGroupsManagerJsm.SaveData.prototype.loadDataAndSetGroupsStore=function(filename){
  let nsIFileWrapper=this.dataFolder.appendWithClone(filename);
  let sessionData=this.loadTgmDataFromFile(nsIFileWrapper,false);
  if(sessionData){
    this.data=sessionData;
    this.sleepButtonImageChange();
    return true;
  }
  return false;
};
TabGroupsManagerJsm.SaveData.prototype.loadSessionDataInDataFolder=function(filename){
  let json=this.loadJsonSessionDataInDataFolder(filename);
  if(json){
    return this.setSessionDataFromJson(json);
  }
  return false;
};
TabGroupsManagerJsm.SaveData.prototype.loadJsonSessionDataInDataFolder=function(filename){
  try
  {
    var fileObject=this.dataFolder.appendWithClone(filename);
    if(fileObject.existsAndIsFile){
      return fileObject.readFileAsText();
    }
  }
  catch(e){
    alertErrorIfDebug(e);
  }
  return null;
};
TabGroupsManagerJsm.SaveData.prototype.setSessionDataFromJson=function(jsonData){
  try
  {
    if(jsonData){
      let sessionData=JSON.parse(jsonData);
      if(sessionData){
        this.data=sessionData;
        this.data.type=TabGroupsManagerJsm.constValues.sessionDataType;
        this.sleepButtonImageChange();
        return true;
      }
    }
  }
  catch(e){
    alertErrorIfDebug(e);
  }
  return false;
};
TabGroupsManagerJsm.SaveData.prototype.exportDataEmergency=function(message){
  let wm=Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  let browserWindow=wm.getMostRecentWindow("navigator:browser");
  browserWindow.TabGroupsManager.session.exportDataEmergency(message);
};
TabGroupsManagerJsm.SaveData.prototype.saveLatestData=function(){
  if(TabGroupsManagerJsm.privateBrowsing.inPrivateBrowsing){
    return false;
  }
  let result1=this.saveDataToFileInDataFolder(this.sessionDataTmpFilename);
  let result2=this.saveDataToFileInDataFolder(this.sessionDataMirrorFilename);
  if(result1 || result2){
    this.dataFolder.rename(this.sessionDataFilename[4],this.sessionDataFilename[5]);
    this.dataFolder.rename(this.sessionDataFilename[3],this.sessionDataFilename[4]);
    this.dataFolder.rename(this.sessionDataFilename[2],this.sessionDataFilename[3]);
    this.dataFolder.rename(this.sessionDataFilename[1],this.sessionDataFilename[2]);
    this.dataFolder.rename(this.sessionDataFilename[0],this.sessionDataFilename[1]);
    let currentDataFilename=result1?this.sessionDataTmpFilename:this.sessionDataMirrorFilename;
    this.dataFolder.rename(currentDataFilename,this.sessionDataFilename[0]);
  }
  if(!result1 ||!result2){
    this.exportDataEmergency("SaveError");
    return false;
  }
  return true;
};
TabGroupsManagerJsm.SaveData.prototype.saveDataToFileInDataFolder=function(filename){
  return this.saveFileFromTgmData(this.dataFolder.appendWithClone(filename));
};
TabGroupsManagerJsm.SaveData.prototype.sleepButtonImageChange=function(){
  for(var i=0;i<TabGroupsManagerJsm.applicationStatus.windows.length;i++){
    var window=TabGroupsManagerJsm.applicationStatus.windows[i];
    if(window&&window.document){
      var sleepButton=window.document.getElementById("TabGroupsManagerButtonSleep");
      if(sleepButton){
        sleepButton.setAttribute("storecount",this.data.sleeping.length);
      }
    }
  }
};
TabGroupsManagerJsm.SaveData.prototype.getGroupById=function(id){
  for(var i=0;i<this.data.sleeping.length;i++){
    if(this.data.sleeping[i].id==id){
      return this.data.sleeping[i];
    }
  }
  for(var i=0;i<this.data.closed.length;i++){
    if(this.data.closed[i].id==id){
      return this.data.closed[i];
    }
  }
  return null;
};
TabGroupsManagerJsm.SaveData.prototype.backupByManually=function(){
  var basename=this.backupManuallyFilePrefix+TabGroupsManagerJsm.applicationStatus.getNowString();
  var filename=this.dataFolder.createUniqueFilenameByBaseName(basename,TabGroupsManagerJsm.constValues.sessionDataExt2);
  this.saveDataToFileInDataFolder(filename);
};
TabGroupsManagerJsm.SaveData.prototype.backupByWindowClose=function(){
  this.deleteOldSessionBackup(this.backupWindowCloseFileRegexp,TabGroupsManagerJsm.globalPreferences.sessionBackupByWindowCloseCount-1);
  if(TabGroupsManagerJsm.globalPreferences.sessionBackupByWindowCloseCount>0){
    var basename=this.backupWindowCloseFilePrefix+TabGroupsManagerJsm.applicationStatus.getNowString();
    var filename=this.dataFolder.createUniqueFilenameByBaseName(basename,TabGroupsManagerJsm.constValues.sessionDataExt2);
    this.saveDataToFileInDataFolder(filename);
  }
};
TabGroupsManagerJsm.SaveData.prototype.sessionBackupByWindowCloseCountChange=function(){
  this.deleteOldSessionBackup(this.backupWindowCloseFileRegexp,TabGroupsManagerJsm.globalPreferences.sessionBackupByWindowCloseCount);
};
TabGroupsManagerJsm.SaveData.prototype.backupSwapSession=function(){
  var basename=this.backupSwapFilePrefix+TabGroupsManagerJsm.applicationStatus.getNowString();
  var filename=this.dataFolder.createUniqueFilenameByBaseName(basename,TabGroupsManagerJsm.constValues.sessionDataExt2);
  this.saveDataToFileInDataFolder(filename);
};
TabGroupsManagerJsm.SaveData.prototype.deleteOldSwapedSession=function(){
  this.deleteOldSessionBackup(this.backupSwapFileRegexp,1);
};
TabGroupsManagerJsm.SaveData.prototype.backupByTimer=function(){
  this.deleteOldSessionBackup(this.backupTimerFileRegexp,TabGroupsManagerJsm.globalPreferences.sessionBackupByTimerCount-1);
  var basename=this.backupTimerFilePrefix+TabGroupsManagerJsm.applicationStatus.getNowString();
  var filename=this.dataFolder.createUniqueFilenameByBaseName(basename,TabGroupsManagerJsm.constValues.sessionDataExt2);
  this.saveDataToFileInDataFolder(filename);
};
TabGroupsManagerJsm.SaveData.prototype.deleteOldSessionBackup=function(regexp,leftCount){
  if(leftCount<0){
    leftCount=0;
  }
  var list=this.dataFolder.getArrayOfFileRegex(regexp);
  list.sort(TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafName);
  for(var i=0;i<list.length-leftCount;i++){
    list[i].removeFile();
  }
};
TabGroupsManagerJsm.SaveData.prototype.sessionBackupByTimerChange=function(){
  const event={notify:function(timer){TabGroupsManagerJsm.saveData.backupByTimer();}}
  this.deleteOldSessionBackup(this.backupTimerFilePrefix,TabGroupsManagerJsm.globalPreferences.sessionBackupByTimerCount);
  this.sessionBackupTimer.cancel();
  if(TabGroupsManagerJsm.globalPreferences.sessionBackupByTimerCount>0){
    var interval=TabGroupsManagerJsm.globalPreferences.sessionBackupByTimerInterval * 60000;
    if(interval>0){
      this.sessionBackupTimer.initWithCallback(event,interval,Ci.nsITimer.TYPE_REPEATING_SLACK);
    }
  }
};
TabGroupsManagerJsm.SaveData.prototype.restoreSession=function(filename){
  try
  {
    let sessionData=null;
    let ext=(filename.match(/\.([^.]+)$/))?RegExp.$1:"";
    if(ext==TabGroupsManagerJsm.constValues.sessionDataExt){
      sessionData=JSON.parse(this.loadJsonSessionDataInDataFolder(filename));
    }else if(ext==TabGroupsManagerJsm.constValues.sessionDataExt2){
      sessionData=this.loadTgmDataFromFile(this.dataFolder.appendWithClone(filename),true);
    }
    if(sessionData){
      this.restoreSessionFromData(sessionData);
      return true;
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return false;
};
TabGroupsManagerJsm.SaveData.prototype.restoreSessionFromData=function(sessionData){
  this.backupSwapSession();
  this.data=sessionData;
  this.sleepButtonImageChange();
  for(var i=0;i<TabGroupsManagerJsm.applicationStatus.windows.length;i++){
    let window=TabGroupsManagerJsm.applicationStatus.windows[i];
    window.TabGroupsManager.session.restoreSessionInit();
  }
  this.sessionStore.setBrowserState(sessionData.browserState);
  delete this.data.browserState;
  this.deleteOldSwapedSession();
};
TabGroupsManagerJsm.SaveData.prototype.deleteSession=function(sessionName){
  this.dataFolder.appendWithClone(sessionName).removeFile();
};
TabGroupsManagerJsm.SaveData.prototype.loadTgmDataFromFile=function(nsIFile,readBrowserState){
  try
  {
    if(nsIFile instanceof TabGroupsManagerJsm.NsIFileWrapper){
      nsIFile=nsIFile.nsIFile;
    }
    if(!nsIFile.exists()){
      return null;
    }
    let tgmData=
    {
      type:null,
      sleeping:null,
      closed:null,
      browserState:null
    };
    let bufferSize=4096;
    let charset="UTF-8";
    let flag=0x01;
    let fileStream=Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    let converterStream=Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
    try
    {
      fileStream.init(nsIFile,flag,0,false);
      converterStream.init(fileStream,charset,bufferSize,Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      converterStream.QueryInterface(Ci.nsIUnicharLineInputStream);
      let line={};
      let count=converterStream.readLine(line);
      if(count>0&&line.value==TabGroupsManagerJsm.constValues.sessionDataType2){
        tgmData.type=line.value;
        count=converterStream.readLine(line);
        while(count>0&&line.value.match(/^(.[^:]+):([0-9]+)$/)){
          let length=RegExp.$2-0;
          if(RegExp.$1=="Sleeping Groups"){
            tgmData.sleeping=new Array(length);
            for(let i=0;i<length;i++){
              converterStream.readLine(line);
              tgmData.sleeping[i]=JSON.parse(line.value);
            }
          }else if(RegExp.$1=="Closed Groups"){
            tgmData.closed=new Array(length);
            for(let i=0;i<length;i++){
              converterStream.readLine(line);
              tgmData.closed[i]=JSON.parse(line.value);
            }
          }else if(RegExp.$1=="Browser State"&&readBrowserState){
            converterStream.readLine(line);
            tgmData.browserState=line.value;
          }else{
            break;
          }
          count=converterStream.readLine(line);
        }
        return tgmData;
      }
    }
    finally
    {
      converterStream.close();
      fileStream.close();
    }
  }
  catch(e){
    alertError(e);
  }
  return null;
};
TabGroupsManagerJsm.SaveData.prototype.saveFileFromTgmData=function(nsIFile,permission){
  let converterStream=Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
  let bufferSize=4096;
	
  function writeLineSplitToConverterStream(text){
    for(let i=0;i<text.length;i+=bufferSize){
		converterStream.writeString(text.substr(i,bufferSize));
	}
	converterStream.writeString("\n");
  };
	
  try
  {
    if(nsIFile instanceof TabGroupsManagerJsm.NsIFileWrapper){
      nsIFile=nsIFile.nsIFile;
    }
    permission=permission || parseInt("0600", 8);
   
    let charset="UTF-8";
    let flag=0x02 | 0x08 | 0x20;
    let fileStream=Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    
    try
    {
      fileStream.init(nsIFile,flag,permission,0);
	  // we use nsIConverterInputStream -> on nsIConverterOutputStream is also no DEFAULT_REPLACEMENT_CHARACTER defined
      converterStream.init(fileStream,charset,bufferSize,Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      converterStream.writeString(TabGroupsManagerJsm.constValues.sessionDataType2);
      converterStream.writeString("\n");
      converterStream.writeString("Sleeping Groups:"+this.data.sleeping.length+"\n");
      for(let i=0;i<this.data.sleeping.length;i++){
        writeLineSplitToConverterStream(JSON.stringify(this.data.sleeping[i]));
      }
      converterStream.writeString("Closed Groups:"+this.data.closed.length+"\n");
      for(let i=0;i<this.data.closed.length;i++){
        writeLineSplitToConverterStream(JSON.stringify(this.data.closed[i]));
      }
      let browserState=this.sessionStore.getBrowserState();
      converterStream.writeString("Browser State:1\n");
      writeLineSplitToConverterStream(browserState);
      return true;
    }
    finally
    {
      converterStream.close();
      fileStream.close();
    }
  }
  catch(e){
    alertError(e);
  }
  return false;
};
TabGroupsManagerJsm.NsIFileWrapper=function(aNsIFile,aCannotAppend){
  if(aNsIFile instanceof Ci.nsIFile){
    this.nsIFile=aNsIFile;
  }else{
    try
    {
      this.nsIFile=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      this.nsIFile.initWithPath(aNsIFile.mozFullPath || aNsIFile);
    }
    catch(e){
      alertErrorIfDebug(e);
      return;
    }
  }
  this.cannotAppend=(aCannotAppend==true)?true:false;
  this.__defineGetter__("path",function(){return this.nsIFile.path;});
  this.__defineGetter__("leafName",function(){return this.nsIFile.leafName;});
  this.__defineGetter__("parent",this.getParent);
  this.__defineGetter__("arrayOfFile",this.getArrayOfFile);
  this.__defineGetter__("exists",this.nsIFile.exists);
  this.__defineGetter__("isWriteable",this.nsIFile.isWritable);
  this.__defineGetter__("isReadable",this.nsIFile.isReadable);
  this.__defineGetter__("isHidden",this.nsIFile.isHidden);
  this.__defineGetter__("isFolder",this.nsIFile.isDirectory);
  this.__defineGetter__("isFile",this.nsIFile.isFile);
  this.__defineGetter__("isSymlink",this.nsIFile.isSymlink);
  this.__defineGetter__("existsAndIsFolder",function(){return this.exists&&this.isFolder;});
  this.__defineGetter__("existsAndIsFile",function(){return this.exists&&this.isFile;});
  this.__defineGetter__("lastModifiedTime",function(){return this.nsIFile.lastModifiedTime;});
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.getParent=function(){
  let parent=this.nsIFile.parent;
  return parent?new TabGroupsManagerJsm.NsIFileWrapper(parent):null;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.getArrayOfFile=function(){
  if(!this.existsAndIsFolder){
    return null;
  }
  var entries=this.nsIFile.directoryEntries;
  var array=[];
  while(entries.hasMoreElements()){
    var entry=entries.getNext();
    entry.QueryInterface(Ci.nsIFile);
    var tmp=new TabGroupsManagerJsm.NsIFileWrapper(entry);
    array.push(tmp);
  }
  return array;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.getArrayOfFileRegex=function(regexText,regexFlags){
  if(!this.existsAndIsFolder){
    return null;
  }
  var regex=new RegExp(regexText,regexFlags);
  var entries=this.nsIFile.directoryEntries;
  var array=[];
  while(entries.hasMoreElements()){
    var entry=entries.getNext();
    entry.QueryInterface(Ci.nsIFile);
    var tmp=new TabGroupsManagerJsm.NsIFileWrapper(entry);
    if(regex.test(tmp.leafName)){
      array.push(tmp);
    }
  }
  return array;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.getArrayOfFolder=function(){
  if(!this.existsAndIsFolder){
    return null;
  }
  var entries=this.nsIFile.directoryEntries;
  var array=[];
  while(entries.hasMoreElements()){
    var entry=entries.getNext();
    entry.QueryInterface(Ci.nsIFile);
    let tmp=new TabGroupsManagerJsm.NsIFileWrapper(entry);
    if(tmp.isFolder){
      array.push(tmp);
    }
  }
  return array;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.getArrayOfFolderRegex=function(regexText,regexFlags){
  if(!this.existsAndIsFolder){
    return null;
  }
  var regex=new RegExp(regexText,regexFlags);
  var entries=this.nsIFile.directoryEntries;
  var array=[];
  while(entries.hasMoreElements()){
    var entry=entries.getNext();
    entry.QueryInterface(Ci.nsIFile);
    let tmp=new TabGroupsManagerJsm.NsIFileWrapper(entry);
    if(tmp.isFolder&&regex.test(tmp.leafName)){
      array.push(tmp);
    }
  }
  return array;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.append=function(){
  var tmp=(this.cannotAppend)?(new TabGroupsManagerJsm.NsIFileWrapper(this.nsIFile.clone())):this;
  for(var i=0;i<arguments.length;i++){
    tmp.nsIFile.append(arguments[i]);
  }
  return tmp;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.appendWithClone=function(){
  var tmp=new TabGroupsManagerJsm.NsIFileWrapper(this.nsIFile.clone());
  for(var i=0;i<arguments.length;i++){
    tmp.nsIFile.append(arguments[i]);
  }
  return tmp;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.createFolder=function(folderName,permission){
  if(permission==null){
    permission=parseInt("0700", 8);
  }
  var newFolder=this;
  if(folderName){
    newFolder=this.appendWithClone(folderName);
  }
  if(!newFolder.existsAndIsFolder){
    newFolder.nsIFile.create(Ci.nsIFile.DIRECTORY_TYPE,permission);
  }
  newFolder.cannotAppend=true;
  return newFolder;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.forceCreateFolder=function(permission){
  if(permission==null){
    permission=parseInt("0700", 8);
  }
  var newFolder=this.appendWithClone();
  for(var i=1;i<arguments.length;i++){
    newFolder.append(arguments[i]);
  }
  if(!newFolder.existsAndIsFolder){
    newFolder.nsIFile.create(Ci.nsIFile.DIRECTORY_TYPE,permission);
  }
  newFolder.cannotAppend=true;
  return newFolder;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.removeFile=function(filename,recursive){
  var file=this.nsIFile;
  if(filename){
    file=this.appendWithClone(filename).nsIFile;
  }
  if(file.exists()){
    try
    {
      file.remove(recursive);
    }
    catch(e){
    }
  }
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.copyTo=function(oldFilename,newFolder,newName){
  var file=oldFilename?this.appendWithClone(oldFilename):this;
  if(file.exists&&newFolder.existsAndIsFolder){
    return file.nsIFile.copyTo(newFolder.nsIFile,newName);
  }
  return null;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.rename=function(oldFilename,newFilename){
  var file=oldFilename?this.appendWithClone(oldFilename):this;
  if(file.exists){
    file.nsIFile.moveTo(null,newFilename);
  }
  return file;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.moveTo=function(oldFilename,newFolder){
  var file=oldFilename?this.appendWithClone(oldFilename):this;
  if(file.exists&&newFolder.existsAndIsFolder){
    file.nsIFile.moveTo(newFolder.nsIFile,null);
  }
  return file;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.readFileAsText=function(filename){
  let file=this.nsIFile;
  if(filename){
    file=file.clone();
    file.append(filename);
  }
  let bufferSize=4096;
  let charset="UTF-8";
  let fileStream=Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
  let converterStream=Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
  let text="";
  try
  {
    fileStream.init(file,1,0,false);
    converterStream.init(fileStream,charset,bufferSize,Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    let text="";
    let data={};
    while(converterStream.readString(bufferSize,data)){
      text+=data.value;
    }
    return text;
  }
  finally
  {
    converterStream.close();
    fileStream.close();
  }
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.writeFileAsText=function(text,filename,permission){
  if(permission==null){
    permission=parseInt("0600", 8);
  }
  let file=this.nsIFile;
  if(filename){
    file=this.nsIFile.clone();
    file.append(filename);
  }
  let bufferSize=4096;
  let charset="UTF-8";
  let fileStream=Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
  let converterStream=Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
  try
  {
    fileStream.init(file,0x02 | 0x08 | 0x20,permission,0);
    converterStream.init(fileStream,charset,bufferSize,Ci.nsIConverterOutputStream.DEFAULT_REPLACEMENT_CHARACTER);
    for(let i=0;i<text.length;i+=bufferSize){
      converterStream.writeString(text.substr(i,bufferSize));
    }
  }
  finally
  {
    converterStream.close();
    fileStream.close();
  }
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.createUniqueFilenameByBaseName=function(baseName,ext){
  for(var i=0;i<1000000;i++){
    var newFilename=baseName+"_"+i+"."+ext;
    var file=this.appendWithClone(newFilename);
    if(!file.exists){
      return newFilename;
    }
  }
  return null;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafName=function(a,b){
  if(a.leafName<b.leafName)
    return-1;
  else if(a.leafName>b.leafName)
    return 1;
  else
    return 0;
};
TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafNameReverse=function(a,b){
  if(a.leafName<b.leafName)
    return 1;
  else if(a.leafName>b.leafName)
    return-1;
  else
    return 0;
};
TabGroupsManagerJsm.FolderLocation=function(){
  try
  {
    this.profileFolder=new TabGroupsManagerJsm.NsIFileWrapper(Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD",Ci.nsIFile),true);
    this.dataFolderInProfile=this.profileFolder.createFolder("tabgroupsmanagerdata");
    this.dataFolderInProfile.cannotAppend=true;
    this.resourceFolder=new TabGroupsManagerJsm.NsIFileWrapper(__LOCATION__.parent.parent);
    this.myRootFolder=this.resourceFolder.parent;
    this.resourceFolder.cannotAppend=true;
    this.myRootFolder.cannotAppend=true;
  }
  catch(e){
    alertErrorIfDebug(e);
  }
};
TabGroupsManagerJsm.FolderLocation.prototype.makeURLFromNsILocalFile=function(nsiLocalFile){
  let ios=Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  return ios.newFileURI(nsiLocalFile).spec;
};
TabGroupsManagerJsm.FolderLocation.prototype.makeNsIFileWrapperFromURL=function(URL){
  return(0==URL.indexOf("resource://"))?this.makeNsIFileWrapperFromResourceURL(URL):this.makeNsIFileWrapperFromFileURL(URL);
};
TabGroupsManagerJsm.FolderLocation.prototype.makeNsIFileWrapperFromFileURL=function(URL){
  let ios=Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  let fileHandler=ios.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
  return new TabGroupsManagerJsm.NsIFileWrapper(fileHandler.getFileFromURLSpec(URL));
};
TabGroupsManagerJsm.FolderLocation.prototype.makeNsIFileWrapperFromResourceURL=function(URL){
  try
  {
    var result=this.myRootFolder.appendWithClone("resource");
    if(URL.match(/resource\:\/\/tabgroupsmanager\/(.*)/i)){
      let path=RegExp.$1.split(/\//);
      for(var i=0;i<path.length;i++){
        result.append(path[i]);
      }
    }
  }
  catch(e){
    return null;
  }
  return result;
};
TabGroupsManagerJsm.displayError=
{
  makePropList:function(object){
    var text="";
    for(var i in object){
      text+=i+" : ";
      try
      {
        text+=(typeof(object[i])=="function")?"function\n":object[i]+"\n";
      }
      catch(e){
        text+="err"+"\n";
      }
    }
    return text;
  },
  showMessage:function(text){
      try {
        Services.console.logStringMessage(text);
      } catch (ex) {
        //use Fuel API for Firefox 3.6
        Application.console.log(text);
      }
  },
  alert:function(text){
    var promptService=Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    promptService.alert(null,"Firefox",text);
  },
  alertIfDebug:function(text){
    if(TabGroupsManagerJsm.globalPreferences.debug){
      this.alert(text);
    }
  },
  showMessageProp:function(object){
    this.showMessage(this.makePropList(object));
  },
  alertProp:function(object,text){
    this.alert((text?text+"\n\n":"")+this.makePropList(object));
  },
  alertPropIfDebug:function(object,text){
    if(TabGroupsManagerJsm.globalPreferences.debug){
      this.alertProp(object,text);
    }
  },
  alertError:function(e,text){
    this.alert((text?text+"\n\n":"")+
      e.name+"\n"+
      e.message+"\n\n"+
     "File: "+e.fileName+"\n"+
     "Line: "+e.lineNumber+"\n"+
     "Stack:\n"+e.stack
    );
  },
  alertErrorIfDebug:function(e,text){
    if(TabGroupsManagerJsm.globalPreferences.debug){
      this.alertError(e,text);
    }else{
      throw e;
    }
  }
};
TabGroupsManagerJsm.PrivateBrowsing=function(){
  try
  {
    this._initialized=false;
    this._inPrivateBrowsing=false;
    this.__defineGetter__("inPrivateBrowsing",this.getInPrivateBrowsing);
    this.__defineGetter__("entering",this.getEntering);
    this.__defineGetter__("exiting",this.getExiting);
    this.__defineGetter__("enteringOrExiting",this.getEnteringOrExiting);
	
	this._info=Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).version
	this._version=this._info.substr(0,this._info.indexOf('.'));
	
    //Mozilla removed old private browsing interface functionality for FX 20 and dummy interface with Bug 845063 for Fx 22
	//https://developer.mozilla.org/en-US/docs/Updating_addons_broken_by_private_browsing_changes
	if(this._version <  20){
		this.nsIPrivateBrowsingService=Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService);
		this._inPrivateBrowsing=this.nsIPrivateBrowsingService.privateBrowsingEnabled;
		this.observerService=Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		this.observerService.addObserver(this,"private-browsing",false);
		this.observerService.addObserver(this,"quit-application",false);
		this._initialized=true;
	}
  }
  catch(e){}
};
TabGroupsManagerJsm.PrivateBrowsing.prototype.observe=function(aSubject,aTopic,aData){
  switch(aTopic){
    case"private-browsing":
      try
      {
        try
        {
          var data=JSON.parse(TabGroupsManagerJsm.saveData.sessionStore.getBrowserState());
          if(data.windows&&data.windows.length>0&&data.windows[0].extData&&data.windows[0].extData.TabGroupsManagerAllGroupsData){
            delete data.windows[0].extData.TabGroupsManagerAllGroupsData;
            TabGroupsManagerJsm.saveData.sessionStore.setBrowserState(JSON.stringify(data));
          }
        }
        catch(e){
        }
        for(var i=0;i<TabGroupsManagerJsm.applicationStatus.windows.length;i++){
          TabGroupsManagerJsm.applicationStatus.windows[i].TabGroupsManager.session.restoreSessionInit();
        }
        if(aData=="exit"){
          TabGroupsManagerJsm.saveData.loadLatestData();
        }
      }
      finally
      {
        this._inPrivateBrowsing=this.nsIPrivateBrowsingService.privateBrowsingEnabled;
      }
    break;
    case"quit-application":
      this.observerService.removeObserver(this,"private-browsing",false);
      this.observerService.removeObserver(this,"quit-application",false);
    break;
}
};
TabGroupsManagerJsm.PrivateBrowsing.prototype.getInPrivateBrowsing=function(){
  return(this._initialized&&(this._inPrivateBrowsing || this.nsIPrivateBrowsingService.privateBrowsingEnabled));
};
TabGroupsManagerJsm.PrivateBrowsing.prototype.getEntering=function(){
  return(this._initialized&&this._inPrivateBrowsing==false&&this.nsIPrivateBrowsingService.privateBrowsingEnabled==true);
};
TabGroupsManagerJsm.PrivateBrowsing.prototype.getExiting=function(){
  return(this._initialized&&this._inPrivateBrowsing==true&&this.nsIPrivateBrowsingService.privateBrowsingEnabled==false);
};
TabGroupsManagerJsm.PrivateBrowsing.prototype.getEnteringOrExiting=function(){
  return(this._initialized&&this._inPrivateBrowsing!=this.nsIPrivateBrowsingService.privateBrowsingEnabled);
};
TabGroupsManagerJsm.QuitApplicationObserver=function(){
  this.observeList=
  [
   "quit-application-requested",
   "quit-application-granted",
   "quit-application"
  ];
  var observerService=Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  for(var i=0;i<this.observeList.length;i++){
    observerService.addObserver(this,this.observeList[i],false);
  }
};
TabGroupsManagerJsm.QuitApplicationObserver.prototype.destructor=function(){
  var observerService=Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  for(var i=0;i<this.observeList.length;i++){
    observerService.removeObserver(this,this.observeList[i],false);
  }
};
TabGroupsManagerJsm.QuitApplicationObserver.prototype.observe=function(aSubject,aTopic,aData){
  switch(aTopic){
    case"quit-application-requested":this.quitApplicationRequested();break;
    case"quit-application-granted":this.quitApplicationGranted();break;
    case"quit-application":this.quitApplication();break;
  }
};
TabGroupsManagerJsm.QuitApplicationObserver.prototype.quitApplicationRequested=function(){
  if(!this.inCanQuitApplication){
    this.afterQuitApplicationRequested();
  }
};
TabGroupsManagerJsm.QuitApplicationObserver.prototype.afterQuitApplicationRequested=function(){
  try
  {
    TabGroupsManagerJsm.saveData.sessionBackupTimer.cancel();
    for(var i=0;i<TabGroupsManagerJsm.applicationStatus.windows.length;i++){
      if(TabGroupsManagerJsm.applicationStatus.windows[i].TabGroupsManager){
        TabGroupsManagerJsm.applicationStatus.windows[i].TabGroupsManager.afterQuitApplicationRequested();
      }
    }
    TabGroupsManagerJsm.saveData.sessionStore.getBrowserState();
  }
  catch(e){
    alertErrorIfDebug(e);
  }
};
TabGroupsManagerJsm.QuitApplicationObserver.prototype.quitApplicationGranted=function(){
  for(var i=0;i<TabGroupsManagerJsm.applicationStatus.windows.length;i++){
    TabGroupsManagerJsm.applicationStatus.windows[i].TabGroupsManager.groupBarDispHide.saveGroupBarDispHideToSessionStore();
  }
  TabGroupsManagerJsm.saveData.saveLatestData();
  TabGroupsManagerJsm.saveData.backupByWindowClose();
};
TabGroupsManagerJsm.QuitApplicationObserver.prototype.quitApplication=function(){
  TabGroupsManagerJsm.searchPlugins.registRemoveInQuitApplication();
  TabGroupsManagerJsm.finalize();
};
const Cc=Components.classes;
const Ci=Components.interfaces;

var Application = null;

try {
	Components.utils.import("resource://gre/modules/Services.jsm");
	Application=Services.wm.getMostRecentWindow("navigator:browser");
} catch (ex) {
    //use Fuel API for Firefox 3.6
	Application=Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication); 
}

const nsIWindowMediator=Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
function alert(text){
  TabGroupsManagerJsm.displayError.alert(text);
};
function alertProp(object,text){
  TabGroupsManagerJsm.displayError.alertProp(object,text);
};
function alertIfDebug(text){
  TabGroupsManagerJsm.displayError.alertIfDebug(text);
};
function alertPropIfDebug(object,text){
  TabGroupsManagerJsm.displayError.alertPropIfDebug(object,text);
};
function alertError(e,text){
  TabGroupsManagerJsm.displayError.alertError(e,text);
};
function alertErrorIfDebug(e,text){
  TabGroupsManagerJsm.displayError.alertErrorIfDebug(e,text);
};
function showMessage(text){
  TabGroupsManagerJsm.displayError.showMessage(text);
};
TabGroupsManagerJsm.initialize();