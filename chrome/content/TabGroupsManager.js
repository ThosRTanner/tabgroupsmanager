var Cc=Components.classes;
var Ci=Components.interfaces;
Components.utils.import("resource://tabgroupsmanager/modules/AxelUtils.jsm");
try
{
  Components.utils.import("resource://gre/modules/PlacesUtils.jsm");
}
catch(e){
  Components.utils.import("resource://gre/modules/utils.js");
}
var TabGroupsManager=
{
  initialized:false,
  apiEnabled:false,
  contextTargetHref: null,
  
  //setup E10s message processing
  MESSAGES: [ 'sendToTGMChrome' ],

  receiveMessage: function(msg) {
	if (msg.name != 'sendToTGMChrome') return;
	
	switch (msg.data.msgType) {
		case "linkTarget": // set our target in chrome code
			TabGroupsManager.contextTargetHref = msg.data.href;
			break;
	}
  }
};
//setup E10s message manager and framescript
TabGroupsManager.addFrameScript=function(){
  let mm = null;
	
  //use group mm browsers only for Fx > 32
  if (window.getGroupMessageManager) mm = window.getGroupMessageManager("browsers");
  else mm = window.messageManager;
  		
  //enable delayed load for new tabs
  mm.loadFrameScript("chrome://tabgroupsmanager/content/TabGroupsManager-content.js", true);

  //setup chrome message listener		
  for (let msg of this.MESSAGES) {
	mm.addMessageListener(msg, this.receiveMessage);
  }
};
TabGroupsManager.onLoad=function(event){
  window.removeEventListener("load",arguments.callee,false);
  if(document.getElementById("TabGroupsManagerToolbar")){
    window.addEventListener("unload",TabGroupsManager.onUnload,false);
    TabGroupsManager.initialize();
  }
};
TabGroupsManager.onUnload=function(event){
  window.removeEventListener("unload",arguments.callee,false);
  TabGroupsManager.finalize();
};
TabGroupsManager.initialize=function(event){
  try
  {
	this.addFrameScript();
    this.lastId=1;
    this.strings=document.getElementById("TabGroupsManagerStrings");
    Components.utils.import("resource://tabgroupsmanager/modules/TabGroupsManager.jsm");
    TabGroupsManagerJsm.applicationStatus.addWindow(window);
    this.xulElements=new this.XulElements;
    this.preferences=new this.Preferences();
    this.tabOpenStatus=new this.TabOpenStatus();
    this.keyboardState=new this.KeyboardState();
    this.eventListener=new this.EventListener();
    this.tabContextMenu=new this.TabContextMenu();
    var supportDnD=new this.SupportDnD();
    this.groupDnDObserver=new this.GroupDnDObserver(supportDnD);
    this.groupBarDnDObserver=new this.GroupBarDnDObserver(supportDnD);
    this.windowDnDObserver=new this.WindowDnDObserver(supportDnD);
    this.allGroups=new this.AllGroups();
    this.closedGroups=new this.GroupsStore(TabGroupsManagerJsm.saveData.getClosedGroups,this.preferences.maxClosedTabStoreCount,false,"TabGroupsManagerClosedGroupsMenuitemContextMenu");
    this.sleepingGroups=new this.GroupsStore(TabGroupsManagerJsm.saveData.getSleepingGroups,-1,true,"TabGroupsManagerSleepingGroupsMenuitemContextMenu");
    this.session=new this.Session();
    this.groupBarDispHide=new this.GroupBarDispHide();
    this.keyboardShortcut=new this.KeyboardShortcut();
    this.places=new this.Places();
    this.localGroupIcons=new this.LocalGroupIcons();
    this.toolMenu=new this.ToolMenu();
    this.groupMenu=new this.GroupMenu();
    if(!("toolbar_order" in window)&&document.getElementById("appmenu-button")){
      this.tabsInTitleBar=new this.TabsInTitleBar();
    }
    if("TabView" in window){
      this.forPanorama=new this.ForPanorama();
    }
    TabGroupsManager.sleepingGroups.setSleepGroupsImage();
    this.titleSplitRegExp=new RegExp(this.strings.getString("TitleSplitRegExp"),"i");
    var group=this.allGroups.openNewGroup(gBrowser.selectedTab,-1,this.strings.getString("StartGroupName"),null);
    for(var tab=gBrowser.mTabContainer.firstChild;tab;tab=tab.nextSibling){
      this.allGroups.selectedGroup.addTab(tab,true);
    }
    this.eventListener.createEventListener();
    this.xulElements.groupBar.addEventListener("click",TabGroupsManager.utils.popupNotContextMenuOnRightClick,false);
    this.apiEnabled=true;
    this.overrideMethod=new this.OverrideMethod();
    this.overrideOtherAddOns=new this.OverrideOtherAddOns();
    if(("arguments" in window)&&window.arguments.length>2&&window.arguments[1]=="TabGroupsManagerNewWindowWithGroup"){
      var fromGroupTab=window.arguments[2];
      var isCopy=window.arguments[3];
      if(fromGroupTab.group){
        var newGroup=this.allGroups.moveGroupToOtherWindow(fromGroupTab,null,isCopy);
        this.allGroups.selectedGroup=newGroup;
        group.close();
      }
    }
    //we need this only on blank page on homepage startup - this will be called again later on session restore in mode 3
    if (TabGroupsManager.preferences.startupMode < 3) setTimeout(function(){TabGroupsManager.initializeAfterOnLoad();},10);
  }
  catch(e){
	TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.initializeAfterOnLoad=function(){
  //prepare promiseInitialized request
  var _this = this;
  var ss = Components.utils.import('resource:///modules/sessionstore/SessionStore.jsm');
  var version = TabGroupsManager.preferences.firefoxVersion();

  var tabmixSessionsManager=("TMP_TabGroupsManager" in window)&&TMP_TabGroupsManager.tabmixSessionsManager();
  if(TabGroupsManager.session.sessionRestoreManually ||!tabmixSessionsManager){
	if(version > "28") {
		ss.SessionStore.promiseInitialized.then(function() {
			_this.session.restoreGroupsAndSleepingGroupsAndClosedGroups();
		});
	} else this.session.restoreGroupsAndSleepingGroupsAndClosedGroups();
  }
  if(this.initialized){
    return;
  }
  this.initialized=true;
  try
  {
    if(TabGroupsManagerJsm.globalPreferences.prefService.getBranch("extensions.tabmix.sessions.").getBoolPref("manager")){
      try
      {
        this.session.sessionStore.getWindowState(window);
      }
      catch(e){
        this.session.sessionStore.init(window);
      }
    }
  }
  catch(e){} 
  this.tabContextMenu.makeMenu();
  if(version > "28") {
	  ss.SessionStore.promiseInitialized.then(function() {
		_this.groupBarDispHide.firstStatusOfGroupBarDispHide();
	  });
  } else this.groupBarDispHide.firstStatusOfGroupBarDispHide();
  setTimeout(function(){TabGroupsManager.onLoadDelay1000();},1000);
};
TabGroupsManager.onLoadDelay1000=function(){
  TabGroupsManager.overrideMethod.delayOverride();
  TabGroupsManager.overrideOtherAddOns.delayOverride();
  if(("TMP_eventListener" in window)&&!("TMP_TabGroupsManager" in window)){
    window.openDialog("chrome://tabgroupsmanager/content/versionAlertTMP.xul","TabGroupsManagerVersionAlertTMP","chrome,modal,dialog,centerscreen,resizable",TabGroupsManager.callbackOpenUriInSelectedTab);
  }
  TabGroupsManager.allGroups.scrollInActiveGroup();
};
TabGroupsManager.callbackOpenUriInSelectedTab=function(uri){
  gBrowser.selectedTab=TabGroupsManager.overrideMethod.gBrowserAddTab(uri);
};
TabGroupsManager.finalize=function(){
  this.apiEnabled=false;
  TabGroupsManagerJsm.applicationStatus.removeWindow(window);
  for(var i=0;i<TabGroupsManager.allGroups.childNodes.length;i++){
    TabGroupsManager.allGroups.childNodes[i].group.removeAllProgressListener();
  }
  this.keyboardState.destroyEventListener();
  this.session.destroyEventListener();
  this.eventListener.destroyEventListener();
  this.groupDnDObserver.destroyEventListener();
  this.groupBarDnDObserver.destroyEventListener();
  this.windowDnDObserver.destroyEventListener();
  this.tabContextMenu.deleteMenu();
  this.preferences.destructor();
  delete this.allGroups;
  TabGroupsManagerJsm.applicationStatus.dateBackup=new Date;
};
TabGroupsManager.afterQuitApplicationRequested=function(){
  this.allGroups.readDummyBlankPage();
  if(TabGroupsManagerJsm.globalPreferences.suspendWhenFirefoxClose){
    this.allGroups.suspendAllNonSelectedGroups();
  }
  this.allGroups.waitDummyBlankPage();
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  try
  {
    let modifyFlag=false;
    let windowState=JSON.parse(this.session.sessionStore.getWindowState(window));
    for(let i=0;i<gBrowser.tabContainer.childNodes.length;i++){
      let tab=gBrowser.tabContainer.childNodes[i];
      let extData=windowState.windows[0].tabs[i].extData;
      if(extData&&extData.TabGroupsManagerGroupId!=tab.group.id&&tab.__SS_extdata){
        modifyFlag=true;
        windowState.windows[0].tabs[i].extData=tab.__SS_extdata;
      }
    }
    if(modifyFlag){
      this.session.sessionStore.setWindowState(window,JSON.stringify(windowState),true);
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.utils=
{
  nsIIOService:Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
};
//add result and rename tmp to result because tmp will be 0 if nothing is found
//id is content and arguments are content, tabbrowser, arrowscrollbox
//it seems that from getAnonymousElementByAttribute() nothing will be found here
TabGroupsManager.utils.getElementByIdAndAnonids=function(id){
  var result;
  var tmp=document.getElementById(id);
  for(var i=1;i<arguments.length;i++){
    result=document.getAnonymousElementByAttribute(tmp,"anonid",arguments[i]);
  }
  return result;
};
TabGroupsManager.utils.getElementByElementAndAnonids=function(element){
  var tmp=element;
  for(var i=1;i<arguments.length;i++){
    tmp=document.getAnonymousElementByAttribute(tmp,"anonid",arguments[i]);
  }
  return tmp;
};
TabGroupsManager.utils.isBlankTab=function(tab){
  if(tab.linkedBrowser.currentURI.spec=="about:blank"&&!tab.hasAttribute("busy")){
    try
    {
      var tabData=JSON.parse(TabGroupsManager.session.getTabStateEx(tab));
      if(tabData.entries.length==0 || tabData.entries[0].url=="about:blank"){
        return true;
      }
    }
    catch(e){
      return true;
    }
  }
  return false;
};
TabGroupsManager.utils.insertElementAfterAnonid=function(parent,anonid,element){
  if(!anonid){
    parent.insertBefore(element,parent.childNodes[0]);
    return;
  }
  for(var i=0;i<parent.childNodes.length;i++){
    if(parent.childNodes[i].getAttribute("anonid")==anonid){
      parent.insertBefore(element,parent.childNodes[i+1]);
      return;
    }
  }
  parent.insertBefore(element,null);
};
TabGroupsManager.utils.deleteFromAnonidToAnonid=function(parent,from,to){
  var element=parent.firstChild;
  if(from){
    element=parent.firstChild;
    for(;element&&element.getAttribute("anonid")!=from;element=element.nextSibling);
    element=element.nextSibling;
  }
  while(element&&(!to || element.getAttribute("anonid")!=to)){
    var nextElement=element.nextSibling;
    parent.removeChild(element);
    element=nextElement;
  }
};
TabGroupsManager.utils.popupNotContextMenuOnRightClick=function(event){
  if(event.button==2){
    var element=event.currentTarget;
    if(element.hasAttribute("context")){
      element.contextBak=element.getAttribute("context");
      element.removeAttribute("context");
    }
    if(element.contextBak){
      for(var tmp=event.target;tmp&&tmp.getAttribute;tmp=tmp.parentNode){
        var context=tmp.getAttribute("context")|| tmp.contextBak;
        if(context){
          if(context==element.contextBak){
            document.getElementById(element.contextBak).openPopup(null,null,event.clientX,event.clientY,false,true);
          }
          return;
        }
      }
    }
  }
};
TabGroupsManager.utils.createNewNsiUri=function(aSpec){
  return this.nsIIOService.newURI(aSpec,null,null);
};
TabGroupsManager.utils.getTabFromDOMWindow=function(DOMWindow){
  try
  {
    if(DOMWindow){
      let index=gBrowser.getBrowserIndexForDocument(DOMWindow.top.document);
      return(index!=-1)?gBrowser.tabContainer.childNodes[index]:null;
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return null;
};
TabGroupsManager.utils.setRemoveAttribute=function(element,key,value){
  if(value){
    element.setAttribute(key,value);
  }else{
    element.removeAttribute(key);
  }
};
TabGroupsManager.utils.traceProperty=function(root){
  let target=root;
  for(let i=1;i<arguments.length&&target;i++){
    target=target[arguments[i]];
  }
  return target;
};
TabGroupsManager.utils.hideTab=function(tab) {
  if (('undefined' !== typeof tab) && (tab) ) {
    tab.setAttribute("hidden","true");
    gBrowser._visibleTabs = null; // invalidate cache
	gBrowser.hideTab(tab);
  }
};
TabGroupsManager.utils.unHideTab=function(tab) {
  if (('undefined' !== typeof tab) && (tab) ) {
    tab.removeAttribute("hidden");
    tab.removeAttribute("collapsed");
    gBrowser._visibleTabs = null; // invalidate cache
	gBrowser.showTab(tab);
  }
};
/**
 * Function to search for strings in DataTransfer types
 * Compatibility with >= FF51
 * @param eventDataTransfer DataTransfer from a event.
 * @param needle string to search for in DataTransfer types.
 * @returns {boolean}
 */
TabGroupsManager.utils.dataTransferTypesContains=function(eventDataTransfer, needle) {
  let result = false;
  if (('undefined' !== typeof eventDataTransfer) && (eventDataTransfer) ) {
    var dataTransferTypes = eventDataTransfer.mozTypesAt(0);
    if ((dataTransferTypes.length > 0) && (dataTransferTypes.contains(needle))) {
      result = true;
    }
  }
  return result;
};
TabGroupsManager.tabMoveByTGM=
{
  tabMovingByTGM:false,
  cancelTabMoveEventOfTreeStyleTab:false,
  moveTabTo:function(tab,to){
    this.tabMovingByTGM=true;
    var backupNextTabOfTMP=gBrowser.mTabContainer.nextTab;
    try
    {
      gBrowser.moveTabTo(tab,to);
    }
    finally
    {
      this.tabMovingByTGM=false;
      if(backupNextTabOfTMP){
        gBrowser.mTabContainer.nextTab=backupNextTabOfTMP;
      }
    }
  },
  moveTabToWithoutTST:function(tab,to){
    if("treeStyleTab" in gBrowser){
      gBrowser.treeStyleTab.partTab(tab);
    }
    this.cancelTabMoveEventOfTreeStyleTab=true;
    try
    {
      this.moveTabTo(tab,to);
    }
    finally
    {
      this.cancelTabMoveEventOfTreeStyleTab=false;
    }
  }
};
TabGroupsManager.XulElements=function(){
  this.groupBar=document.getElementById("TabGroupsManagerToolbar");
  this.groupTabs=document.getElementById("TabGroupsManagerGroupbar");
  this.tabBar=document.getElementById("TabsToolbar");
  if(!this.tabBar){
    this.tabBar=TabGroupsManager.utils.getElementByIdAndAnonids("content","strip");
  }
};
TabGroupsManager.Preferences=function(){
  try
  {
    this.isMac=navigator.platform.match(/mac/i);
    this.firefoxAppInfo=Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
    this.versionComparator=Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
    this.prefService=Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
    this.prefRoot=Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
    this.prefBranch=this.prefService.getBranch("extensions.tabgroupsmanager.");
    this.prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    this.prefBranch.addObserver("",this,false);
    this.hideGroupBarByContentClick=this.prefBranch.getBoolPref("hideGroupBarByContentClick");
    this.groupBarSmoothScroll=this.prefBranch.getBoolPref("groupBarSmoothScroll");
    this.hideGroupBarByMouseover=this.prefBranch.getBoolPref("hideGroupBarByMouseover");
    this.hideGroupBarByMouseout=this.prefBranch.getBoolPref("hideGroupBarByMouseout");
    this.hideGroupBarByMouseoutTimer=this.prefBranch.getIntPref("hideGroupBarByMouseoutTimer");
    this.hideGroupBarByTabGroupCount=this.prefBranch.getIntPref("hideGroupBarByTabGroupCount");
    this.groupBarPosition=this.prefBranch.getIntPref("groupBarPosition");
    this.groupBarOrdinal=this.prefBranch.getIntPref("groupBarOrdinal");
    this.tabBarOrdinal=this.prefBranch.getIntPref("tabBarOrdinal");
    this.dispGroupTabIcon=this.prefBranch.getBoolPref("dispGroupTabIcon");
    this.observe(null,"nsPref:changed","dispGroupTabIconReading");
    this.dispGroupTabCount=this.prefBranch.getBoolPref("dispGroupTabCount");
    this.dispGroupTabCountReading=this.prefBranch.getBoolPref("dispGroupTabCountReading");
    this.groupTabMinWidth=this.prefBranch.getIntPref("groupTabMinWidth");
    this.groupTabMaxWidth=this.prefBranch.getIntPref("groupTabMaxWidth");
    this.reduceSuspendGroup=this.prefBranch.getBoolPref("reduceSuspendGroup");
    this.groupTabCrop=this.prefBranch.getIntPref("groupTabCrop");
    document.getElementById("TabGroupsManagerGroupBarScrollbox").smoothScroll=this.groupBarSmoothScroll;
    switch(this.groupBarPosition){
      case 2:
        document.getElementById("appcontent").insertBefore(TabGroupsManager.xulElements.groupBar,document.getElementById("content").nextSibling);
      break;
    }
    if(!("toolbar_order" in window)){
      TabGroupsManager.xulElements.groupBar.setAttribute("ordinal",this.groupBarOrdinal);
      let tabBar=document.getElementById("TabsToolbar");
      if(tabBar){
        tabBar.setAttribute("ordinal",this.tabBarOrdinal);
      }
    }
    this.observe(null,"nsPref:changed","normalGroupStyle");
    this.observe(null,"nsPref:changed","selectedGroupStyle");
    this.observe(null,"nsPref:changed","unreadGroupStyle");
    this.observe(null,"nsPref:changed","suspendedGroupStyle");
    this.groupMClick=this.prefBranch.getIntPref("groupMClick");
    this.groupDblClick=this.prefBranch.getIntPref("groupDblClick");
    this.groupDblRClick=this.prefBranch.getIntPref("groupDblRClick");
    this.groupBarLClick=this.prefBranch.getIntPref("groupBarLClick");
    this.groupBarMClick=this.prefBranch.getIntPref("groupBarMClick");
    this.groupBarDblClick=this.prefBranch.getIntPref("groupBarDblClick");
    this.buttonOpenLClick=this.prefBranch.getIntPref("buttonOpenLClick");
    this.buttonOpenMClick=this.prefBranch.getIntPref("buttonOpenMClick");
    this.buttonOpenDblClick=this.prefBranch.getIntPref("buttonOpenDblClick");
    this.buttonSleepLClick=this.prefBranch.getIntPref("buttonSleepLClick");
    this.buttonSleepMClick=this.prefBranch.getIntPref("buttonSleepMClick");
    this.buttonSleepDblClick=this.prefBranch.getIntPref("buttonSleepDblClick");
    this.buttonCloseLClick=this.prefBranch.getIntPref("buttonCloseLClick");
    this.buttonCloseMClick=this.prefBranch.getIntPref("buttonCloseMClick");
    this.buttonCloseDblClick=this.prefBranch.getIntPref("buttonCloseDblClick");
    this.buttonDispMClick=this.prefBranch.getIntPref("buttonDispMClick");
    this.setButtonType("TabGroupsManagerButtonSleep",this.buttonSleepLClick);
    this.setButtonType("TabGroupsManagerButtonClose",this.buttonCloseLClick);
    this.setButtonType("TabGroupsManagerButtonOpen",this.buttonOpenLClick);
    this.keyBindJson=this.prefBranch.getCharPref("keyBindJson");
    this.keyBindOverride=this.prefBranch.getBoolPref("keyBindOverride");
    this.ctrlTab=this.prefBranch.getIntPref("ctrlTab");
    this.openNewGroupOperation=this.prefBranch.getBoolPref("openNewGroupOperation");
    this.openNewGroupByShift=this.prefBranch.getBoolPref("openNewGroupByShift");
    this.observe(null,"nsPref:changed","groupMenuOpen");
    this.observe(null,"nsPref:changed","groupMenuOpenActive");
    this.observe(null,"nsPref:changed","groupMenuOpenRename");
    this.observe(null,"nsPref:changed","groupMenuOpenActiveRename");
    this.observe(null,"nsPref:changed","groupMenuOpenWithHome");
    this.observe(null,"nsPref:changed","groupMenuOpenActiveWithHome");
    this.observe(null,"nsPref:changed","groupMenuOpenByRenameHistory");
    this.observe(null,"nsPref:changed","groupMenuSleepActiveGroup");
    this.observe(null,"nsPref:changed","groupMenuCloseActiveGroup");
    this.observe(null,"nsPref:changed","groupMenuSleepingGroups");
    this.observe(null,"nsPref:changed","groupMenuClosedGroups");
    this.observe(null,"nsPref:changed","groupMenuBookmarkAllGroups");
    this.observe(null,"nsPref:changed","groupMenuBackupSession");
    this.tabMenuSendToOtherGroup=this.prefBranch.getBoolPref("tabMenuSendToOtherGroup");
    this.tabMenuCloseOtherTabInGroup=this.prefBranch.getBoolPref("tabMenuCloseOtherTabInGroup");
    this.tabMenuCloseLeftTabInGroup=this.prefBranch.getBoolPref("tabMenuCloseLeftTabInGroup");
    this.tabMenuSelectLeftTabInGroup=this.prefBranch.getBoolPref("tabMenuSelectLeftTabInGroup");
    this.tabMenuCloseRightTabInGroup=this.prefBranch.getBoolPref("tabMenuCloseRightTabInGroup");
    this.tabMenuSelectRightTabInGroup=this.prefBranch.getBoolPref("tabMenuSelectRightTabInGroup");
    this.groupRestoreOldPosition=this.prefBranch.getBoolPref("groupRestoreOldPosition");
    this.maxClosedTabStoreCount=this.prefBranch.getIntPref("maxClosedTabStoreCount");
    this.autoRenameDisableTime=this.prefBranch.getIntPref("autoRenameDisableTime");
    this.focusTabWhenActiveTabClosed=this.prefBranch.getIntPref("focusTabWhenActiveTabClosed");
    this.groupNotCloseWhenCloseAllTabsInGroup=this.prefBranch.getBoolPref("groupNotCloseWhenCloseAllTabsInGroup");
    this.processWhenWindowClose=this.prefBranch.getIntPref("processWhenWindowClose");
    this.tabTreeAnalysis=this.prefBranch.getBoolPref("tabTreeAnalysis");
    this.tabTreeOpenTabByExternalApplication=this.prefBranch.getBoolPref("tabTreeOpenTabByExternalApplication");
    this.tabTreeOpenTabByJavaScript=this.prefBranch.getBoolPref("tabTreeOpenTabByJavaScript");
    this.tabTreeRecordParentAndChild=this.prefBranch.getBoolPref("tabTreeRecordParentAndChild");
    this.tabTreeDisplayParentAndChild=this.prefBranch.getBoolPref("tabTreeDisplayParentAndChild");
    this.tabTreeFocusTabByParentAndChild=this.prefBranch.getBoolPref("tabTreeFocusTabByParentAndChild");
    if(this.tabTreeOpenTabByJavaScript){
      this.prefRoot.setBoolPref("browser.tabs.insertRelatedAfterCurrent",false);
    }
    this.startupMode=this.prefRoot.getIntPref("browser.startup.page");
    this.debug=this.prefBranch.getBoolPref("debug");
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.Preferences.prototype.destructor=function(){
  if(this.prefBranch){
    this.prefBranch.removeObserver("",this);
  }
};
TabGroupsManager.Preferences.prototype.observe=function(aSubject,aTopic,aData){
  if(aTopic!="nsPref:changed"){
    return;
  }
  switch(aData){
    case"groupBarSmoothScroll":
      this.groupBarSmoothScroll=this.prefBranch.getBoolPref("groupBarSmoothScroll");
      document.getElementById("TabGroupsManagerGroupBarScrollbox").smoothScroll=this.groupBarSmoothScroll;
      break;
    case"hideGroupBarByContentClick":
      this.hideGroupBarByContentClick=this.prefBranch.getBoolPref("hideGroupBarByContentClick");
      if(this.hideGroupBarByContentClick){
        TabGroupsManager.groupBarDispHide.setContentClickEvent();
      }else{
        TabGroupsManager.groupBarDispHide.removeContentClickEvent();
      }
      break;
    case"hideGroupBarByMouseover":
      this.hideGroupBarByMouseover=this.prefBranch.getBoolPref("hideGroupBarByMouseover");
      if(this.hideGroupBarByMouseover){
        TabGroupsManager.groupBarDispHide.setMouseoverEvent();
      }else{
        TabGroupsManager.groupBarDispHide.removeMouseoverEvent();
        TabGroupsManager.groupBarDispHide.dispGroupBar=true;
      }
      break;
    case"hideGroupBarByMouseout":
      this.hideGroupBarByMouseout=this.prefBranch.getBoolPref("hideGroupBarByMouseout");
      if(this.hideGroupBarByMouseout){
        TabGroupsManager.groupBarDispHide.setMouseoutEvent();
        TabGroupsManager.groupBarDispHide.dispGroupBar=false;
      }else{
        TabGroupsManager.groupBarDispHide.removeMouseoutEvent();
        TabGroupsManager.groupBarDispHide.dispGroupBar=true;
      }
      break;
    case"hideGroupBarByMouseoutTimer":this.hideGroupBarByMouseoutTimer=this.prefBranch.getIntPref("hideGroupBarByMouseoutTimer");break;
    case"groupBarOrdinal":
      this.groupBarOrdinal=this.prefBranch.getIntPref("groupBarOrdinal");
      if(!("toolbar_order" in window)){
        TabGroupsManager.xulElements.groupBar.setAttribute("ordinal",this.groupBarOrdinal);
      }
    break;
    case"tabBarOrdinal":
      this.tabBarOrdinal=this.prefBranch.getIntPref("tabBarOrdinal");
      if(!("toolbar_order" in window)){
        let tabBar=document.getElementById("TabsToolbar");
        if(tabBar){
          tabBar.setAttribute("ordinal",this.tabBarOrdinal);
        }
      }
    break;
    case"hideGroupBarByTabGroupCount":
      this.hideGroupBarByTabGroupCount=this.prefBranch.getIntPref("hideGroupBarByTabGroupCount");
      TabGroupsManager.groupBarDispHide.dispGroupBar=true;
      TabGroupsManager.xulElements.tabBar.removeAttribute("collapsed");
      TabGroupsManager.groupBarDispHide.hideGroupBarByGroupCount();
      TabGroupsManager.groupBarDispHide.hideGroupBarByTabCount();
    break;
    case"dispGroupTabIcon":
      this.dispGroupTabIcon=this.prefBranch.getBoolPref("dispGroupTabIcon");
      TabGroupsManager.allGroups.dispHideAllGroupIcon();
      break;
    case"dispGroupTabIconReading":
      this.dispGroupTabIconReading=this.prefBranch.getBoolPref("dispGroupTabIconReading");
      this.addOrRemoveStyleSheet(this.dispGroupTabIconReading,".tabgroupsmanager-grouptab-image-busy[busy] { display: -moz-box !important; }");
      break;
    case"dispGroupTabCount":
      this.dispGroupTabCount=this.prefBranch.getBoolPref("dispGroupTabCount");
      TabGroupsManager.allGroups.dispHideAllGroupTabCount();
      break;
    case"dispGroupTabCountReading":
      this.dispGroupTabCountReading=this.prefBranch.getBoolPref("dispGroupTabCountReading");
      TabGroupsManager.allGroups.dispAllGroupLabel();
      break;
    case"groupTabMinWidth":
      this.groupTabMinWidth=this.prefBranch.getIntPref("groupTabMinWidth");
      TabGroupsManager.allGroups.setMinWidthAllGroup();
      break;
    case"groupTabMaxWidth":
      this.groupTabMaxWidth=this.prefBranch.getIntPref("groupTabMaxWidth");
      TabGroupsManager.allGroups.setMaxWidthAllGroup();
      break;
    case"reduceSuspendGroup":
      this.reduceSuspendGroup=this.prefBranch.getBoolPref("reduceSuspendGroup");
      TabGroupsManager.allGroups.setReduceAllGroup();
      break;
    case"groupTabCrop":
      this.groupTabCrop=this.prefBranch.getIntPref("groupTabCrop");
      TabGroupsManager.allGroups.setCropAllGroup();
      break;
    case"normalGroupStyle":
    {
      let tmp=this.prefBranch.getCharPref("normalGroupStyle");
      if(!this.normalGroupStyle) this.normalGroupStyle = null;
      this.rewriteStyleSheet(".tabgroupsmanager-grouptab ", this.normalGroupStyle, tmp);
      this.normalGroupStyle = tmp;
      break;
    }
    case"selectedGroupStyle":
    {
      let tmp=this.prefBranch.getCharPref("selectedGroupStyle");
      if(!this.selectedGroupStyle) this.selectedGroupStyle = null;
      this.rewriteStyleSheet(".tabgroupsmanager-grouptab[selected='true'] ",this.selectedGroupStyle,tmp);
      this.selectedGroupStyle=tmp;
      break;
    }
    case"unreadGroupStyle":
    {
      let tmp=this.prefBranch.getCharPref("unreadGroupStyle");
      if(!this.unreadGroupStyle) this.unreadGroupStyle = null;
      this.rewriteStyleSheet(".tabgroupsmanager-grouptab[unread] ",this.unreadGroupStyle,tmp);
      this.unreadGroupStyle=tmp;
      break;
    }
    case"suspendedGroupStyle":
    {
      let tmp=this.prefBranch.getCharPref("suspendedGroupStyle");
      if(!this.suspendedGroupStyle) this.suspendedGroupStyle = null;
      this.rewriteStyleSheet(".tabgroupsmanager-grouptab[suspended] ",this.suspendedGroupStyle,tmp);
      this.suspendedGroupStyle=tmp;
      break;
    }
    case"groupMClick":this.groupMClick=this.prefBranch.getIntPref("groupMClick");break;
    case"groupDblClick":this.groupDblClick=this.prefBranch.getIntPref("groupDblClick");break;
    case"groupDblRClick":this.groupDblRClick=this.prefBranch.getIntPref("groupDblRClick");break;
    case"groupBarLClick":this.groupBarLClick=this.prefBranch.getIntPref("groupBarLClick");break;
    case"groupBarMClick":this.groupBarMClick=this.prefBranch.getIntPref("groupBarMClick");break;
    case"groupBarDblClick":this.groupBarDblClick=this.prefBranch.getIntPref("groupBarDblClick");break;
    case"buttonOpenMClick":this.buttonOpenMClick=this.prefBranch.getIntPref("buttonOpenMClick");break;
    case"buttonOpenDblClick":this.buttonOpenDblClick=this.prefBranch.getIntPref("buttonOpenDblClick");break;
    case"buttonSleepMClick":this.buttonSleepMClick=this.prefBranch.getIntPref("buttonSleepMClick");break;
    case"buttonSleepDblClick":this.buttonSleepDblClick=this.prefBranch.getIntPref("buttonSleepDblClick");break;
    case"buttonCloseMClick":this.buttonCloseMClick=this.prefBranch.getIntPref("buttonCloseMClick");break;
    case"buttonCloseDblClick":this.buttonCloseDblClick=this.prefBranch.getIntPref("buttonCloseDblClick");break;
    case"buttonDispMClick":this.buttonDispMClick=this.prefBranch.getIntPref("buttonDispMClick");break;
    case"buttonSleepLClick":
      this.buttonSleepLClick=this.prefBranch.getIntPref("buttonSleepLClick");
      this.setButtonType("TabGroupsManagerButtonSleep",this.buttonSleepLClick);
    break;
    case"buttonCloseLClick":
      this.buttonCloseLClick=this.prefBranch.getIntPref("buttonCloseLClick");
      this.setButtonType("TabGroupsManagerButtonClose",this.buttonCloseLClick);
    break;
    case"buttonOpenLClick":
      this.buttonOpenLClick=this.prefBranch.getIntPref("buttonOpenLClick");
      this.setButtonType("TabGroupsManagerButtonOpen",this.buttonOpenLClick);
    break;
    case"keyBindJson":
    case"keyBindOverride":
      this.keyBindJson=this.prefBranch.getCharPref("keyBindJson");
      this.keyBindOverride=this.prefBranch.getBoolPref("keyBindOverride");
      TabGroupsManager.keyboardShortcut.setKeyBind();
    break;
    case"ctrlTab":this.ctrlTab=this.prefBranch.getIntPref("ctrlTab");break;
    case"openNewGroupOperation":
      this.openNewGroupOperation=this.prefBranch.getBoolPref("openNewGroupOperation");
    break;
    case"openNewGroupByShift":this.openNewGroupByShift=this.prefBranch.getBoolPref("openNewGroupByShift");break;
    case"groupMenuOpen":this.groupMenuOpen=this.prefBranch.getBoolPref("groupMenuOpen");document.getElementById("TabGroupsManagerGroupMenuOpen").hidden=!this.groupMenuOpen;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuOpenActive":this.groupMenuOpenActive=this.prefBranch.getBoolPref("groupMenuOpenActive");document.getElementById("TabGroupsManagerGroupMenuOpenActive").hidden=!this.groupMenuOpenActive;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuOpenRename":this.groupMenuOpenRename=this.prefBranch.getBoolPref("groupMenuOpenRename");document.getElementById("TabGroupsManagerGroupMenuOpenRename").hidden=!this.groupMenuOpenRename;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuOpenActiveRename":this.groupMenuOpenActiveRename=this.prefBranch.getBoolPref("groupMenuOpenActiveRename");document.getElementById("TabGroupsManagerGroupMenuOpenActiveRename").hidden=!this.groupMenuOpenActiveRename;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuOpenWithHome":this.groupMenuOpenWithHome=this.prefBranch.getBoolPref("groupMenuOpenWithHome");document.getElementById("TabGroupsManagerGroupMenuOpenWithHome").hidden=!this.groupMenuOpenWithHome;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuOpenActiveWithHome":this.groupMenuOpenActiveWithHome=this.prefBranch.getBoolPref("groupMenuOpenActiveWithHome");document.getElementById("TabGroupsManagerGroupMenuOpenActiveWithHome").hidden=!this.groupMenuOpenActiveWithHome;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuOpenByRenameHistory":this.groupMenuOpenByRenameHistory=this.prefBranch.getBoolPref("groupMenuOpenByRenameHistory");document.getElementById("TabGroupsManagerGroupMenuOpenByRenameHistory").hidden=!this.groupMenuOpenByRenameHistory;document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden=!(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);break;
    case"groupMenuSleepActiveGroup":this.groupMenuSleepActiveGroup=this.prefBranch.getBoolPref("groupMenuSleepActiveGroup");document.getElementById("TabGroupsManagerGroupMenuSleepActiveGroup").hidden=!this.groupMenuSleepActiveGroup;document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden=!(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);break;
    case"groupMenuCloseActiveGroup":this.groupMenuCloseActiveGroup=this.prefBranch.getBoolPref("groupMenuCloseActiveGroup");document.getElementById("TabGroupsManagerGroupMenuCloseActiveGroup").hidden=!this.groupMenuCloseActiveGroup;document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden=!(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);break;
    case"groupMenuSleepingGroups":this.groupMenuSleepingGroups=this.prefBranch.getBoolPref("groupMenuSleepingGroups");document.getElementById("TabGroupsManagerGroupMenuSleepingGroups").hidden=!this.groupMenuSleepingGroups;document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden=!(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);break;
    case"groupMenuClosedGroups":this.groupMenuClosedGroups=this.prefBranch.getBoolPref("groupMenuClosedGroups");document.getElementById("TabGroupsManagerGroupMenuClosedGroups").hidden=!this.groupMenuClosedGroups;document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden=!(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);break;
    case"groupMenuBookmarkAllGroups":this.groupMenuBookmarkAllGroups=this.prefBranch.getBoolPref("groupMenuBookmarkAllGroups");document.getElementById("TabGroupsManagerGroupMenuBookmarkAllGroups").hidden=!this.groupMenuBookmarkAllGroups;document.getElementById("TabGroupsManagerGroupMenuSeparator3").hidden=!(this.groupMenuBookmarkAllGroups || this.groupMenuBackupSession);break;
    case"groupMenuBackupSession":this.groupMenuBackupSession=this.prefBranch.getBoolPref("groupMenuBackupSession");document.getElementById("TabGroupsManagerGroupMenuBackupSession").hidden=!this.groupMenuBackupSession;document.getElementById("TabGroupsManagerGroupMenuSeparator3").hidden=!(this.groupMenuBookmarkAllGroups || this.groupMenuBackupSession);break;
    case"tabMenuSendToOtherGroup":this.tabMenuSendToOtherGroup=this.prefBranch.getBoolPref("tabMenuSendToOtherGroup");break;
    case"tabMenuCloseOtherTabInGroup":this.tabMenuCloseOtherTabInGroup=this.prefBranch.getBoolPref("tabMenuCloseOtherTabInGroup");break;
    case"tabMenuCloseLeftTabInGroup":this.tabMenuCloseLeftTabInGroup=this.prefBranch.getBoolPref("tabMenuCloseLeftTabInGroup");break;
    case"tabMenuSelectLeftTabInGroup":this.tabMenuSelectLeftTabInGroup=this.prefBranch.getBoolPref("tabMenuSelectLeftTabInGroup");break;
    case"tabMenuCloseRightTabInGroup":this.tabMenuCloseRightTabInGroup=this.prefBranch.getBoolPref("tabMenuCloseRightTabInGroup");break;
    case"tabMenuSelectRightTabInGroup":this.tabMenuSelectRightTabInGroup=this.prefBranch.getBoolPref("tabMenuSelectRightTabInGroup");break;
    case"maxClosedTabStoreCount":
      this.maxClosedTabStoreCount=this.prefBranch.getIntPref("maxClosedTabStoreCount");
      TabGroupsManager.closedGroups.setMaxLength(this.maxClosedTabStoreCount);
    break;
    case"groupRestoreOldPosition":this.groupRestoreOldPosition=this.prefBranch.getBoolPref("groupRestoreOldPosition");break;
    case"autoRenameDisableTime":this.autoRenameDisableTime=this.prefBranch.getIntPref("autoRenameDisableTime");break;
    case"focusTabWhenActiveTabClosed":this.focusTabWhenActiveTabClosed=this.prefBranch.getIntPref("focusTabWhenActiveTabClosed");break;
    case"groupNotCloseWhenCloseAllTabsInGroup":this.groupNotCloseWhenCloseAllTabsInGroup=this.prefBranch.getBoolPref("groupNotCloseWhenCloseAllTabsInGroup");break;
    case"processWhenWindowClose":this.processWhenWindowClose=this.prefBranch.getIntPref("processWhenWindowClose");break;
    case"debug":this.debug=this.prefBranch.getBoolPref("debug");break;
  }
};
TabGroupsManager.Preferences.prototype.setButtonType=function(id,value){
  let element=document.getElementById(id);
  if(element){
    if(value&256){
      element.type="menu-button";
    }else if(value==99){
      element.type="menu";
    }else{
      element.type="";
    }
  }
};
TabGroupsManager.Preferences.prototype.firefoxVersionCompare=function(target){
  return this.versionComparator.compare(this.firefoxAppInfo.version,target);
};
TabGroupsManager.Preferences.prototype.firefoxVersion=function(){
  return this.firefoxAppInfo.version.substr(0, this.firefoxAppInfo.version.indexOf('.'));
};
TabGroupsManager.Preferences.prototype.addStyleSheet=function(text){
  var sss=Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  var uri=TabGroupsManager.utils.createNewNsiUri("data:text/css,"+encodeURIComponent("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul); "+text));
  if(!sss.sheetRegistered(uri,sss.USER_SHEET)){
    sss.loadAndRegisterSheet(uri,sss.USER_SHEET);
  }
};
TabGroupsManager.Preferences.prototype.removeStyleSheet=function(text){
  var sss=Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  var uri=TabGroupsManager.utils.createNewNsiUri("data:text/css,"+encodeURIComponent("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul); "+text));
  if(sss.sheetRegistered(uri,sss.USER_SHEET)){
    sss.unregisterSheet(uri,sss.USER_SHEET);
  }
};
TabGroupsManager.Preferences.prototype.addOrRemoveStyleSheet=function(flag,text){
  if(flag){
    this.addStyleSheet(text);
  }else{
    this.removeStyleSheet(text);
  }
};
TabGroupsManager.Preferences.prototype.rewriteStyleSheet=function(base,oldStyle,newStyle){
  if(oldStyle==newStyle){
    return;
  }
  if(oldStyle){
    this.removeStyleSheet(base+" { "+oldStyle+" } ");
  }
  if(newStyle){
    this.addStyleSheet(base+" { "+newStyle+" } ");
  }
};
TabGroupsManager.Preferences.prototype.openPrefWindow=function(){
  window.openDialog("chrome://tabgroupsmanager/content/options.xul","TabGroupsManagerSettingsWindow","chrome,titlebar,toolbar,centerscreen");
};
TabGroupsManager.KeyboardShortcut=function(){
  this.keyset=null;
  this.setKeyBind();
};
TabGroupsManager.KeyboardShortcut.prototype.setKeyBind=function(){
  try
  {
    this.removeKeybind();
    var keyBind=this.readKeyBindJson();
    this.deleteDuplicatedKeyBind(keyBind);
    this.setMyKeyBind(keyBind);
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.KeyboardShortcut.prototype.removeKeybind=function(){
  if(this.keyset){
    for(var i=this.keyset.childNodes.length-1;i>=0;i--){
      this.keyset.removeChild(this.keyset.childNodes[i]);
    }
    this.keyset.parentNode.removeChild(this.keyset);
    this.keyset=null;
  }
};
TabGroupsManager.KeyboardShortcut.prototype.readKeyBindJson=function(){
  let keyBindTmp=JSON.parse(TabGroupsManager.preferences.keyBindJson);
  let keyBind=new Array();
  for(var i=0;i<keyBindTmp.length;i++){
    if(keyBindTmp[i][0]&&keyBindTmp[i][1]){
      let splitKey=keyBindTmp[i][0].split(/ *\| */);
      if(splitKey.length>1&&splitKey[1]!=""){
        let keyBindOne={};
        keyBind.push(keyBindOne);
        keyBindOne.keycode="VK_"+splitKey[1];
        keyBindOne.modifiers=((-1!=splitKey[0].indexOf("c")?"control ":"")+(-1!=splitKey[0].indexOf("s")?"shift ":"")+(-1!=splitKey[0].indexOf("a")?"alt ":"")+(-1!=splitKey[0].indexOf("m")?"meta ":"")).replace(/ $/,"");
        keyBindOne.code=keyBindTmp[i][1];
        if(keyBindTmp[i].length>2){
          keyBindOne.params=keyBindTmp[i].slice(2);
        }
      }
    }
  }
  return keyBind;
};
TabGroupsManager.KeyboardShortcut.prototype.deleteDuplicatedKeyBind=function(keyBind){
  if(TabGroupsManager.preferences.keyBindOverride){
    var keysetList=document.getElementsByTagName("keyset");
    for(var i=0;i<keysetList.length;i++){
      for(var j=0;j<keysetList[i].childNodes.length;j++){
        var oldKeyBind=keysetList[i].childNodes[j];
        var modifiersTmp=oldKeyBind.getAttribute("modifiers");
        var modifiers=(modifiersTmp.match(/control|accel/i)?"control ":""+modifiersTmp.match(/shift/i)?"shift ":""+modifiersTmp.match(/alt|access/i)?"alt ":""+modifiersTmp.match(/meta/i)?"meta ":"").replace(/ $/,"");
        var keycode=oldKeyBind.getAttribute("keycode").toUpperCase();
        if(!keycode){
          keycode="VK_"+oldKeyBind.getAttribute("key").toUpperCase();
        }
        for(var k=0;k<keyBind.length;k++){
          if(keyBind[k].modifiers==modifiers&&keyBind[k].keycode==keycode){
            oldKeyBind.setAttribute("disabled",true);
          }
        }
      }
    }
  }
};
TabGroupsManager.KeyboardShortcut.prototype.setMyKeyBind=function(keyBind){
  this.keyset=document.documentElement.appendChild(document.createElement("keyset"));
  for(var i=0;i<keyBind.length;i++){
    var key=this.keyset.appendChild(document.createElement("key"));
    key.setAttribute("modifiers",keyBind[i].modifiers);
    if(keyBind[i].keycode.length>4){
      key.setAttribute("keycode",keyBind[i].keycode);
    }else{
      key.setAttribute("key",keyBind[i].keycode.substr(3));
    }

    //key.setAttribute("oncommand","TabGroupsManager.keyboardShortcut.onCommand( event );");
    key.addEventListener("command", function(event)
    {
      TabGroupsManager.keyboardShortcut.onCommand(event);
    }, false);

    key.commandCode=keyBind[i].code;
    if(keyBind[i].params){
      key.commandParams=keyBind[i].params.slice(0);
    }
  }
};
TabGroupsManager.KeyboardShortcut.prototype.onCommand=function(event){
  switch(event.target.commandCode){
    case 0:TabGroupsManager.command.OpenNewGroup();break;
    case 1:TabGroupsManager.command.OpenNewGroupActive();break;
    case 2:TabGroupsManager.command.OpenNewGroupRename();break;
    case 3:TabGroupsManager.command.OpenNewGroupRenameActive();break;
    case 4:TabGroupsManager.command.OpenNewGroupHome();break;
    case 5:TabGroupsManager.command.OpenNewGroupHomeActive();break;
    case 10:TabGroupsManager.command.SleepActiveGroup();break;
    case 11:TabGroupsManager.command.RestoreLatestSleepedGroup();break;
    case 12:TabGroupsManager.command.SleepingGroupList();break;
    case 20:TabGroupsManager.command.CloseActiveGroup();break;
    case 21:TabGroupsManager.command.RestoreLatestClosedGroup();break;
    case 22:TabGroupsManager.command.ClosedGroupList();break;
    case 30:TabGroupsManager.command.SuspendActiveGroup();break;
    case 40:TabGroupsManager.command.SelectLeftGroup();break;
    case 41:TabGroupsManager.command.SelectRightGroup();break;
    case 42:TabGroupsManager.command.SelectLastGroup();break;
    case 43:TabGroupsManager.command.SelectNthGroup(event.target.commandParams[0]-1);break;
    case 44:TabGroupsManager.command.SelectLeftTabInGroup();break;
    case 45:TabGroupsManager.command.SelectRightTabInGroup();break;
    case 46:TabGroupsManager.command.SelectLastTabInGroup();break;
    case 47:TabGroupsManager.command.SelectNthTabInGroup(event.target.commandParams[0]-1);break;
    case 50:TabGroupsManager.command.DisplayHideGroupBar();break;
    case 60:TabGroupsManager.command.ActiveGroupMenu();break;
    case 61:TabGroupsManager.command.GroupBarMenu();break;
  }
};
TabGroupsManager.KeyboardState=function(){
  try
  {
    this.fCtrlKey=false;
    this.fShiftKey=false;
    this.fAltKey=false;
    this.fMetaKey=false;
    this.eventObject=null;
    this.__defineGetter__("ctrlKey",this.getCtrlKey);
    this.__defineGetter__("shiftKey",this.getShiftKey);
    this.__defineGetter__("altKey",this.getAltKey);
    this.__defineGetter__("metaKey",this.getMetaKey);
    this.__defineGetter__("mouseButton",this.mouseButton);
    this.createEventListener();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.KeyboardState.prototype.createEventListener=function(){
  window.addEventListener("click",this,true);
  window.addEventListener("mousedown",this,true);
  window.addEventListener("mouseup",this,true);
  window.addEventListener("keydown",this,true);
  window.addEventListener("keyup",this,true);
  window.addEventListener("keypress",this,true);
};
TabGroupsManager.KeyboardState.prototype.destroyEventListener=function(){
  window.removeEventListener("click",this,true);
  window.removeEventListener("mousedown",this,true);
  window.removeEventListener("mouseup",this,true);
  window.removeEventListener("keydown",this,true);
  window.removeEventListener("keyup",this,true);
  window.removeEventListener("keypress",this,true);
};
TabGroupsManager.KeyboardState.prototype.handleEvent=function(event){
  switch(event.type){
    case"click":
    case"mousedown":
    case"mouseup":
    case"keydown":
    case"keyup":this.getModifierKeys(event);break;
    case"keypress":this.onKeyPress(event);break;
  }
};
TabGroupsManager.KeyboardState.prototype.onKeyPress=function(event){
  if(event.keyCode==event.DOM_VK_TAB&&!event.altKey&&this.isAccelKeyDown(event)){
    if(event.shiftKey){
      switch(TabGroupsManager.preferences.ctrlTab){
        case 0:TabGroupsManager.allGroups.selectedGroup.selectLeftLoopTabInGroup();break;
        case 1:TabGroupsManager.allGroups.selectRightGroup();break;
        default:return;
      }
    }else{
      switch(TabGroupsManager.preferences.ctrlTab){
        case 0:
        case 1:TabGroupsManager.allGroups.selectedGroup.selectRightLoopTabInGroup();break;
        default:return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
};
TabGroupsManager.KeyboardState.prototype.selectObject=function(){
  if(this.eventObject){
    return this.eventObject;
  }else if(("easyDragToGo" in window)&&window.easyDragToGo.onDropEvent){
    return window.easyDragToGo.onDropEvent;
  }
  return null;
};
TabGroupsManager.KeyboardState.prototype.getCtrlKey=function(){
  var object=this.selectObject();
  return object?object.ctrlKey:this.fCtrlKey;
};
TabGroupsManager.KeyboardState.prototype.getShiftKey=function(){
  var object=this.selectObject();
  return object?object.shiftKey:this.fShiftKey;
};
TabGroupsManager.KeyboardState.prototype.getAltKey=function(){
  var object=this.selectObject();
  return object?object.altKey:this.fAltKey;
};
TabGroupsManager.KeyboardState.prototype.getMetaKey=function(){
  var object=this.selectObject();
  return object?object.metaKey:this.fMetaKey;
};
TabGroupsManager.KeyboardState.prototype.mouseButton=function(){
  var eventObject=this.selectObject();
  if(!eventObject){
    return null;
  }
  return eventObject.button;
};
TabGroupsManager.KeyboardState.prototype.getModifierKeys=function(event){
  try
  {
    if(undefined!=event.ctrlKey)this.fCtrlKey=event.ctrlKey;
    if(undefined!=event.shiftKey)this.fShiftKey=event.shiftKey;
    if(undefined!=event.altKey)this.fAltKey=event.altKey;
    if(undefined!=event.metaKey)this.fMetaKey=event.metaKey;
  }
  catch(e){
  }
};
TabGroupsManager.KeyboardState.prototype.isAccelKeyDown=function(event){
  return(TabGroupsManager.preferences.isMac?event.metaKey:event.ctrlKey);
};
TabGroupsManager.Places=function(){
  try
  {
    this.bookmarksService=Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
    this.allOpenInNewGroupString=document.getElementById("TabGroupsManagerPlacesAllOpenInNewGroup").label;
    this.allOpenInSelectedGroupString=document.getElementById("TabGroupsManagerPlacesAllOpenInSelectedGroup").label;
    let modifyList=["bookmarksBarContent","PlacesToolbar","bookmarksMenuPopup","bookmarks-menu-button","PlacesChevron"];
    for(let i=0;i<modifyList.length;i++){
      let element=document.getElementById(modifyList[i]);
      if(element){
        element.addEventListener("click",this,true);
        element.addEventListener("dblclick",this,true);
      }
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.Places.prototype.addAllOpenInGroupMenuitem=function(target){
  target._openAllInNewGroup=document.createElement("menuitem");
  target._openAllInNewGroup.setAttribute("id","TabGroupsManagerMenuitemAllOpenInNewGroup");

  //target._openAllInNewGroup.setAttribute("oncommand","TabGroupsManager.places.menuitemAllOpenInNewGroupCommand( event );");
  target._openAllInNewGroup.addEventListener("command", function(event)
  {
    TabGroupsManager.places.menuitemAllOpenInNewGroupCommand(event);
  }, false);

  //target._openAllInNewGroup.setAttribute("onclick","TabGroupsManager.places.menuitemAllOpenInNewGroupClick( event );");
  target._openAllInNewGroup.addEventListener("click", function(event)
  {
    TabGroupsManager.places.menuitemAllOpenInNewGroupClick(event);
  }, false);

  target._openAllInNewGroup.setAttribute("label",this.allOpenInNewGroupString);
  target.appendChild(target._openAllInNewGroup);
  target._openAllInSelectedGroup=document.createElement("menuitem");
  target._openAllInSelectedGroup.setAttribute("id","TabGroupsManagerMenuitemAllOpenInSelectedGroup");

  //target._openAllInSelectedGroup.setAttribute("oncommand","TabGroupsManager.places.menuitemAllOpenInSelectedGroupCommand( event );");
  target._openAllInSelectedGroup.addEventListener("command", function(event)
  {
    TabGroupsManager.places.menuitemAllOpenInSelectedGroupCommand(event);
  }, false);

  //target._openAllInSelectedGroup.setAttribute("onclick","TabGroupsManager.places.menuitemAllOpenInSelectedGroupClick( event );");
  target._openAllInSelectedGroup.addEventListener("click", function(event)
  {
    TabGroupsManager.places.menuitemAllOpenInSelectedGroupClick(event);
  }, false);

  target._openAllInSelectedGroup.setAttribute("label",this.allOpenInSelectedGroupString);
  target.appendChild(target._openAllInSelectedGroup);
};
TabGroupsManager.Places.prototype.removeAllOpenInGroupMenuitem=function(target){
  target.removeChild(target._openAllInNewGroup);
  target.removeChild(target._openAllInSelectedGroup);
  delete target._openAllInNewGroup;
  delete target._openAllInSelectedGroup;
};
TabGroupsManager.Places.prototype.menuitemAllOpenInNewGroupCommand=function(event){
  this.allOpenInNewGroup(event.target.parentNode.parentNode.node);
};
TabGroupsManager.Places.prototype.menuitemAllOpenInNewGroupClick=function(event){
  if(event.button==1){
    this.allOpenInNewGroup(event.target.parentNode.parentNode.node);
    event.preventDefault();
    event.stopPropagation();
  }
};
TabGroupsManager.Places.prototype.menuitemAllOpenInSelectedGroupCommand=function(event){
  this.allOpenInSelectedGroup(event.target.parentNode.parentNode.node);
};
TabGroupsManager.Places.prototype.menuitemAllOpenInSelectedGroupClick=function(event){
  if(event.button==1){
    this.allOpenInSelectedGroup(event.target.parentNode.parentNode.node);
    event.preventDefault();
    event.stopPropagation();
  }
};
TabGroupsManager.Places.prototype.handleEvent=function(event){
  switch(event.type){
    case"click":this.onClick(event);break;
    case"dblclick":this.onDblClick(event);break;
  }
};
TabGroupsManager.Places.prototype.onClick=function(event){
  switch(event.button){
    case 0:this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderLClick,event);break;
    case 1:this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderMClick,event);break;
  }
};
TabGroupsManager.Places.prototype.onDblClick=function(event){
  if(event.button==0){
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderDblClick,event);
  }
};
TabGroupsManager.Places.prototype.execBookmarkFolderClick=function(no,event){
  if(no==-1){
    return;
  }
  let result;
  if(no>2){
    result=this.allOpenInSelectedGroup(event.target._placesNode || event.target.node);
  }else if(no>0){
    result=this.allOpenInNewGroup(event.target._placesNode || event.target.node);
  }
  if(result){
    if(no % 2!=0){
      for(let node=event.target.parentNode;node;node=node.parentNode){
        if(node.localName=="menupopup"){
          node.hidePopup();
        }
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
};
TabGroupsManager.Places.prototype.openInNewGroup=function(bookmarkItem){
  var groupName=bookmarkItem.title;
  var icon=bookmarkItem.icon?bookmarkItem.icon.spec:"";
  var newTab=TabGroupsManager.overrideMethod.gBrowserAddTab(bookmarkItem.uri);
  return TabGroupsManager.allGroups.openNewGroup(newTab,undefined,groupName,icon);
};
TabGroupsManager.Places.prototype.openInSelectedGroup=function(bookmarkItem){
  var group=this.openInNewGroup(bookmarkItem);
  TabGroupsManager.allGroups.selectedGroup=group;
};
TabGroupsManager.Places.prototype.allOpenInNewGroup=function(bookmarkFolder){
  if(!bookmarkFolder ||!PlacesUtils.nodeIsFolder(bookmarkFolder)){
    return null;
  }
  bookmarkFolder=PlacesUtils.getFolderContents(bookmarkFolder.itemId).root;
  var count=0;
  for(var i=0;i<bookmarkFolder.childCount;i++){
    if(PlacesUtils.nodeIsBookmark(bookmarkFolder.getChild(i))){
      count++;
    }
  }
  if(count<=0){
    return null;
  }
  if(count>10){
    var message=TabGroupsManager.strings.getFormattedString("MenuItemAllOpenTooManyBookmarks",[count]);
    if(!window.confirm(message)){
      return null;
    }
  }
  var groupName=bookmarkFolder.title;
  var icon=bookmarkFolder.icon?bookmarkItem.icon.spec:"";
  var group=TabGroupsManager.allGroups.openNewGroupCore(undefined,groupName,icon);
  for(var i=0;i<bookmarkFolder.childCount;i++){
    var bookmarkItem=bookmarkFolder.getChild(i);
    if(PlacesUtils.nodeIsBookmark(bookmarkItem)){
      let tab=TabGroupsManager.overrideMethod.gBrowserAddTab(bookmarkItem.uri);
      group.addTab(tab);
    }
  }
  return group;
};
TabGroupsManager.Places.prototype.allOpenInSelectedGroup=function(bookmarkFolder){
  var group=this.allOpenInNewGroup(bookmarkFolder);
  if(group){
    group.setSelected();
  }
  return group;
};
TabGroupsManager.Session=function(){
  try
  {
    this.groupRestored=0;
    this.sessionRestoring=null;
    this.disableOnSSTabRestoring=false;
    this.sessionRestoreManually=false;
    this.sessionStore=Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    this.createEventListener();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.Session.prototype.createEventListener=function(){
  gBrowser.tabContainer.addEventListener("SSTabRestoring",this,false);
  window.addEventListener("SSWindowStateBusy",this,false);
  window.addEventListener("SSWindowStateReady",this,false);
};
TabGroupsManager.Session.prototype.destroyEventListener=function(){
  gBrowser.tabContainer.removeEventListener("SSTabRestoring",this,false);
  window.removeEventListener("SSWindowStateBusy",this,false);
  window.removeEventListener("SSWindowStateReady",this,false);
};
TabGroupsManager.Session.prototype.handleEvent=function(event){
  try
  {
    switch(event.type){
      case"SSTabRestoring":this.onSSTabRestoring(event);break;
      case"SSWindowStateBusy":this.onSSWindowStateBusy(event);break;
      case"SSWindowStateReady":this.onSSWindowStateReady(event);break;
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.Session.prototype.onSSWindowStateBusy=function(event){
  this.sessionRestoring=true;
};
TabGroupsManager.Session.prototype.onSSWindowStateReady=function(event){
  this.sessionRestoring=false;
  this.orphanTabsToGroup();
};
TabGroupsManager.Session.prototype.orphanTabsToGroup=function(){
  let group=TabGroupsManager.allGroups.getGroupById(-1)|| TabGroupsManager.allGroups.selectedGroup;
  for(let tab=gBrowser.tabContainer.firstChild;tab;tab=tab.nextSibling){
    if(!tab.group){
      group.addTab(tab);
    }
  }
};
TabGroupsManager.Session.prototype.onSSTabRestoring=function(event){
  TabGroupsManager.initializeAfterOnLoad();
  if(!this.disableOnSSTabRestoring){
    this.moveTabToGroupBySessionStore(event.originalTarget);
  }
};
TabGroupsManager.Session.prototype.moveTabToGroupBySessionStore=function(restoringTab){
  try
  {
    var groupId=this.getGroupId(restoringTab);
    if(isNaN(groupId)){
      groupId=(restoringTab.group)?restoringTab.group.id:TabGroupsManager.allGroups.selectedGroup.id;
      this.sessionStore.setTabValue(restoringTab,"TabGroupsManagerGroupId",groupId.toString());
    }
    if(restoringTab.group&&restoringTab.group.id==groupId){
      return;
    }
    var group=TabGroupsManager.allGroups.getGroupById(groupId);
    if(group){
      this.moveTabToGroupWithSuspend(group,restoringTab);
      return;
    }
    if(null==TabGroupsManagerJsm.applicationStatus.getGroupById(groupId)){
      var groupName=this.sessionStore.getTabValue(restoringTab,"TabGroupsManagerGroupName");
      var group=TabGroupsManager.allGroups.openNewGroupCore(groupId,groupName);
      this.moveTabToGroupWithSuspend(group,restoringTab);
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.Session.prototype.moveTabToGroupWithSuspend=function(group,tab){
  if(tab==gBrowser.selectedTab){
    group.suspended=false;
    group.addTab(tab,true);
    group.selectedTab=tab;
    group.setSelected();
  }else{
    group.addTab(tab,true);
  }
};
TabGroupsManager.Session.prototype.allTabsMoveToGroup=function(){
  this.allTabsMovingToGroup=true;
  try
  {
    for(let tab=gBrowser.tabContainer.firstChild;tab;tab=tab.nextSibling){
      let groupId=parseInt(this.sessionStore.getTabValue(tab,"TabGroupsManagerGroupId"),10);
      if(!isNaN(groupId)){
        if(!tab.group || tab.group.id!=groupId){
          let group=TabGroupsManager.allGroups.getGroupById(groupId);
          if(group){
            this.moveTabToGroupWithSuspend(group,tab);
          }
        }
      }else{
        if(!tab.group){
          let group=TabGroupsManager.allGroups.getGroupById(-1)|| TabGroupsManager.allGroups.selectedGroup;
          group.addTab(tab);
        }
        this.sessionStore.setTabValue(tab,"TabGroupsManagerGroupId",tab.group.id.toString());
        this.sessionStore.setTabValue(tab,"TabGroupsManagerGroupName",tab.group.name);
      }
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    delete this.allTabsMovingToGroup;
    TabGroupsManager.eventListener.onGroupSelect(null);
    let startGroup=TabGroupsManager.allGroups.getGroupById(-1);
    if(startGroup&&startGroup.tabArray.length==0){
      startGroup.close();
    }
  }
};
TabGroupsManager.Session.prototype.getGroupId=function(tab){
  return parseInt(this.sessionStore.getTabValue(tab,"TabGroupsManagerGroupId"),10);
};
TabGroupsManager.Session.prototype.setGroupNameAllTabsInGroup=function(group){
  for(var i=0;i<group.tabArray.length;i++){
    this.sessionStore.setTabValue(group.tabArray[i],"TabGroupsManagerGroupName",group.name);
  }
};
TabGroupsManager.Session.prototype.restoreGroupsAndSleepingGroupsAndClosedGroups=function(){
  if(this.groupRestored==0){
    TabGroupsManager.allGroups.loadAllGroupsData();
  }
};
TabGroupsManager.Session.prototype.backupByManually=function(){
  TabGroupsManagerJsm.saveData.backupByManually();
};
TabGroupsManager.Session.prototype.exportDataEmergency=function(message){
  let strings=window.TabGroupsManager.strings;
  alert(strings.getString(message)+strings.getString("ExportDataEmergency"));
  this.exportSession();
};
TabGroupsManager.Session.prototype.exportSession=function(){
  let nsIFilePicker=Ci.nsIFilePicker;
  let filePicker=Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  filePicker.init(window,null,nsIFilePicker.modeSave);
  filePicker.appendFilter(TabGroupsManager.strings.getString("SessionDataExtDescription")+"(*."+TabGroupsManagerJsm.constValues.sessionDataExt2+")","*."+TabGroupsManagerJsm.constValues.sessionDataExt2);
  filePicker.appendFilters(nsIFilePicker.filterAll);
  filePicker.defaultString="TabGroupsManager_Session_"+TabGroupsManagerJsm.applicationStatus.getNowString()+"."+TabGroupsManagerJsm.constValues.sessionDataExt2;
  filePicker.defaultExtension=TabGroupsManagerJsm.constValues.sessionDataExt2;
  let result=filePicker.show();
  if(result==nsIFilePicker.returnOK || result==nsIFilePicker.returnReplace){
    try
    {
      TabGroupsManagerJsm.saveData.saveFileFromTgmData(filePicker.file);
    }
    catch(e){
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
  }
};
TabGroupsManager.Session.prototype.onShowingBackupSessionMenu=function(event){
  var menuPopup=event.originalTarget;
  TabGroupsManager.session.onHiddenBackupSessionMenu(event);
  var flgmntNode=document.createDocumentFragment();
  let list=TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupSwapFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode,list,true);
  list=TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupManuallyFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode,list,true);
  list=TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupWindowCloseFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode,list,true);
  list=TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupTimerFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode,list,true);
  list=TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.dataFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode,list,false);
  menuPopup.appendChild(flgmntNode);
};
TabGroupsManager.Session.prototype.makeRestoresSessionMenu=function(flgmntNode,list,reverseSort){
  if(list.length<=0){
    return;
  }
  let menuitem=document.createElement("menuseparator");
  flgmntNode.appendChild(menuitem);
  list.sort(reverseSort?TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafNameReverse:TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafName);
  for(var i=0;i<list.length;i++){
    let one=list[i];
    let menuitem=document.createElement("menuitem");
    let label=one.leafName;
    label=label.replace(TabGroupsManagerJsm.saveData.backupSwapFileRegexp,TabGroupsManager.strings.getString("ReplaceSessionBackupSwap"));
    label=label.replace(TabGroupsManagerJsm.saveData.backupManuallyFileRegexp,TabGroupsManager.strings.getString("ReplaceSessionSave"));
    label=label.replace(TabGroupsManagerJsm.saveData.backupWindowCloseFileRegexp,TabGroupsManager.strings.getString("ReplaceSessionBackupWindowCloseLabel"));
    label=label.replace(TabGroupsManagerJsm.saveData.backupTimerFileRegexp,TabGroupsManager.strings.getString("ReplaceSessionBackupByTimerLabel"));
    if(label.match(TabGroupsManagerJsm.saveData.dataFileRegexp)){
      label=label.replace(TabGroupsManagerJsm.saveData.dataFileNowRegexp,TabGroupsManager.strings.getString("ReplaceSessionSaveDataNow"));
      label=label.replace(TabGroupsManagerJsm.saveData.dataFileMirrorRegexp,TabGroupsManager.strings.getString("ReplaceSessionSaveDataMirror"));
      label=label.replace(TabGroupsManagerJsm.saveData.dataFileRegexp,TabGroupsManager.strings.getString("ReplaceSessionSaveData"));
    }else{
      menuitem.setAttribute("context","TabGroupsManagerSessionContextMenu");
    }
    menuitem.setAttribute("value",one.leafName);
    menuitem.setAttribute("label",label);
    menuitem.setAttribute("tooltiptext",TabGroupsManager.strings.getString("SessionBackupTooltip"));
    //menuitem.setAttribute("oncommand","TabGroupsManager.session.restoreSessionCommand(event);");
    menuitem.addEventListener("command", function(event)
    {
      TabGroupsManager.session.restoreSessionCommand(event);
    }, false);

    flgmntNode.appendChild(menuitem);
  }
};
TabGroupsManager.Session.prototype.onHiddenBackupSessionMenu=function(event){
  var menuPopup=event.originalTarget;
  menuitem=menuPopup.childNodes[2];
  while(menuitem){
    menuPopup.removeChild(menuitem);
    menuitem=menuPopup.childNodes[2];
  }
};
TabGroupsManager.Session.prototype.restoreSessionCommand=function(event){
  TabGroupsManagerJsm.saveData.restoreSession(event.originalTarget.getAttribute("value"));
};
TabGroupsManager.Session.prototype.restoreSessionInit=function(){
  TabGroupsManager.allGroups.openNewGroup(null,-1,null,null);
  var groupTab=TabGroupsManager.allGroups.childNodes;
  for(var i=groupTab.length-2;i>=0;i--){
    groupTab[i].group.closeAllTabsAndGroup();
  }
  this.groupRestored=0;
  this.sessionRestoreManually=true;
};
TabGroupsManager.Session.prototype.restoreSessionFromAboutSessionRestore=function(){
  TabGroupsManager.allGroups.selectedGroup.id=-1;
  this.groupRestored=0;
  this.sessionRestoreManually=true;
};
TabGroupsManager.Session.prototype.menuitemDelete=function(event){
  TabGroupsManagerJsm.saveData.deleteSession(document.popupNode.getAttribute("value"));
};
TabGroupsManager.Session.prototype.setClosedTabJson=function(jsonData){
  window.removeEventListener("SSWindowStateBusy",this,false);
  window.removeEventListener("SSWindowStateReady",this,false);
  try
  {
    let stateJson=JSON.stringify({windows:[{tabs:[],_closedTabs:JSON.parse(jsonData)}],_firstTabs:true});
    this.sessionStore.setWindowState(window,stateJson,false);
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    window.addEventListener("SSWindowStateBusy",this,false);
    window.addEventListener("SSWindowStateReady",this,false);
  }
};
TabGroupsManager.Session.prototype.getTabStateEx=function(tab){
  //when do we get no textbox in about:config? -> override this for E10s
  if (!tab.linkedBrowser.ownerDocument.defaultView.gMultiProcessBrowser){
	if(tab.linkedBrowser&&tab.linkedBrowser.currentURI.spec=="about:config"&&!tab.linkedBrowser.contentDocument.getElementById("textbox")){
		this.tmpOverrideGetElementByIdForAboutConfig(tab);
		try
		{
		  return this.sessionStore.getTabState(tab);
		}
		finally
		{
		  delete tab.linkedBrowser.contentDocument.getElementById;
		}
	}
  }
  return this.sessionStore.getTabState(tab);
};
TabGroupsManager.Session.prototype.duplicateTabEx=function(aWindow,tab){
  //when do we get no textbox in about:config? -> override this for E10s
  if (!tab.linkedBrowser.ownerDocument.defaultView.gMultiProcessBrowser){
	if(tab.linkedBrowser&&tab.linkedBrowser.currentURI.spec=="about:config"&&!tab.linkedBrowser.contentDocument.getElementById("textbox")){
		this.tmpOverrideGetElementByIdForAboutConfig(tab);
		try
		{
		  return this.sessionStore.duplicateTab(aWindow,tab);
		}
		finally
		{
		  delete tab.linkedBrowser.contentDocument.getElementById;
		}
	}
  }
  return this.sessionStore.duplicateTab(aWindow,tab);
};
TabGroupsManager.Session.prototype.tmpOverrideGetElementByIdForAboutConfig=function(tab){
  //http://zpao.com/posts/session-restore-changes-in-firefox-15/ > '#' removed > fx 15
  //Bug 947212 - Broadcast form data and move it out of tabData.entries[] > fx 29
  //let state = JSON.parse(this.sessionStore.getTabState(tab));
  //let textbox = state.formdata.id["textbox"];

  //no reason to fix this, there is always a textbox element for about:config - not sure when this will be called
  let ssData=tab.linkedBrowser.__SS_data;
  let textbox=ssData.entries[ssData.index-1].formdata["#textbox"];
  tab.linkedBrowser.contentDocument.getElementById=function(){return{value:textbox}};
};
TabGroupsManager.openMenu={};
TabGroupsManager.openMenu.onShowing=function(event){
  this.onHidden(event);
  var flgmntNode=this.makeOpenGroupWithRegisteredNameFragment();
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget,"start",flgmntNode);
  var flgmntNode=this.makeOpenGroupWithHistoryFragment();
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget,"startHistory",flgmntNode);
};
TabGroupsManager.openMenu.onShowingRename=function(event){
  this.onHidden(event);
  var flgmntNode=this.makeOpenGroupWithRegisteredNameFragment(true);
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget,"start",flgmntNode);
  var flgmntNode=this.makeOpenGroupWithHistoryFragment(true);
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget,"startHistory",flgmntNode);
};
TabGroupsManager.openMenu.makeOpenGroupWithRegisteredNameFragment=function(rename){
  var flgmntNode=document.createDocumentFragment();
  var list=TabGroupsManagerJsm.globalPreferences.groupNameRegistered;
  var i;
  for(i=0;i<list.length;i++){
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("label",list[i]);
    menuitem.setAttribute("class","menuitem-iconic");
    menuitem.setAttribute("context","TabGroupsManagerRegisteredGroupNameMenuitemContextMenu");
    menuitem.groupNameTypeIsRegistered=true;
    menuitem.groupNameIndex=i;
    if(rename){
      menuitem.addEventListener("command",this.renameGroupByMenuitem,false);
    }else{
      menuitem.setAttribute("tooltiptext",TabGroupsManager.strings.getString("OpenMenuitemOpenNamedGroupHelp"));
      menuitem.addEventListener("command",this.openNamedGroupByMenuitem,false);
      menuitem.addEventListener("click",this.openNamedGroupByMenuitemClick,false);
    }
    flgmntNode.appendChild(menuitem);
  }
  if(i>0){
    var menuitem=document.createElement("menuseparator");
    menuitem.style.marginLeft="20px";
    flgmntNode.appendChild(menuitem);
  }
  return flgmntNode;
};
TabGroupsManager.openMenu.makeOpenGroupWithHistoryFragment=function(rename){
  var flgmntNode=document.createDocumentFragment();
  var list=TabGroupsManagerJsm.globalPreferences.groupNameHistory;
  var i;
  for(i=0;i<list.length;i++){
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("label",list[i]);
    menuitem.setAttribute("class","menuitem-iconic");
    menuitem.setAttribute("context","TabGroupsManagerHistoryGroupNameMenuitemContextMenu");
    menuitem.groupNameTypeIsRegistered=false;
    menuitem.groupNameIndex=i;
    if(rename){
      menuitem.addEventListener("command",this.renameGroupByMenuitem,false);
    }else{
      menuitem.setAttribute("tooltiptext",TabGroupsManager.strings.getString("OpenMenuitemOpenNamedGroupHelp"));
      menuitem.addEventListener("command",this.openNamedGroupByMenuitem,false);
      menuitem.addEventListener("click",this.openNamedGroupByMenuitemClick,false);
    }
    flgmntNode.appendChild(menuitem);
  }
  if(i>0){
    var menuitem=document.createElement("menuseparator");
    menuitem.style.marginLeft="20px";
    flgmntNode.appendChild(menuitem);
  }
  return flgmntNode;
};
TabGroupsManager.openMenu.onHidden=function(event){
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.originalTarget,"start","end");
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.originalTarget,"startHistory","endHistory");
};
TabGroupsManager.openMenu.openNamedGroupByMenuitem=function(event){
  var name=event.target.getAttribute("label");
  var group=TabGroupsManager.allGroups.openNewGroup(null,null,name,null);
  group.disableAutoRename=true;
  if(event.ctrlKey){
    TabGroupsManager.allGroups.selectedGroup=group;
  }
  event.stopPropagation();
};
TabGroupsManager.openMenu.openNamedGroupByMenuitemClick=function(event){
  if(event.button==1){
    TabGroupsManager.openMenu.openNamedGroupByMenuitem(event);
    event.stopPropagation();
  }
};
TabGroupsManager.openMenu.renameGroupByMenuitem=function(event){
  var group=TabGroupsManager.groupMenu.popupGroup;
  if(group){
    group.name=event.target.getAttribute("label");
    group.disableAutoRename=true;
  }
  event.stopPropagation();
};
TabGroupsManager.openMenu.menuitemDelete=function(event){
  var menuitem=document.popupNode;
  if(menuitem.groupNameIndex!=undefined){
    if(menuitem.groupNameTypeIsRegistered){
      TabGroupsManagerJsm.globalPreferences.deleteGroupNameRegistered(menuitem.groupNameIndex);
    }else{
      TabGroupsManagerJsm.globalPreferences.deleteGroupNameHistory(menuitem.groupNameIndex);
    }
  }
  event.stopPropagation();
};
TabGroupsManager.openMenu.toRegisteredGroupName=function(event){
  var menuitem=document.popupNode;
  var name=TabGroupsManagerJsm.globalPreferences.groupNameHistory[menuitem.groupNameIndex];
  TabGroupsManagerJsm.globalPreferences.deleteGroupNameHistory(menuitem.groupNameIndex);
  TabGroupsManagerJsm.globalPreferences.addGroupNameRegistered(name);
  event.stopPropagation();
};
TabGroupsManager.openMenu.registerGroupName=function(event){
  var name=window.prompt(TabGroupsManager.strings.getString("RenameDialogMessage"),"");
  if(name){
    TabGroupsManagerJsm.globalPreferences.addGroupNameRegistered(name);
  }
  event.stopPropagation();
};
TabGroupsManager.openMenu.clearGroupNameHistory=function(event){
  TabGroupsManagerJsm.globalPreferences.clearGroupNameHistory();
  event.stopPropagation();
};
TabGroupsManager.ToolMenu=function(){
  document.getElementById("menu_ToolsPopup").addEventListener("popupshowing",this,false);
};
TabGroupsManager.ToolMenu.prototype.handleEvent=function(event){
  switch(event.type){
    case"popupshowing":
      document.getElementById("TabGroupsMnagerDispGroupBarInToolBarMenu").hidden=TabGroupsManager.groupBarDispHide.dispGroupBar;
    break;
  }
};
TabGroupsManager.EventListener=function(){
  this.groupSelecting=false;
  this.tabOpenTarget=null;
};
TabGroupsManager.EventListener.prototype.createEventListener=function(){
  var groupTabs=document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.addEventListener("mousedown",this,true);
  groupTabs.addEventListener("click",this,false);
  groupTabs.addEventListener("dblclick",this,false);
  groupTabs.addEventListener("select",this,false);
  if(!("TMP_TabGroupsManager" in window)){
    gBrowser.tabContainer.addEventListener("TabOpen",this,false);
    gBrowser.tabContainer.addEventListener("TabClose",this,false);
  }
  gBrowser.tabContainer.addEventListener("TabSelect",this,false);
  gBrowser.tabContainer.addEventListener("TabMove",this,false);
  gBrowser.tabContainer.addEventListener("TabShow",this,false);
  gBrowser.tabContainer.addEventListener("TabHide",this,false);
  var contextMenu=document.getElementById("contentAreaContextMenu");
  if(contextMenu){
    contextMenu.addEventListener("popupshowing",this,false);
  }
};
TabGroupsManager.EventListener.prototype.destroyEventListener=function(){
  var groupTabs=document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.removeEventListener("mousedown",this,true);
  groupTabs.removeEventListener("click",this,false);
  groupTabs.removeEventListener("dblclick",this,false);
  groupTabs.removeEventListener("select",this,false);
  if(!("TMP_TabGroupsManager" in window)){
    gBrowser.tabContainer.removeEventListener("TabOpen",this,false);
    gBrowser.tabContainer.removeEventListener("TabClose",this,false);
  }
  gBrowser.tabContainer.removeEventListener("TabSelect",this,false);
  gBrowser.tabContainer.removeEventListener("TabMove",this,false);
  var contextMenu=document.getElementById("contentAreaContextMenu");
  if(contextMenu){
    contextMenu.removeEventListener("popupshowing",this,false);
  }
};
TabGroupsManager.EventListener.prototype.handleEvent=function(event){
  switch(event.type){
    case"mousedown":event.stopPropagation();break;
    case"click":this.onGroupClick(event);break;
    case"dblclick":this.onGroupDblClick(event);break;
    case"select":this.onGroupSelect(event);break;
    case"TabOpen":this.onTabOpen(event);break;
    case"TabClose":this.onTabClose(event);break;
    case"TabSelect":this.onTabSelect(event);break;
    case"TabMove":this.onTabMove(event);break;
    case"TabShow":this.onTabShow(event);break;
    case"TabHide":this.onTabHide(event);break;
    case"popupshowing":this.contentAreaContextMenuShowHideItems(event);break;
  }
};
TabGroupsManager.EventListener.prototype.onTabOpen=function(event){
  try
  {
    if(!TabGroupsManager.session.sessionRestoring ||!TabGroupsManagerJsm.globalPreferences.lastSessionFinalized){
      var newTab=event.originalTarget;
      if(TabGroupsManager.preferences.tabTreeOpenTabByExternalApplication&&TabGroupsManager.tabOpenStatus.openerContext==Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL){
        var group=TabGroupsManager.allGroups.getGroupById(-2);
        if(!group){
          group=TabGroupsManager.allGroups.openNewGroup(newTab,-2,TabGroupsManager.strings.getString("ExtAppGroupName"));
          TabGroupsManager.allGroups.changeGroupOrder(group,0);
        }else{
          group.addTab(newTab);
        }
      }else if(TabGroupsManager.tabOpenStatus.openerTab){
        var parentTab=TabGroupsManager.tabOpenStatus.openerTab;
        if(TabGroupsManager.preferences.tabTreeOpenTabByJavaScript){
          parentTab.group.addTab(newTab);
        }else{
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
        if(!parentTab.tabGroupsManagerTabTree){
          parentTab.tabGroupsManagerTabTree=new TabGroupsManager.TabTree(parentTab);
        }
        parentTab.tabGroupsManagerTabTree.addTabToTree(newTab);
      }else{
        if(this.tabOpenTarget){
          this.tabOpenTarget.addTab(newTab);
        }else{
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
      }
      TabGroupsManager.groupBarDispHide.dispGroupBarByTabCount();
      newTab.tgmSelectedTime=(new Date()).getTime();
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.tabOpenStatus.clearOpenerData();
    this.tabOpenTarget=null;
  }
};
TabGroupsManager.EventListener.prototype.onTabClose=function(event){
  var closeTab=event.originalTarget;
  if(closeTab.tabGroupsManagerTabTree){
    closeTab.tabGroupsManagerTabTree.removeTabFromTree(true);
  }
  if(closeTab.group!=null){
    closeTab.group.removeTab(closeTab,true);
  }
  TabGroupsManager.groupBarDispHide.hideGroupBarByTabCountDelay();
};
TabGroupsManager.EventListener.prototype.onTabSelect=function(event){
  var tab=gBrowser.selectedTab;
  if(tab.group==null){
    TabGroupsManager.allGroups.selectedGroup.addTab(tab);
  }
  if(!tab.group.selected){
    tab.group.selectedTab=tab;
    TabGroupsManager.allGroups.selectedGroup=tab.group;
  }else{
    tab.group.selectedTab=tab;
  }
  tab.tgmSelectedTime=(new Date()).getTime();
};
TabGroupsManager.EventListener.prototype.onTabShow=function(event){
  var tab=event.target;
  if(!tab.group.selected){
	TabGroupsManager.utils.hideTab(tab);
  }
};

TabGroupsManager.EventListener.prototype.onTabHide=function(event){
  var tab=event.target;
  let count = 0;
  
  function checkTabGroup() {
	count++;
	var activeGroupPromise = new Promise( 
		function(resolve, reject) {       
			setTimeout(function() {
				if(typeof tab.group == "undefined" && count < 10) {
					checkTabGroup();
				} else resolve(tab);
			}, 50);
		});

	activeGroupPromise.then(function(tab) {
		if(tab.group.selected){
			TabGroupsManager.utils.unHideTab(tab);
		}
	}, Components.utils.reportError);
  }

  //check if tab.group is not defined at startup since Fx25+
  if(TabGroupsManager.preferences.firefoxVersionCompare("28") == 1 && typeof tab.group == "undefined") { 		
	checkTabGroup();
  } else {
		if(tab.group.selected){
			TabGroupsManager.utils.unHideTab(tab);
		}
	}
};

TabGroupsManager.EventListener.prototype.onTabMove=function(event){
  var tab=event.originalTarget;
  if(!TabGroupsManager.eventListener.groupSelecting){
    if(tab.tabGroupsManagerTabTree){
      tab.tabGroupsManagerTabTree.removeTabFromTree(false);
    }
    if(tab.group){
      tab.group.sortTabArrayByTPos();
    }
  }
};
TabGroupsManager.EventListener.prototype.onGroupSelect=function(event){
  if(TabGroupsManager.session.allTabsMovingToGroup){
    return;
  }
  TabGroupsManager.eventListener.groupSelecting=true;
  try
  {
    var selectedGroup=TabGroupsManager.allGroups.selectedGroup;
    selectedGroup.suspended=false;
    if(selectedGroup.tabArray.length==0){
      let tab=selectedGroup.makeDummyTab();
      selectedGroup.addTab(tab);
      selectedGroup.selectedTab=tab;
    }
    if(!selectedGroup.selectedTab){
      selectedGroup.selectedTab=selectedGroup.tabArray[0];
    }
    for(var tab=gBrowser.mTabContainer.firstChild;tab;tab=tab.nextSibling){
      if(tab.group&&!tab.group.selected){
		TabGroupsManager.utils.hideTab(tab);
      }else{
		TabGroupsManager.utils.unHideTab(tab);
      }
    }
    TabGroupsManager.allGroups.scrollInActiveGroup(true);
    if(!("TreeStyleTabService" in window)){
      if("TabmixTabbar" in window){
        if(TabGroupsManager.preferences.firefoxVersionCompare("3.7")>0){
          if(TabmixTabbar.isMultiRow){
            TabmixTabbar.updateScrollStatus();
          }else{
            gBrowser.tabContainer.collapsedTabs=0;
          }
        }else{
          gBrowser.mTabContainer.collapsedTabs=0;
          TabmixTabbar.updateScrollStatus();
          gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
          TabmixTabbar.updateBeforeAndAfter();
        }
      }else if("tabBarScrollStatus" in window){
        gBrowser.mTabContainer.collapsedTabs=0;
        tabBarScrollStatus();
        gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
        checkBeforeAndAfter();
      }
    }
    gBrowser.selectedTab=selectedGroup.selectedTab;
    selectedGroup.unread=false;
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.eventListener.groupSelecting=false;
  }
};
TabGroupsManager.EventListener.prototype.onGroupClick=function(event){
  var group=event.target.group;
  if(group){
    if(event.button==0){
      if(group.suspended){
        group.suspended=false;
      }else{
        group.setSelected();
      }
    }else if(event.button==1){
      group.mouseCommand(TabGroupsManager.preferences.groupMClick);
    }
  }
  event.stopPropagation();
};
TabGroupsManager.EventListener.prototype.onGroupDblClick=function(event){
  if(event.button==0){
    event.target.group.mouseCommand(TabGroupsManager.preferences.groupDblClick);
  }else if(event.button==2){
    if(TabGroupsManager.preferences.groupDblRClick!=0){
      document.getElementById("TabGroupsManagerGroupContextMenu").hidePopup();
    }
    event.target.group.mouseCommand(TabGroupsManager.preferences.groupDblRClick);
  }
  event.stopPropagation();
};
TabGroupsManager.EventListener.prototype.onGroupBarClick=function(event){
  switch(event.button){
    case 0:TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarLClick);break;
    case 1:TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarMClick);break;
  }
};
TabGroupsManager.EventListener.prototype.onGroupBarDblClick=function(event){
  switch(event.button){
    case 0:TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarDblClick);break;
  }
};
TabGroupsManager.EventListener.prototype.onButtonOpenCommand=function(event){TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenLClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonOpenClick=function(event){if(event.button==1)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenMClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonOpenDblClick=function(event){if(event.button==0)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenDblClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonSleepCommand=function(event){TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepLClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonSleepClick=function(event){if(event.button==1)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepMClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonSleepDblClick=function(event){if(event.button==0)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepDblClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonCloseCommand=function(event){TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseLClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonCloseClick=function(event){if(event.button==1)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseMClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonCloseDblClick=function(event){if(event.button==0)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseDblClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onButtonDispMClick=function(event){if(event.button==1)TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonDispMClick);event.stopPropagation();};
TabGroupsManager.EventListener.prototype.onShowingSleepingGroupsMenu=function(event){
  TabGroupsManager.sleepingGroups.createMenu(event.currentTarget);
};
TabGroupsManager.EventListener.prototype.onHiddenSleepingGroupsMenu=function(event){
  TabGroupsManager.sleepingGroups.destroyMenu(event.currentTarget);
};
TabGroupsManager.EventListener.prototype.onShowingClosedGroupsMenu=function(event){
  TabGroupsManager.closedGroups.createMenu(event.currentTarget);
};
TabGroupsManager.EventListener.prototype.onHiddenClosedGroupsMenu=function(event){
  TabGroupsManager.closedGroups.destroyMenu(event.currentTarget);
};
TabGroupsManager.EventListener.prototype.contentAreaContextMenuShowHideItems=function(){
  document.getElementById("TabGroupsManagerLinkOpenInNewGroup").hidden=!gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInSelectedGroup").hidden=!gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInNewGroupSeparator").hidden=!gContextMenu.onLink;
};
TabGroupsManager.EventListener.prototype.linkOpenInNewGroup=function(){
  var newTab=TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  TabGroupsManager.allGroups.openNewGroup(newTab);
};
TabGroupsManager.EventListener.prototype.linkOpenInSelectedGroup=function(){
  var newTab=TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  var group=TabGroupsManager.allGroups.openNewGroup(newTab);
  TabGroupsManager.allGroups.selectedGroup=group;
};
TabGroupsManager.TabContextMenu=function(){
};
TabGroupsManager.TabContextMenu.prototype.makeMenu=function(){
  var flgmntNode=document.createDocumentFragment();
  flgmntNode.appendChild(document.createElement("menuseparator"));
  var sendToMenu=document.createElement("menu");
  sendToMenu.setAttribute("id","TabGroupsManagerTabContextMenuSendToOtherGroup");
  sendToMenu.setAttribute("label",TabGroupsManager.strings.getString("SendToOtherGroup"));
  var sendToMenuPopup=document.createElement("menupopup");
  sendToMenuPopup.addEventListener("popupshowing",this.sendToMenuPopup,false);
  sendToMenuPopup.addEventListener("popuphidden",this.sendToMenuHidden,false);
  sendToMenu.appendChild(sendToMenuPopup);
  flgmntNode.appendChild(sendToMenu);
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseOtherTab","CloseOtherTab",this.closeOtherTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseLeftTab","CloseLeftTab",this.closeLeftTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuSelectLeftTab","SelectLeftTab",this.selectLeftTabInGroupWithHTM));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseRightTab","CloseRightTab",this.closeRightTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuSelectRightTab","SelectRightTab",this.selectRightTabInGroupWithHTM));
  let menu=gBrowser.tabContextMenu;
  if(!menu){
    menu=document.getAnonymousElementByAttribute(gBrowser,"anonid","tabContextMenu");
  }
  menu.appendChild(flgmntNode);
  menu.addEventListener("popupshowing",this.contextMenuPopup,false);
};
TabGroupsManager.TabContextMenu.prototype.deleteMenu=function(){
  let menu=gBrowser.tabContextMenu;
  if(!menu){
    menu=document.getAnonymousElementByAttribute(gBrowser,"anonid","tabContextMenu");
  }
  //fix deleting null items on exit (exception seen while debugging and reloading with F5).
  var menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseOtherTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject)) { menu.removeChild(menuObject); }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseLeftTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject)) { menu.removeChild(menuObject); }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuSelectLeftTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject)) { menu.removeChild(menuObject); }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseRightTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject)) { menu.removeChild(menuObject); }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuSelectRightTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject)) { menu.removeChild(menuObject); }

  menu.removeEventListener("popupshowing",this.contextMenuPopup,false);
};
TabGroupsManager.TabContextMenu.prototype.makeOneMenuitem=function(id,name,command){
  var menuitem=document.createElement("menuitem");
  menuitem.setAttribute("id","TabGroupsManager"+id+"Menuid");
  menuitem.setAttribute("label",TabGroupsManager.strings.getString(name+"MenuItemLabel"));
  menuitem.setAttribute("accesskey",TabGroupsManager.strings.getString(name+"MenuItemAccesskey"));
  menuitem.addEventListener("command",command,false);
  return menuitem;
};
TabGroupsManager.TabContextMenu.prototype.contextMenuPopup=function(){
  var tabContextMenuSendToOtherGroup=document.getElementById("TabGroupsManagerTabContextMenuSendToOtherGroup");
  var tabContextMenuCloseOtherTab=document.getElementById("TabGroupsManagerTabContextMenuCloseOtherTabMenuid");
  var tabContextMenuCloseLeftTab=document.getElementById("TabGroupsManagerTabContextMenuCloseLeftTabMenuid");
  var tabContextMenuCloseRightTab=document.getElementById("TabGroupsManagerTabContextMenuCloseRightTabMenuid");
  var tabContextMenuSelectLeftTab=document.getElementById("TabGroupsManagerTabContextMenuSelectLeftTabMenuid");
  var tabContextMenuSelectRightTab=document.getElementById("TabGroupsManagerTabContextMenuSelectRightTabMenuid");
  if(!document.popupNode.group){
    tabContextMenuSendToOtherGroup.hidden=true;
    tabContextMenuCloseOtherTab.hidden=true;
    tabContextMenuCloseLeftTab.hidden=true;
    tabContextMenuCloseRightTab.hidden=true;
    tabContextMenuSelectLeftTab.hidden=true;
    tabContextMenuSelectRightTab.hidden=true;
    return;
  }
  tabContextMenuSendToOtherGroup.hidden=!TabGroupsManager.preferences.tabMenuSendToOtherGroup;
  tabContextMenuCloseOtherTab.hidden=!TabGroupsManager.preferences.tabMenuCloseOtherTabInGroup;
  tabContextMenuCloseLeftTab.hidden=!TabGroupsManager.preferences.tabMenuCloseLeftTabInGroup;
  tabContextMenuCloseRightTab.hidden=!TabGroupsManager.preferences.tabMenuCloseRightTabInGroup;
  tabContextMenuSelectLeftTab.hidden=!("MultipleTabService" in window)||!TabGroupsManager.preferences.tabMenuSelectLeftTabInGroup;
  tabContextMenuSelectRightTab.hidden=!("MultipleTabService" in window)||!TabGroupsManager.preferences.tabMenuSelectRightTabInGroup;
  var targetTab=document.popupNode;
  var disabledLeft=!TabGroupsManager.tabContextMenu.existsLeftTabInGroup(targetTab);
  var disabledRight=!TabGroupsManager.tabContextMenu.existsRightTabInGroup(targetTab);
  var disabledOhter=disabledLeft&&disabledRight;
  tabContextMenuCloseOtherTab.setAttribute("disabled",disabledOhter);
  tabContextMenuCloseLeftTab.setAttribute("disabled",disabledLeft);
  tabContextMenuCloseRightTab.setAttribute("disabled",disabledRight);
};
TabGroupsManager.TabContextMenu.prototype.sendToMenuPopup=function(event){
  TabGroupsManager.tabContextMenu.sendToMenuHidden(event);
  var flgmntNode=document.createDocumentFragment();
  var menuitem=document.createElement("menuitem");
  menuitem.setAttribute("label",TabGroupsManager.strings.getString("SendToNewGroup"));
  menuitem.setAttribute("class","menuitem-iconic");
  menuitem.addEventListener("command",TabGroupsManager.tabContextMenu.sendTabToNewGroup,false);
  flgmntNode.appendChild(menuitem);
  flgmntNode.appendChild(document.createElement("menuseparator"));
  for(var i=0;i<TabGroupsManager.allGroups.childNodes.length;i++){
    var nowGroup=TabGroupsManager.allGroups.childNodes[i].group;
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("value",nowGroup.id);
    menuitem.setAttribute("label",nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"));
    menuitem.setAttribute("image",nowGroup.image);
    menuitem.setAttribute("class","menuitem-iconic");
    menuitem.setAttribute("validate","never");
    if(nowGroup.id==document.popupNode.group.id){
      menuitem.setAttribute("disabled","true");
    }
    menuitem.addEventListener("command",TabGroupsManager.tabContextMenu.sendTabToGroup,false);
    flgmntNode.appendChild(menuitem);
  }
  flgmntNode.appendChild(document.createElement("menuseparator"));
  for(var i=0;i<TabGroupsManager.sleepingGroups.store.length;i++){
    var nowGroup=TabGroupsManager.sleepingGroups.store[i];
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("value",nowGroup.id);
    menuitem.setAttribute("label",nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"));
    menuitem.setAttribute("image",nowGroup.image);
    menuitem.setAttribute("class","menuitem-iconic");
    menuitem.setAttribute("validate","never");
    menuitem.addEventListener("command",TabGroupsManager.tabContextMenu.sendTabToSleepingGroup,false);
    flgmntNode.appendChild(menuitem);
  }
  var sendToMenuPopup=event.target;
  sendToMenuPopup.appendChild(flgmntNode);
};
TabGroupsManager.TabContextMenu.prototype.sendToMenuHidden=function(event){
  var sendToMenuPopup=event.target;
  TabGroupsManager.utils.deleteFromAnonidToAnonid(sendToMenuPopup);
};
TabGroupsManager.TabContextMenu.prototype.sendTabToNewGroup=function(event){
  var tab=document.popupNode;
  TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab,null,event.ctrlKey);
};
TabGroupsManager.TabContextMenu.prototype.sendTabToGroup=function(event){
  var tab=document.popupNode;
  var groupId=event.target.getAttribute("value")-0;
  var group=TabGroupsManager.allGroups.getGroupById(groupId);
  TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab,group,event.ctrlKey);
};
TabGroupsManager.TabContextMenu.prototype.sendTabToSleepingGroup=function(event){
  var tab=document.popupNode;
  var groupId=event.target.getAttribute("value")-0;
  TabGroupsManager.sleepingGroups.sendTabToGroupsStore(tab,groupId);
};
TabGroupsManager.TabContextMenu.prototype.closeLeftTabInGroup=function(){
  var targetTab=document.popupNode;
  var targetGroup=targetTab.group;
  for(var tab=targetTab.previousSibling;tab;){
    var nextTab=tab.previousSibling;
    if(tab.group==targetGroup){
      if(gBrowser.selectedTab==tab){
        gBrowser.selectedTab=document.popupNode;
      }
      gBrowser.removeTab(tab);
    }
    tab=nextTab;
  }
};
TabGroupsManager.TabContextMenu.prototype.closeRightTabInGroup=function(){
  var targetTab=document.popupNode;
  var targetGroup=targetTab.group;
  for(var tab=targetTab.nextSibling;tab;){
    var nextTab=tab.nextSibling;
    if(tab.group==targetGroup){
      if(gBrowser.selectedTab==tab){
        gBrowser.selectedTab=document.popupNode;
      }
      gBrowser.removeTab(tab);
    }
    tab=nextTab;
  }
};
TabGroupsManager.TabContextMenu.prototype.selectLeftTabInGroupWithHTM=function(){
  var targetTab=document.popupNode;
  var targetGroup=targetTab.group;
  for(var tab=targetTab;tab;){
    var nextTab=tab.previousSibling;
    if(tab.group==targetGroup){
      if(gBrowser.selectedTab==tab){
        gBrowser.selectedTab=document.popupNode;
      }
      MultipleTabService.toggleSelection(tab);
    }
    tab=nextTab;
  }
};
TabGroupsManager.TabContextMenu.prototype.selectRightTabInGroupWithHTM=function(){
  var targetTab=document.popupNode;
  var targetGroup=targetTab.group;
  for(var tab=targetTab;tab;){
    var nextTab=tab.nextSibling;
    if(tab.group==targetGroup){
      if(gBrowser.selectedTab==tab){
        gBrowser.selectedTab=document.popupNode;
      }
      MultipleTabService.toggleSelection(tab);
    }
    tab=nextTab;
  }
};
TabGroupsManager.TabContextMenu.prototype.closeOtherTabInGroup=function(){
  TabGroupsManager.tabContextMenu.closeRightTabInGroup();
  TabGroupsManager.tabContextMenu.closeLeftTabInGroup();
};
TabGroupsManager.TabContextMenu.prototype.existsLeftTabInGroup=function(targetTab){
  var targetGroup=targetTab.group;
  for(var tab=targetTab.previousSibling;tab;tab=tab.previousSibling){
    if(tab.group==targetGroup){
      return true;
    }
  }
  return false;
};
TabGroupsManager.TabContextMenu.prototype.existsRightTabInGroup=function(targetTab){
  var targetGroup=targetTab.group;
  for(var tab=targetTab.nextSibling;tab;tab=tab.nextSibling){
    if(tab.group==targetGroup){
      return true;
    }
  }
  return false;
};
TabGroupsManager.SupportDnD=function(){
  try
  {
    this.dropAllow=document.getElementById("TabGroupsManagerGroupBarDropAllow");
    this.dropPlus=document.getElementById("TabGroupsManagerGroupBarDropPlus");
    this.dropPlusNewGroup=document.getElementById("TabGroupsManagerGroupBarDropPlusNewGroup");
    this.dropZZZ=document.getElementById("TabGroupsManagerGroupBarDropZZZ");
    this.dropSuspend=document.getElementById("TabGroupsManagerDropSuspend");
    this.icons=new Array();
    this.icons.push(this.dropAllow);
    this.icons.push(this.dropPlus);
    this.icons.push(this.dropPlusNewGroup);
    this.icons.push(this.dropZZZ);
    this.icons.push(this.dropSuspend);
    this.displayIconTimer=null;
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.SupportDnD.prototype.getDragElementByParent=function(element,parent){
  while(element){
    var nextElement=element.parentNode;
    if(nextElement==parent){
      return element;
    }
    element=nextElement;
  }
  return null;
};
TabGroupsManager.SupportDnD.prototype.getDragElementByTagName=function(element,tagName){
  var xulTagName="xul:"+tagName;
  while(element){
    if(element.tagName==tagName || element.tagName==xulTagName){
      return element;
    }
    element=element.parentNode;
  }
  return null;
};
TabGroupsManager.SupportDnD.prototype.setAllowPositionX=function(positionX){
  this.dropAllow.style.left=positionX+"px";
  this.selectDisplayIconTimer(this.dropAllow);
};
TabGroupsManager.SupportDnD.prototype.setPlusPositionX=function(positionX){
  this.dropPlus.style.left=positionX+"px";
  this.selectDisplayIconTimer(this.dropPlus);
};
TabGroupsManager.SupportDnD.prototype.setPlusOPositionX=function(positionX,ctrlKey){
  this.dropPlusNewGroup.style.left=positionX+"px";
  if(ctrlKey!=undefined){
    this.dropAllow.style.left=(positionX+16)+"px";
    this.dropPlus.style.left=(positionX+16)+"px";
    this.selectDisplayIconTimer(this.dropPlusNewGroup,ctrlKey?this.dropPlus:this.dropAllow);
  }else{
    this.selectDisplayIconTimer(this.dropPlusNewGroup);
  }
};
TabGroupsManager.SupportDnD.prototype.setZZZPosition=function(positionX,positionY){
  this.dropZZZ.style.left=positionX+"px";
  this.dropZZZ.style.top=positionY+"px";
  this.selectDisplayIconTimer(this.dropZZZ);
};
TabGroupsManager.SupportDnD.prototype.setZZZPositionX=function(positionX){
  this.dropZZZ.style.left=positionX+"px";
  this.selectDisplayIconTimer(this.dropZZZ);
};
TabGroupsManager.SupportDnD.prototype.setSuspendPositionX=function(positionX){
  this.dropSuspend.style.left=positionX+"px";
  this.selectDisplayIconTimer(this.dropSuspend);
};
TabGroupsManager.SupportDnD.prototype.stopDisplayTimer=function(){
  if (('undefined' !== typeof this.displayIconTimer) && (this.displayIconTimer)) {
    clearTimeout(this.displayIconTimer);
  }
  this.displayIconTimer=null;
};
TabGroupsManager.SupportDnD.prototype.selectDisplayIcon=function(displayIconList){
  this.stopDisplayTimer();
  for(let i=0;i<this.icons.length;i++){
    this.icons[i].hidden=(-1==displayIconList.indexOf(this.icons[i]));
  }
};
TabGroupsManager.SupportDnD.prototype.selectDisplayIconTimer=function(){
  this.stopDisplayTimer();
  let displayIconList=new Array();
  for(let i=0;i<arguments.length;i++){
    displayIconList.push(arguments[i]);
  }
  this.displayIconTimer=setTimeout(function(_this){_this.selectDisplayIcon(displayIconList);},0,this);
};
TabGroupsManager.SupportDnD.prototype.hideAllNow=function(){
  this.hideAllNowCore();
  this.hideAll();
};
TabGroupsManager.SupportDnD.prototype.hideAllNowCore=function(){
  this.stopDisplayTimer();
  if (('undefined' !== typeof this.icons) && (this.icons) ) {
    for (let i = 0; i < this.icons.length; i++) {
      this.icons[i].hidden = true;
    }
  }
};
TabGroupsManager.SupportDnD.prototype.hideAll=function(){
  this.stopDisplayTimer();
  this.displayIconTimer=setTimeout(function(_this){_this.hideAllNowCore();},0,this);
};
TabGroupsManager.GroupDnDObserver=function(aSupportDnD){
  try
  {
    this.supportDnD=aSupportDnD;
    this.createEventListener();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupDnDObserver.prototype.createEventListener=function(){
  var _this=this;
  var groupBar=document.getElementById("TabGroupsManagerGroupbar");
  groupBar.addEventListener("dragstart",this,false);
  groupBar.addEventListener("dragenter",this,false);
  groupBar.addEventListener("dragover",this,false);
  groupBar.addEventListener("dragleave",this,false);
  groupBar.addEventListener("drop",this,false);
  groupBar.addEventListener("dragend",this,false);
};
TabGroupsManager.GroupDnDObserver.prototype.destroyEventListener=function(){
  var _this=this;
  var groupBar=document.getElementById("TabGroupsManagerGroupbar");
  groupBar.removeEventListener("dragstart",this,false);
  groupBar.removeEventListener("dragenter",this,false);
  groupBar.removeEventListener("dragover",this,false);
  groupBar.removeEventListener("dragleave",this,false);
  groupBar.removeEventListener("drop",this,false);
  groupBar.removeEventListener("dragend",this,false);
};
TabGroupsManager.GroupDnDObserver.prototype.handleEvent=function(event){
  switch(event.type){
    case"dragstart":this.onDragStart(event);break;
    case"dragenter":
    case"dragover":this.onDragOver(event);break;
    case"dragleave":this.onDragLeave(event);break;
    case"drop":this.onDrop(event);break;
    case"dragend":this.onDragEnd(event);break;
  }
};
TabGroupsManager.GroupDnDObserver.prototype.onDragStart=function(event){
  event.dataTransfer.setDragImage(event.target,event.target.clientWidth/ 2,-20);
  event.dataTransfer.setData("application/x-tabgroupsmanager-grouptab","GroupTab");
  this.dragStartX=event.screenX;
  this.dragStartY=event.screenY;
};
TabGroupsManager.GroupDnDObserver.prototype.onDragOver=function(event,draggedTab){
  this.supportDnD.hideAll();
  if(event.target.parentNode!=TabGroupsManager.allGroups.groupbar){
    return;
  }
  var session=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab")){
    var groupTab=this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(groupTab){
      if(event.ctrlKey){
        this.supportDnD.setPlusPositionX(TabGroupsManager.allGroups.dropPositionX(null,event.target,event.clientX));
      }else if(groupTab!=event.target){
        this.supportDnD.setAllowPositionX(TabGroupsManager.allGroups.dropPositionX(groupTab,event.target,event.clientX));
      }else{
        this.supportDnD.hideAll();
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed="all";
    }
  }else if((TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-tabbrowser-tab")) || (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-text-internal")))  {
    var tab=draggedTab || this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(tab){
      if(event.ctrlKey){
        this.supportDnD.setPlusPositionX((event.target.getBoundingClientRect().left+event.target.getBoundingClientRect().right)/ 2);
      }else if(tab.group!=event.target.group){
        this.supportDnD.setAllowPositionX((event.target.getBoundingClientRect().left+event.target.getBoundingClientRect().right)/ 2);
      }else{
        this.supportDnD.hideAll();
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed="all";
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url")){
    this.supportDnD.setPlusPositionX((event.target.getBoundingClientRect().left+event.target.getBoundingClientRect().right)/ 2);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed="all";
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain")){
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed="all";
  }
};
TabGroupsManager.GroupDnDObserver.prototype.onDragLeave=function(event){
  this.supportDnD.hideAll();
  event.stopPropagation();
};
TabGroupsManager.GroupDnDObserver.prototype.onDragEnd=function(event){
  if(event.dataTransfer.dropEffect=="none"){
    var groupTab=event.target;
    if(groupTab){
      if(!window.gSingleWindowMode){
        var isCopy=event.ctrlKey || TabGroupsManager.keyboardState.ctrlKey;
        groupTab.group.busy=groupTab.group.busy ||!isCopy;
        window.openDialog("chrome://browser/content/browser.xul","_blank","chrome,all,dialog=no","about:blank","TabGroupsManagerNewWindowWithGroup",groupTab,isCopy);
      }
    }
  }
};
TabGroupsManager.GroupDnDObserver.prototype.onDrop=function(event,draggedTab){
  this.supportDnD.hideAllNow();
  var session=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab")){
    var groupTab=this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(groupTab){
      if(groupTab.parentNode==TabGroupsManager.allGroups.groupbar){
        TabGroupsManager.allGroups.moveGroupToSameWindow(groupTab,event,event.ctrlKey);
      }else{
        TabGroupsManager.allGroups.moveGroupToOtherWindow(groupTab,event,event.ctrlKey);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }else if ((TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-tabbrowser-tab")) || (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-text-internal")))  {
    var tab=draggedTab || this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(tab){
      if(tab.parentNode==gBrowser.tabContainer){
	setTimeout(function() { TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab,event.target.group,event.ctrlKey); }, 100);
      }else{
        setTimeout(function() { TabGroupsManager.allGroups.moveTabToGroupInOtherWindow(tab,event.target.group,event.ctrlKey); }, 100);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url")){
    var data=event.dataTransfer.getData("text/x-moz-url");
    var splitData=data.split(/\r?\n/);
    var tab=TabGroupsManager.overrideMethod.gBrowserAddTab(splitData[0]);
    event.target.group.addTab(tab);
    event.preventDefault();
    event.stopPropagation();
    return;
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain")){
    let text=event.dataTransfer.getData("text/plain");
    let group=event.target.group;
    let splitText=text?text.split(/\r?\n/)[0]:"";
    if(splitText.match(/s?https?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/)){
      let tab=TabGroupsManager.overrideMethod.gBrowserAddTab(RegExp.lastMatch);
      group.addTab(tab);
    }else{
      group.renameByText(text);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
};
TabGroupsManager.GroupBarDnDObserver=function(aSupportDnD){
  try
  {
    this.groupOrderChangeMargin=30;
    this.supportDnD=aSupportDnD;
    this.scrollbox=document.getElementById("TabGroupsManagerGroupBarScrollbox");
    this.createEventListener();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupBarDnDObserver.prototype.createEventListener=function(){
  TabGroupsManager.xulElements.groupBar.addEventListener("dragenter",this,false);
  TabGroupsManager.xulElements.groupBar.addEventListener("dragover",this,false);
  TabGroupsManager.xulElements.groupBar.addEventListener("dragleave",this,false);
  TabGroupsManager.xulElements.groupBar.addEventListener("drop",this,false);
};
TabGroupsManager.GroupBarDnDObserver.prototype.destroyEventListener=function(){
  TabGroupsManager.xulElements.groupBar.removeEventListener("dragenter",this,false);
  TabGroupsManager.xulElements.groupBar.removeEventListener("dragover",this,false);
  TabGroupsManager.xulElements.groupBar.removeEventListener("dragleave",this,false);
  TabGroupsManager.xulElements.groupBar.removeEventListener("drop",this,false);
};
TabGroupsManager.GroupBarDnDObserver.prototype.handleEvent=function(event){
  switch(event.type){
    case"dragenter":
    case"dragover":this.onDragOver(event);break;
    case"dragleave":this.onDragLeave(event);break;
    case"drop":this.onDrop(event);break;
  }
};
TabGroupsManager.GroupBarDnDObserver.prototype.checkPointInRect=function(point,rect){
  return(rect[0]<=point[0]&&point[0]<rect[2]&&rect[1]<=point[1]&&point[1]<rect[3]);
};
TabGroupsManager.GroupBarDnDObserver.prototype.onDragOver=function(event,draggedTab){
  this.supportDnD.hideAll();
  if(event.originalTarget==document.getElementById("TabGroupsManagerGroupBarDropPlus")){
    return;
  }
  TabGroupsManager.groupBarDispHide.dispGroupBar=true;
  var session=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if(event.originalTarget.className=="autorepeatbutton-up"){
    this.scrollbox.scrollByPixels(-20);
  }else if(event.originalTarget.className=="autorepeatbutton-down"){
    this.scrollbox.scrollByPixels(+20);
  }
  if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab")){
    var groupTab=this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(groupTab){
      var firstGroupTab=TabGroupsManager.allGroups.firstChild;
      var lastGroupTab=TabGroupsManager.allGroups.lastChild;
      var firstRect=firstGroupTab.getBoundingClientRect();
      var lastRect=lastGroupTab.getBoundingClientRect();
      var firstLeftRect=[firstRect.left-this.groupOrderChangeMargin,firstRect.top,firstRect.left,firstRect.bottom];
      var lastRightRect=[lastRect.right,lastRect.top,lastRect.right+this.groupOrderChangeMargin,lastRect.bottom];
      var dropPoint=[event.clientX,event.clientY];
      if(groupTab.parentNode==TabGroupsManager.allGroups.groupbar&&
       (
          !event.ctrlKey&&
          !(this.checkPointInRect(dropPoint,firstLeftRect)&&groupTab!=firstGroupTab)&&
          !(this.checkPointInRect(dropPoint,lastRightRect)&&groupTab!=lastGroupTab)
        )
      ){
        let rect=groupTab.getBoundingClientRect();
        if(event.shiftKey){
          this.supportDnD.setSuspendPositionX((rect.left+rect.right)/ 2);
        }else{
          this.supportDnD.setZZZPositionX((rect.left+rect.right)/ 2);
        }
      }else{
        xPos=(event.clientX<firstRect.left)?firstRect.left:lastRect.right;
        if(event.ctrlKey){
          this.supportDnD.setPlusPositionX(xPos);
        }else{
          this.supportDnD.setAllowPositionX(xPos);
        }
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed="all";
    }
  }else if ((TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-tabbrowser-tab")) || (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-text-internal")))  {
    var tab=draggedTab || this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(tab){
      if(tab.group!=event.target.group){
        this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right,event.ctrlKey);
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed="all";
      }
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url")){
    this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed="all";
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain")){
    this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed="all";
  }
};
TabGroupsManager.GroupBarDnDObserver.prototype.onDragLeave=function(event){
  this.supportDnD.hideAll();
};
TabGroupsManager.GroupBarDnDObserver.prototype.onDrop=function(event,draggedTab){
  this.supportDnD.hideAllNow();
  var session=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab")){
    var groupTab=this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(groupTab){
      var firstGroupTab=TabGroupsManager.allGroups.firstChild;
      var lastGroupTab=TabGroupsManager.allGroups.lastChild;
      var firstRect=firstGroupTab.getBoundingClientRect();
      var lastRect=lastGroupTab.getBoundingClientRect();
      var firstLeftRect=[firstRect.left-this.groupOrderChangeMargin,firstRect.top,firstRect.left,firstRect.bottom];
      var lastRightRect=[lastRect.right,lastRect.top,lastRect.right+this.groupOrderChangeMargin,lastRect.bottom];
      var dropPoint=[event.clientX,event.clientY];
      if(groupTab.parentNode==TabGroupsManager.allGroups.groupbar){
        if(event.ctrlKey){
          let insertPos=(event.clientX<firstRect.left)?0:null;
          TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group,insertPos,event.ctrlKey);
        }else if(this.checkPointInRect(dropPoint,firstLeftRect)&&groupTab!=firstGroupTab){
          TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group,0,event.ctrlKey);
        }else if(this.checkPointInRect(dropPoint,lastRightRect)&&groupTab!=lastGroupTab){
          TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group,null,event.ctrlKey);
        }else{
          if(event.shiftKey){
            groupTab.group.suspended=!groupTab.group.suspended;
          }else{
            groupTab.group.sleepGroup();
          }
        }
      }else{
        if(event.clientX<firstRect.left){
          TabGroupsManager.allGroups.moveGroupToOtherWindow(groupTab,0,event.ctrlKey);
        }else{
          TabGroupsManager.allGroups.moveGroupToOtherWindow(groupTab,null,event.ctrlKey);
        }
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }else if ((TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-tabbrowser-tab")) || (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-text-internal")))  {
    var tab=draggedTab || this.supportDnD.getDragElementByTagName(session.sourceNode,"tab");
    if(tab){
      if(tab.parentNode==gBrowser.tabContainer){
	setTimeout(function() { TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab,null,event.ctrlKey); }, 100);
      }else{
        setTimeout(function() { TabGroupsManager.allGroups.moveTabToGroupInOtherWindow(tab,null,event.ctrlKey); }, 100);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-place")){
    var node=session.sourceNode.node;
    if(node){
      if(PlacesUtils.nodeIsBookmark(node)){
        TabGroupsManager.places.openInNewGroup(node);
        event.preventDefault();
        event.stopPropagation();
        return;
      }else if(PlacesUtils.nodeIsFolder(node)){
        TabGroupsManager.places.allOpenInNewGroup(node);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url")){
    var data=event.dataTransfer.getData("text/x-moz-url");
    var splitData=data.split(/\r?\n/);
    var url=splitData[0];
    var tab=TabGroupsManager.overrideMethod.gBrowserAddTab(url);
    var group=TabGroupsManager.allGroups.openNewGroup(tab);
    if(splitData.length>1&&splitData[1]!=""){
      group.autoRename(splitData[1]);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain")){
    let text=event.dataTransfer.getData("text/plain");
    let splitText=text?text.split(/\r?\n/)[0]:"";
    if(splitText.match(/s?https?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/)){
      TabGroupsManager.allGroups.openNewGroup(TabGroupsManager.overrideMethod.gBrowserAddTab(RegExp.lastMatch));
    }else{
      let group=TabGroupsManager.allGroups.openNewGroup(null);
      group.renameByText(text);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
};
TabGroupsManager.WindowDnDObserver=function(aSupportDnD){
  try
  {
    this.supportDnD=aSupportDnD;
    this.groupDataExtRegExp=new RegExp("\\."+TabGroupsManagerJsm.constValues.groupDataExt+"$","i");
    this.sessionDataExtRegExp=new RegExp("\\."+TabGroupsManagerJsm.constValues.sessionDataExt+"2?$","i");
    this.createEventListener();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.WindowDnDObserver.prototype.createEventListener=function(){
  window.addEventListener("dragenter",this,true);
  window.addEventListener("dragover",this,true);
  window.addEventListener("dragleave",this,true);
  window.addEventListener("drop",this,true);
};
TabGroupsManager.WindowDnDObserver.prototype.destroyEventListener=function(){
  window.removeEventListener("dragenter",this,true);
  window.removeEventListener("dragover",this,true);
  window.removeEventListener("dragleave",this,true);
  window.removeEventListener("drop",this,true);
};
TabGroupsManager.WindowDnDObserver.prototype.handleEvent=function(event){
  switch(event.type){
    case"dragenter":
    case"dragover":this.onDragOverDelegate(event);break;
    case"dragleave":this.onDragLeave(event);break;
    case"drop":this.onDrop(event);break;
  }
};
TabGroupsManager.WindowDnDObserver.prototype.onDragOverDelegate=function(event){
  if(!this.reentryFlag){
    try
    {
      this.reentryFlag=true;
      this.onDragOver(event);
    }
    finally
    {
      this.reentryFlag=false;
    }
  }else{
    window.removeEventListener("dragenter",this,true);
    window.removeEventListener("dragover",this,true);
  }
};
TabGroupsManager.WindowDnDObserver.prototype.onDragOver=function(event){
  this.supportDnD.hideAll();
  var session=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab")){
    var groupTab=this.supportDnD.getDragElementByParent(session.sourceNode,TabGroupsManager.allGroups.groupbar);
    if(groupTab){
      let parentChild=event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupBar);
      if(parentChild==0 || parentChild==10){
        return;
      }
      let rect=groupTab.getBoundingClientRect();
      if(event.screenY<TabGroupsManager.groupDnDObserver.dragStartY){
        this.supportDnD.setZZZPositionX((rect.left+rect.right)/ 2);
      }else{
        this.supportDnD.setSuspendPositionX((rect.left+rect.right)/ 2);
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed="all";
      return;
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-file")){
    var file=event.dataTransfer.mozGetDataAt("application/x-moz-file",0);
    if((file instanceof Ci.nsIFile)){
      if(file.leafName.match(this.groupDataExtRegExp)){
        this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right);
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed="all";
      }else if(file.leafName.match(this.sessionDataExtRegExp)){
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed="all";
      }
    }
  }
};
TabGroupsManager.WindowDnDObserver.prototype.onDragLeave=function(event){
  this.supportDnD.hideAll();
};
TabGroupsManager.WindowDnDObserver.prototype.onDrop=function(event){
  this.supportDnD.hideAllNow();
  var session=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab")){
    var groupTab=this.supportDnD.getDragElementByParent(session.sourceNode,TabGroupsManager.allGroups.groupbar);
    if(groupTab){
      let parentChild=event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupBar);
      if(parentChild==0 || parentChild==10){
        return;
      }
      if(event.screenY<TabGroupsManager.groupDnDObserver.dragStartY){
        groupTab.group.sleepGroup();
      }else{
        groupTab.group.suspended=!groupTab.group.suspended;
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }else if(TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-file")){
    let nsIFile=event.dataTransfer.mozGetDataAt("application/x-moz-file",0);
    if(nsIFile instanceof Ci.nsIFile){
      let result=false;
      let ext=(nsIFile.leafName.match(/\.([^.]+)$/))?RegExp.$1:"";
      switch(ext){
        case TabGroupsManagerJsm.constValues.groupDataExt:result=this.importGroup(nsIFile,event.dataTransfer.files);break;
        case TabGroupsManagerJsm.constValues.sessionDataExt:result=this.importSession(nsIFile,true);break;
        case TabGroupsManagerJsm.constValues.sessionDataExt2:result=this.importSession(nsIFile,false);break;
      }
      if(result){
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }
};
TabGroupsManager.WindowDnDObserver.prototype.importGroup=function(file,files){
  if(files){
    let result=false;
    for(let i=0;i<files.length;i++){
      if(files[i].name.match(this.groupDataExtRegExp)){
        result |=this.importGroupFromJson((new TabGroupsManagerJsm.NsIFileWrapper(files[i])).readFileAsText());
      }
    }
    return result;
  }else{
    let groupDataJson=(new TabGroupsManagerJsm.NsIFileWrapper(file)).readFileAsText();
    return this.importGroupFromJson(groupDataJson);
  }
  return false;
};
TabGroupsManager.WindowDnDObserver.prototype.importGroupFromJson=function(groupDataJson){
  try
  {
    let groupData=JSON.parse(groupDataJson);
    if(groupData&&groupData.type==TabGroupsManagerJsm.constValues.groupDataType){
      TabGroupsManagerJsm.applicationStatus.modifyGroupId(groupData);
      var group=TabGroupsManager.allGroups.openNewGroupCore(groupData.id,groupData.name,groupData.image);
      group.setGroupDataWithAllTabs(groupData);
      return true;
    }
  }
  catch(e){
  }
  return false;
};
TabGroupsManager.WindowDnDObserver.prototype.importSession=function(file,old){
  try
  {
    let sessionData=null;
    if(old){
      let sessionDataJson=(new TabGroupsManagerJsm.NsIFileWrapper(file)).readFileAsText();
      sessionData=JSON.parse(sessionDataJson);
    }else{
      sessionData=TabGroupsManagerJsm.saveData.loadTgmDataFromFile(file,true);
    }
    if(sessionData&&confirm(TabGroupsManager.strings.getString("ConfirmImportSession"))){
      TabGroupsManagerJsm.saveData.restoreSessionFromData(sessionData);
      return true;
    }
  }
  catch(e){
  }
  return false;
};
TabGroupsManager.GroupMenu=function(){
  this.popupGroupTab=null;
  this.popupGroup=null;
};
TabGroupsManager.GroupMenu.prototype.showingGroupMenu=function(event){
  document.getElementById("TabGroupsManagerGroupContextMenuReload").disabled=this.popupGroup.suspended;
  var suspendMenuitem=document.getElementById("TabGroupsManagerGroupContextMenuSuspend");
  if(this.popupGroup.suspended){
    suspendMenuitem.setAttribute("checked","true");
  }else{
    suspendMenuitem.removeAttribute("checked");
    suspendMenuitem.disabled=(2>TabGroupsManager.allGroups.countNonSuspendedGroups());
  }
};
TabGroupsManager.GroupMenu.prototype.showingRenameSubmenu=function(event){
  TabGroupsManager.openMenu.onShowingRename(event);
  TabGroupsManager.localGroupIcons.createMenu(event);
  document.getElementById("TabGroupsManagerDisableAutoRenameMenu").setAttribute("checked",this.popupGroup.disableAutoRename);
};
TabGroupsManager.GroupMenu.prototype.hiddenRenameSubmenu=function(event){
  TabGroupsManager.openMenu.onHidden(event);
  TabGroupsManager.localGroupIcons.removeMenu(event);
};
TabGroupsManager.LocalGroupIcons=function(){
};
TabGroupsManager.LocalGroupIcons.prototype.removeMenu=function(event){
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.target,"start_icon","end_icon");
};
TabGroupsManager.LocalGroupIcons.prototype.createMenu=function(event){
  this.removeMenu(event);
  let flgmntNode=document.createDocumentFragment();
  let iconFolders=TabGroupsManagerJsm.globalPreferences.jsonPrefToObject("localIconFilders");
  for(let i=0;i<iconFolders.length;i++){
    let iconFolderName=iconFolders[i];
    let iconFolder=TabGroupsManagerJsm.folderLocation.makeNsIFileWrapperFromURL(iconFolderName);
    this.makeIconListOneLine(flgmntNode,iconFolder,iconFolderName);
  }
  let popup=event.target;
  for(var i=0;i<popup.childNodes.length;i++){
    if(popup.childNodes[i].getAttribute("anonid")=="start_icon"){
      popup.childNodes[i].hidden=(flgmntNode.childNodes.length<=0);
    }
  }
  if(flgmntNode.childNodes.length>0){
    TabGroupsManager.utils.insertElementAfterAnonid(popup,"start_icon",flgmntNode);
  }
};
TabGroupsManager.LocalGroupIcons.prototype.makeIconListOneLine=function(parent,folder,folderName){
  if(folder.exists){
    let files=folder.getArrayOfFileRegex(".*\.(:?png|gif|jpg|jpeg|ico)$");
    if(files.length>0){
      let hbox=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","hbox");
      hbox.setAttribute("style","margin-left:20px;");
      parent.appendChild(hbox);
      for(let i=0;i<files.length;i++){
        let menuitem=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","menuitem");
        menuitem.setAttribute("label","");
        menuitem.setAttribute("image",folderName+files[i].leafName);
        menuitem.setAttribute("class","tabgroupsmanager-menuitem-icon-only");
        menuitem.setAttribute("validate","never");
        menuitem.setAttribute("tooltiptext",files[i].leafName);
        //menuitem.setAttribute("oncommand","TabGroupsManager.groupMenu.popupGroup.changeIconFromLocal( event );");
        menuitem.addEventListener("command", function(event)
        {
          TabGroupsManager.groupMenu.popupGroup.changeIconFromLocal(event);
        }, false);

        hbox.appendChild(menuitem);
      }
    }
    let folders=folder.getArrayOfFolderRegex("^[^.]");
    for(var i=0;i<folders.length;i++){
      this.makeIconListOneLine(parent,folders[i],folderName+folders[i].leafName+"/");
    }
  }
};
TabGroupsManager.progressListenerForGroup=function(aOwnerGroup){
  try
  {
    this.ownerGroup=aOwnerGroup;
    this.startAndStop=Ci.nsIWebProgressListener.STATE_START | Ci.nsIWebProgressListener.STATE_STOP;
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.progressListenerForGroup.prototype.QueryInterface=function(aIID){
  if(aIID.equals(Ci.nsIWebProgressListener)||
     aIID.equals(Ci.nsISupportsWeakReference)||
     aIID.equals(Ci.nsISupports)){
    return this;
  }
  throw Components.results.NS_NOINTERFACE;
};
TabGroupsManager.progressListenerForGroup.prototype.onStateChange=function(aWebProgress,aRequest,aFlag,aStatus){
  if(aFlag&this.startAndStop){
    var ownerGroup=this.ownerGroup;
    setTimeout(function(){ownerGroup.displayGroupBusy();},0);
    if(aFlag&Ci.nsIWebProgressListener.STATE_STOP){
      if(aWebProgress.document&&aWebProgress.document.location=="about:sessionrestore"){
        var button=aWebProgress.document.getElementById("errorTryAgain");
        //button.setAttribute("oncommand","getBrowserWindow().TabGroupsManager.session.restoreSessionFromAboutSessionRestore(); "+button.getAttribute("oncommand"));
        button.addEventListener("command", function(event)
        {
          getBrowserWindow().TabGroupsManager.session.restoreSessionFromAboutSessionRestore(); +button.getAttribute("oncommand");
        }, false);
      }
    }
  }
  return 0;
};
TabGroupsManager.progressListenerForGroup.prototype.onLocationChange=function(aProgress,aRequest,aURI){return 0;};
TabGroupsManager.progressListenerForGroup.prototype.onProgressChange=function(){return 0;};
TabGroupsManager.progressListenerForGroup.prototype.onStatusChange=function(){return 0;};
TabGroupsManager.progressListenerForGroup.prototype.onSecurityChange=function(){return 0;};
TabGroupsManager.progressListenerForGroup.prototype.onLinkIconAvailable=function(){return 0;};
TabGroupsManager.GroupClass=function(id,name,image){
  try
  {
    this._id=id || TabGroupsManagerJsm.applicationStatus.makeNewId();
    this._name=name ||"";
    this._image=image ||"";
    this._suspended=false;
    this._selectedTab=null;
    this.suspendedTabIndex=-1;
    this._busy=false;
    this._busyTabCount=0;
    this._unread=false;
    this.suspendTitleList="";
    this.tabArray=new Array();
    this.suspendArray=undefined;
    this._disableAutoRename=false;
    this.autoRenameBak=null;
    this.autoRenameIndex=-1;
    this.autoRenameDisableTimer=null;
    this.__defineGetter__("selected",function(){return this.groupTab.selected;});
    this.__defineGetter__("selectedTab",function(){return this._selectedTab;});
    this.__defineSetter__("selectedTab",this.setSelectedTab);
    this.__defineGetter__("id",function(){return this._id;});
    this.__defineSetter__("id",this.setID);
    this.__defineGetter__("name",function(){return this._name;});
    this.__defineSetter__("name",this.setName);
    this.__defineGetter__("image",function(){return this._image;});
    this.__defineSetter__("image",this.setImage);
    this.__defineGetter__("disableAutoRename",function(){return this._disableAutoRename;});
    this.__defineSetter__("disableAutoRename",this.setDisableAutoRename);
    this.__defineGetter__("firstTab",this.getFirstTabInGroup);
    this.__defineGetter__("lastTab",this.getLastTabInGroup);
    this.__defineGetter__("last2Tab",this.getLast2TabInGroup);
    this.__defineGetter__("suspended",function(){return this._suspended;});
    this.__defineSetter__("suspended",this.setSuspended);
    this.__defineGetter__("displayTabCount",function(){return this.suspended?this.suspendArray.length:this.tabArray.length;});
    this.__defineGetter__("busy",function(){return this._busy;});
    this.__defineSetter__("busy",this.setBusy);
    this.__defineGetter__("unread",function(){return this._unread;});
    this.__defineSetter__("unread",this.setUnread);
    this.__defineGetter__("busyTabCount",function(){return this._busyTabCount;});
    this.__defineSetter__("busyTabCount",this.setBusyTabCount);
    this.progressListener=new TabGroupsManager.progressListenerForGroup(this);
    this.groupTab=this.makeGroupTab();
    this.relateGroupTab(this.groupTab);
    TabGroupsManager.allGroups.saveAllGroupsData();
    TabGroupsManager.groupBarDispHide.dispGroupBarByGroupCount();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupClass.prototype.setSelectedTab=function(tab){
  this._selectedTab=tab;
  if(gBrowser.selectedTab!=tab&&this.selected){
    gBrowser.selectedTab=tab;
  }
};
TabGroupsManager.GroupClass.prototype.setID=function(value){
  if(this._id!=value){
    this._id=value;
    this.groupTab.id="_group"+this.id;
  }
};
TabGroupsManager.GroupClass.prototype.setName=function(name){
  this.reassignGroupIdFromMinus2();
  this._name=name;
  this.dispGroupLabel();
  TabGroupsManager.session.setGroupNameAllTabsInGroup(this);
  TabGroupsManager.allGroups.saveAllGroupsData();
};
TabGroupsManager.GroupClass.prototype.setImage=function(image){
  this._image=image;
  this.groupTab.setAttribute("image",this.image);
  TabGroupsManager.allGroups.saveAllGroupsData();
};
TabGroupsManager.GroupClass.prototype.setDisableAutoRename=function(value){
  this._disableAutoRename=value;
  TabGroupsManager.allGroups.saveAllGroupsData();
};
TabGroupsManager.GroupClass.prototype.setBusyTabCount=function(value){
  if(this._busyTabCount!=value){
    if(!this.selected&&this._busyTabCount>value){
      this.unread=true;
    }
    this._busyTabCount=value;
    if(TabGroupsManager.preferences.dispGroupTabCountReading){
      this.groupTab.tabCount=(this.busyTabCount>0)?(this.busyTabCount+"/"+this.tabArray.length):this.tabArray.length;
    }else{
      this.groupTab.tabCount=this.tabArray.length;
    }
  }
};
TabGroupsManager.GroupClass.prototype.setBusy=function(value){
  if(this._busy!=value){
    this._busy=value;
    this.setRemoveGroupTabAttribute("busy",value);
  }
};
TabGroupsManager.GroupClass.prototype.setUnread=function(value){
  if(this._unread!=value){
    this._unread=value;
    this.setRemoveGroupTabAttribute("unread",value);
  }
};
TabGroupsManager.GroupClass.prototype.setSuspended=function(value){
  return value?this.suspendGroup():this.unsuspendGroup();
};
TabGroupsManager.GroupClass.prototype.setRemoveGroupTabAttribute=function(key,value){
  if(value){
    this.groupTab.setAttribute(key,"true");
  }else{
    this.groupTab.removeAttribute(key);
  }
};
TabGroupsManager.GroupClass.prototype.makeGroupTab=function(){
  var groupTab=TabGroupsManager.allGroups.groupbar.appendItem();
  groupTab.className="tabgroupsmanager-grouptab";
  groupTab.minWidth=TabGroupsManager.preferences.groupTabMinWidth;
  groupTab._minWidthWithReduce=TabGroupsManager.preferences.groupTabMinWidth;
  groupTab.maxWidth=TabGroupsManager.preferences.groupTabMaxWidth;
  const GroupTabCropString=["none","start","end","center"];
  groupTab.setAttribute("crop",GroupTabCropString[TabGroupsManager.preferences.groupTabCrop]);
  if(!TabGroupsManager.preferences.dispGroupTabIcon){
    setTimeout(function(){groupTab.hideIcon=true;},0);
  }
  return groupTab;
};
TabGroupsManager.GroupClass.prototype.relateGroupTab=function(groupTab){
  this.groupTab=groupTab;
  groupTab.group=this;
  groupTab.id="_group"+this.id;
  this.dispGroupLabel();
  this.groupTab.setAttribute("image",this.image);
  this.setRemoveGroupTabAttribute("busy",this._busy);
  this.setRemoveGroupTabAttribute("unread",this._unread);
  this.setRemoveGroupTabAttribute("suspended",this._suspended);
  if(this.groupTab.reduce!=undefined){
    this.groupTab.reduce=TabGroupsManager.preferences.reduceSuspendGroup&&this.suspended;
  }
};
TabGroupsManager.GroupClass.prototype.setSelected=function(){
  if(!this.selected){
    TabGroupsManager.allGroups.selectedGroup=this;
  }
};
TabGroupsManager.GroupClass.prototype.sortTabArrayByTPos=function(){
  this.tabArray.sort(this.sortTabArrayByTPosFunction);
};
TabGroupsManager.GroupClass.prototype.sortTabArrayByTPosFunction=function(a,b){
  try
  {
    return(a._tPos-b._tPos);
  }
  catch(e){
  }
  return 0;
};
TabGroupsManager.GroupClass.prototype.displayGroupBusy=function(){
  var busyTabCount=0;
  for(var i=0;i<this.tabArray.length;i++){
    if(this.tabArray[i].hasAttribute("busy")){
      busyTabCount++;
    }
  }
  this.busyTabCount=busyTabCount;
  this.busy=(busyTabCount>0);
};
TabGroupsManager.GroupClass.prototype.dispGroupLabel=function(){
  this.groupTab.setAttribute("label",this.name || TabGroupsManager.strings.getString("NewGroupName"));
  if(this.groupTab.tabCount!=null&&this.groupTab.hideTabCount!=null){
    if(TabGroupsManager.preferences.dispGroupTabCountReading){
      this.groupTab.tabCount=(this.busyTabCount>0)?(this.busyTabCount+"/"+this.displayTabCount):this.displayTabCount;
    }else{
      this.groupTab.tabCount=this.displayTabCount;
    }
    this.groupTab.hideTabCount=!TabGroupsManager.preferences.dispGroupTabCount;
  }else{
    var _this=this;
    setTimeout(function(){_this.dispGroupLabel();},10);
  }
  this.groupTab.tooltipText=this.name+" ("+this.displayTabCount+")"+this.suspendTitleList;
};
TabGroupsManager.GroupClass.prototype.dispHideTabCount=function(value){
  this.groupTab.hideTabCount=!value;
};
TabGroupsManager.GroupClass.prototype.dispHideGroupIcon=function(value){
  this.groupTab.hideIcon=!value;
};
TabGroupsManager.GroupClass.prototype.addTab=function(tab,fromSessionStore){
  try
  {
    if(typeof tab.group != "undefined" && tab.group==this){
      return;
    }
    if(tab.tabGroupsManagerTabTree){
      tab.tabGroupsManagerTabTree.removeTabFromTree(false);
    }
    if(tab.group!=null){
      tab.group.removeTab(tab);
    }
    if(TabGroupsManager.session.groupRestored>=2&&!fromSessionStore){
      TabGroupsManager.session.sessionStore.setTabValue(tab,"TabGroupsManagerGroupId",this.id.toString());
      TabGroupsManager.session.sessionStore.setTabValue(tab,"TabGroupsManagerGroupName",this.name);
      if("TMP_TabGroupsManager" in window){
        TabmixSessionManager.updateTabProp(tab);
      }
    }
    if(this.suspended){
      this.addTabToSuspendArray(tab);
    }else{
      this.addTabToTabArray(tab,fromSessionStore);
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupClass.prototype.addTabToTabArray=function(tab,fromSessionStore){
  try
  {
    let[firstTab,lastTab]=this.getFirstLastTabInGroup();
    tab.group=this;
    this.tabArray.push(tab);
    this.dispGroupLabel();
    if(!TabGroupsManager.session.allTabsMovingToGroup){
      if(TabGroupsManager.session.groupRestored<2){
        tab.tPosBak=tab._tPos;
      }else if(tab.tPosBak!=null){
        TabGroupsManager.tabMoveByTGM.moveTabTo(tab,tab.tPosBak);
        delete tab.tPosBak;
      }else{
        this.moveTabToLast(tab,firstTab,lastTab);
      }
      this.sortTabArrayByTPos();
	  
	  switch(this.selected){
			case false: TabGroupsManager.utils.hideTab(tab);break;
			default: TabGroupsManager.utils.unHideTab(tab);break;
		}
    }
    tab.linkedBrowser.webProgress.addProgressListener(this.progressListener,Ci.nsIWebProgress.NOTIFY_STATE_NETWORK);
    this.displayGroupBusy();
    if(!this.selectedTab){
      this.selectedTab=tab;
      if(this.selected){
        gBrowser.selectedTab=tab;
      }
    }
    if(this.selected&&("TMP_TabGroupsManager" in window)){
      tab.collapsed=false;
      if(fromSessionStore){
        gBrowser.mTabContainer.ensureTabIsVisible(this.selectedTab._tPos);
      }
    }
    if("TreeStyleTabService" in window){
      if(!fromSessionStore){
        if(TreeStyleTabService.hasChildTabs(tab)){
          var _this=this;
          setTimeout(function(){_this.addChildTabOfTST();},0,tab);
        }
      }
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupClass.prototype.addChildTabOfTST=function(parentTab){
  let tabList=TreeStyleTabService.getChildTabs(parentTab);
  for(let i=0;i<tabList.length;i++){
    parentTab.group.addTab(tabList[i]);
  }
};
TabGroupsManager.GroupClass.prototype.addTabToSuspendArray=function(tab){
  tab.group=this;
  this.suspendArray.push(TabGroupsManager.session.getTabStateEx(tab));
  this.suspendTitleList+="\n  "+tab.linkedBrowser.contentTitle;
  this.dispGroupLabel();
  if(this.suspendedTabIndex<0){
    this.suspendedTabIndex=0;
  }
  tab.group=null;
  this.removeTabWithoutClosedTabsList(tab);
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
};
TabGroupsManager.GroupClass.prototype.dndMoveTabToGroup=function(tab){
  this.addTab(tab);
  if(this.displayTabCount==1&&this.name==""){
    this.autoRenameNameIcon(tab);
  }
};
TabGroupsManager.GroupClass.prototype.getNextTabWhenTabRemove=function(targetTab){
  switch(TabGroupsManager.preferences.focusTabWhenActiveTabClosed){
    case 1:return this.getLeftRightTabInGroup(targetTab);
    case 2:return this.getFirstTabInGroup(targetTab);
    case 3:return this.getLastTabInGroup(targetTab);
    case 4:return this.getLatestSelectedTabInGroup(targetTab);
    case-1:
    case 0:
    default:return this.getRightLeftTabInGroup(targetTab);
  }
};
TabGroupsManager.GroupClass.prototype.getNextTabInGroup=function(targetTab){
  if(this.tabArray.length>1){
    for(var tab=targetTab.nextSibling;tab;tab=tab.nextSibling){
      if(tab.group==targetTab.group){
        return tab;
      }
    }
  }
  return null;
};
TabGroupsManager.GroupClass.prototype.getPreviousTabInGroup=function(targetTab){
  if(this.tabArray.length>1){
    for(var tab=targetTab.previousSibling;tab;tab=tab.previousSibling){
      if(tab.group==targetTab.group){
        return tab;
      }
    }
  }
  return null;
};
TabGroupsManager.GroupClass.prototype.getFirstTabInGroup=function(excludeTab){
  this.sortTabArrayByTPos();
  for(var i=0;i<this.tabArray.length;i++){
    if(this.tabArray[i]!=excludeTab){
      return this.tabArray[i];
    }
  }
  return null;
};
TabGroupsManager.GroupClass.prototype.getLastTabInGroup=function(excludeTab){
  this.sortTabArrayByTPos();
  for(var i=this.tabArray.length-1;i>=0;i--){
    if(this.tabArray[i]!=excludeTab){
      return this.tabArray[i];
    }
  }
  return null;
};
TabGroupsManager.GroupClass.prototype.getLatestSelectedTabInGroup=function(targetTab){
  this.sortTabArrayByTPos();
  let targetIndex=this.tabArray.indexOf(targetTab);
  let latestTime=-1;
  let latestIndex=-1;
  for(let i=targetIndex+1;i<this.tabArray.length;i++){
    let time=this.tabArray[i].tgmSelectedTime || 0;
    if(time>latestTime){
      latestTime=time;
      latestIndex=i;
    }
  }
  for(let i=targetIndex-1;i>=0;i--){
    let time=this.tabArray[i].tgmSelectedTime || 0;
    if(time>latestTime){
      latestTime=time;
      latestIndex=i;
    }
  }
  return this.tabArray[latestIndex];
};
TabGroupsManager.GroupClass.prototype.getFirstLastTabInGroup=function(){
  this.sortTabArrayByTPos();
  return[this.tabArray[0],this.tabArray[this.tabArray.length-1]];
};
TabGroupsManager.GroupClass.prototype.getLast2TabInGroup=function(){
  this.sortTabArrayByTPos();
  return(this.tabArray.length>1)?this.tabArray[this.tabArray.length-2]:null;
};
TabGroupsManager.GroupClass.prototype.getRightLeftTabInGroup=function(targetTab){
  var tab=this.getNextTabInGroup(targetTab);
  return tab?tab:this.getPreviousTabInGroup(targetTab);
};
TabGroupsManager.GroupClass.prototype.getLeftRightTabInGroup=function(targetTab){
  var tab=this.getPreviousTabInGroup(targetTab);
  return tab?tab:this.getNextTabInGroup(targetTab);
};
TabGroupsManager.GroupClass.prototype.getRightLoopTabInGroup=function(targetTab){
  var tab=this.getNextTabInGroup(targetTab);
  return tab?tab:this.getFirstTabInGroup(targetTab);
};
TabGroupsManager.GroupClass.prototype.getLeftLoopTabInGroup=function(targetTab){
  var tab=this.getPreviousTabInGroup(targetTab);
  return tab?tab:this.getLastTabInGroup(targetTab);
};
TabGroupsManager.GroupClass.prototype.selectRightLoopTabInGroup=function(){
  var newSelectedTab=this.getRightLoopTabInGroup(this.selectedTab);
  if(newSelectedTab){
    this.selectedTab=newSelectedTab;
  }
};
TabGroupsManager.GroupClass.prototype.selectLeftLoopTabInGroup=function(){
  var newSelectedTab=this.getLeftLoopTabInGroup(this.selectedTab);
  if(newSelectedTab){
    this.selectedTab=newSelectedTab;
  }
};
TabGroupsManager.GroupClass.prototype.selectLastTabInGroup=function(){
  this.sortTabArrayByTPos();
  this.selectedTab=this.tabArray[this.tabArray.length-1];
};
TabGroupsManager.GroupClass.prototype.selectNthTabInGroup=function(n){
  this.sortTabArrayByTPos();
  if(this.tabArray.length>n){
    this.selectedTab=this.tabArray[n];
  }
};
TabGroupsManager.GroupClass.prototype.moveTabToLast=function(tab,firstTab,lastTab){
  if(lastTab==null){
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab,gBrowser.mTabContainer.childNodes.length-1);
  }else if(tab._tPos<firstTab._tPos){
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab,lastTab._tPos);
  }else if(tab._tPos>lastTab._tPos+1){
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab,lastTab._tPos+1);
  }else if(!("TreeStyleTabService" in window)){
    let pos=(tab._tPos<lastTab._tPos)?lastTab._tPos:lastTab._tPos+1;
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab,pos);
  }
};
TabGroupsManager.GroupClass.prototype.makeDummyTab=function(){
  let dummyTab=TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank");
  var _this=this;
  setTimeout(function(){_this.removeDummyTab();},0,dummyTab);
  return dummyTab;
};
TabGroupsManager.GroupClass.prototype.removeDummyTab=function(dummyTab){
  if(dummyTab&&dummyTab.group&&dummyTab.group.tabArray.length>1&&TabGroupsManager.utils.isBlankTab(dummyTab)){
    gBrowser.removeTab(dummyTab);
  }
};
TabGroupsManager.GroupClass.prototype.removeTab=function(tab,fromTabCloseEvent,notClose){
  if(tab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag){
    delete tab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag;
  }else if(!TabGroupsManagerJsm.privateBrowsing.enteringOrExiting&&this.tabArray.length<=1&&TabGroupsManager.preferences.groupNotCloseWhenCloseAllTabsInGroup&&fromTabCloseEvent){
    this.addTab(("TMP_BrowserOpenTab" in window)?TMP_BrowserOpenTab(null,true):TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank"));
  }
  if(this.tabArray.length<=1&&!notClose){
    if(TabGroupsManager.allGroups.childNodes.length==1){
      var group=TabGroupsManager.allGroups.openNewGroup(null,null,null,null,"TMP_BrowserOpenTab");
      TabGroupsManager.allGroups.selectedGroup=group;
    }else if(this.selected){
      TabGroupsManager.allGroups.selectNextGroup();
    }
    this.unlinkTab(tab);
    if(TabGroupsManager.session.allTabsMovingToGroup&&this.id==-1){
      this.selectedTab=null;
    }else{
      this.close();
    }
  }else{ //for startup allow select tab only if group is in status restored to prevent 2 loaded tabs in group
    if(this.selectedTab==tab&&TabGroupsManager.session.groupRestored==2){
      this._selectedTab=this.getNextTabWhenTabRemove(tab);
      if(this.selected&&this._selectedTab&&TabGroupsManager.preferences.focusTabWhenActiveTabClosed!=-1){
        gBrowser.selectedTab=this._selectedTab;
      }
    }
    if(this.selected){
      if("TMP_TabGroupsManager" in window){
        TMP_eventListener.onTabClose_updateTabBar(tab);
      }
    }
    this.unlinkTab(tab);
    this.dispGroupLabel();
    this.displayGroupBusy();
  }
};
TabGroupsManager.GroupClass.prototype.unlinkTab=function(tab,notDeleteFromTabArray){
  if(tab.group!=this){
    return;
  }
  try
  {
    tab.linkedBrowser.removeProgressListener(this.progressListener);
  }
  catch(e){
  }
  if(notDeleteFromTabArray!=true){
    this.tabArray.splice(this.tabArray.indexOf(tab),1);
  }
  tab.group=null;
};
TabGroupsManager.GroupClass.prototype.deleteBlankTab=function(){
  return;
};
TabGroupsManager.GroupClass.prototype.renameDialog=function(){
  let oldName=this.name;
  let oldIcon=this.image;
  let data={"name":oldName,"image":oldIcon};
  window.openDialog("chrome://tabgroupsmanager/content/GroupSettingsDialog.xul","TabGroupsManagerGroupSettingsDialog","chrome,modal,dialog,centerscreen,resizable",data);
  if(data.name!=null){
    this.renameByText(data.name);
  }
  if(data.image!=null){
    this.image=data.image;
  }
};
TabGroupsManager.GroupClass.prototype.changeIconFromLocal=function(event){
  this.image=event.target.image;
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
};
TabGroupsManager.GroupClass.prototype.renameByText=function(text){
  if(text){
    this.name=text;
    TabGroupsManagerJsm.globalPreferences.addGroupNameHistory(text);
    this.disableAutoRename=true;
  }
};
TabGroupsManager.GroupClass.prototype.disableAutoRenameByTimer=function(){
  if(TabGroupsManager.preferences.autoRenameDisableTime>0){
    clearTimeout(this.autoRenameDisableTimer);
    var _this=this;
    this.disableAutoRenameTimer=setTimeout(function(){_this.autoRenameDisableTimer=null;_this.disableAutoRename=true;},TabGroupsManager.preferences.autoRenameDisableTime);
  }
};
TabGroupsManager.GroupClass.prototype.autoRenameNameIcon=function(tab){
  tab=tab || this.selectedTab;
  if(tab){
    TabGroupsManager.allGroups.beginUpdate();
    this.image=tab.image;
    var tabTitle=tab.linkedBrowser.contentTitle;
    if(tabTitle!=""){
      this.autoRename(tabTitle);
    }else{
      TabGroupsManager.allGroups.saveAllGroupsData();
    }
    TabGroupsManager.allGroups.endUpdate();
    this.disableAutoRenameByTimer();
  }
};
TabGroupsManager.GroupClass.prototype.autoRenameNameOnly=function(){
  if(this.selectedTab){
    var tabTitle=this.selectedTab.linkedBrowser.contentTitle;
    if(tabTitle!=""){
      this.autoRename(tabTitle);
      this.disableAutoRenameByTimer();
    }
  }
};
TabGroupsManager.GroupClass.prototype.autoRenameIconOnly=function(){
  if(this.selectedTab){
    this.image=this.selectedTab.image;
    this.disableAutoRenameByTimer();
  }
};
TabGroupsManager.GroupClass.prototype.autoRenameDisable=function(event){
  this.disableAutoRename=event.target.hasAttribute("checked");
};
TabGroupsManager.GroupClass.prototype.autoRename=function(input){
  var splitInput=input.split(TabGroupsManager.titleSplitRegExp);
  for(var i=splitInput.length-1;i>=0;i--){
    if(splitInput[i]==""){
      splitInput.splice(i,1);
    }
  }
  if(splitInput.length==0){
    this.autoRenameBak=null;
    this.autoRenameIndex=-1;
    return;
  }
  if(this.autoRenameBak!=input){
    this.autoRenameBak=input;
    this.autoRenameIndex=-1;
    this.name=input;
  }else{
    this.autoRenameIndex++;
    if(this.autoRenameIndex==splitInput.length){
      this.autoRenameIndex=-1;
      this.name=input;
    }else{
      this.autoRenameIndex=this.autoRenameIndex % splitInput.length;
      this.name=splitInput[this.autoRenameIndex];
    }
  }
};
TabGroupsManager.GroupClass.prototype.closeAllTabsAndGroup=function(){
  if(!this.checkProtectedOfTabMixPlus(TabGroupsManager.strings.getString("ConfirmCloseGroupWhenTabProtected"))){
    return;
  }
  if(TabGroupsManagerJsm.privateBrowsing.enteringOrExiting){
    this.close();
  }else{
    TabGroupsManager.closedGroups.addGroup(this.getGroupDataWithAllTabs(),this);
  }
};
TabGroupsManager.GroupClass.prototype.sleepGroup=function(){
  if(!this.checkProtectedOfTabMixPlus(TabGroupsManager.strings.getString("ConfirmSleepGroupWhenTabProtected"))){
    return;
  }
  TabGroupsManager.sleepingGroups.addGroup(this.getGroupDataWithAllTabs(),this);
};
TabGroupsManager.GroupClass.prototype.suspendToggle=function(event){
  this.suspended=event.target.hasAttribute("checked");
};
TabGroupsManager.GroupClass.prototype.suspendGroup=function(notConfirm){
  try
  {
    if(this.suspended || 1>=TabGroupsManager.allGroups.countNonSuspendedGroups()){
      return true;
    }
    this.reassignGroupIdFromMinus2();
    let confirmResult=notConfirm?false:null;
    if(this.checkProtectedOfTabMixPlus(TabGroupsManager.strings.getString("ConfirmSleepGroupWhenTabProtected"),confirmResult)){
      if(this.selected){
        TabGroupsManager.allGroups.selectNextGroup();
      }
      this.sortTabArrayByTPos();
      this.suspendTitleList="";
      this.suspendArray=new Array();
      for(var i=0;i<this.tabArray.length;i++){
        this.suspendTitleList+="\n  "+this.tabArray[i].linkedBrowser.contentTitle;
        this.suspendArray.push(TabGroupsManager.session.getTabStateEx(this.tabArray[i]));
      }
      this.suspendedTabIndex=this.tabArray.indexOf(this.selectedTab);
      this.selectedTab=null;
      this.removeAllTabsWithoutClosedTabsList();
      this.groupTab.setAttribute("suspended","true");
      if(TabGroupsManager.preferences.reduceSuspendGroup){
        this.groupTab.reduce=true;
      }
      this.busy=false;
      this.unread=false;
      this.busyTabCount=0;
      this._suspended=true;
      this.dispGroupLabel();
      TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
    }
    return true;
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupClass.prototype.unsuspendGroup=function(){
  if(this._suspended){
    this._suspended=false;
    this.groupTab.removeAttribute("suspended");
    this.groupTab.reduce=false;
    this.groupTab.minWidthWithReduce=TabGroupsManager.preferences.groupTabMinWidth;
    this.suspendTitleList="";
    this.restoreTabs(this.suspendArray);
    this.suspendArray.splice(0);
    this.suspendArray=undefined;
    this.selectedTab=this.tabArray[Math.max(0,this.suspendedTabIndex)];
    TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  }
  return false;
};
TabGroupsManager.GroupClass.prototype.openTabInGroup=function(){
  TabGroupsManager.eventListener.tabOpenTarget=this;
  try
  {
    var tab=gBrowser.addTab.apply(gBrowser,arguments);
  }
  finally
  {
    TabGroupsManager.eventListener.tabOpenTarget=null;
  }
  return tab;
};
TabGroupsManager.GroupClass.prototype.duplicateTabsInGroup=function(oldTabArrayOriginal){
  let oldTabArray=oldTabArrayOriginal.slice();
  let newTabArray=new Array(oldTabArray.length);
  TabGroupsManager.session.disableOnSSTabRestoring=true;
  try
  {
    for(var i=0;i<oldTabArray.length;i++){
      newTabArray[i]=TabGroupsManager.session.duplicateTabEx(window,oldTabArray[i]);
    }
  }
  finally
  {
    TabGroupsManager.session.disableOnSSTabRestoring=false;
  }
  return newTabArray;
};
TabGroupsManager.GroupClass.prototype.restoreTabs=function(arrayOfTabs){
  try
  {
    let tabs=new Array(arrayOfTabs.length);
    for(let i=0;i<arrayOfTabs.length;i++){
      tabs[i]=TabGroupsManager.overrideMethod.gBrowserAddTab();
      this.addTab(tabs[i]);
    }
    for(let i=0;i<arrayOfTabs.length;i++){
      TabGroupsManager.session.sessionStore.setTabState(tabs[i],arrayOfTabs[i]);
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupClass.prototype.checkProtectedOfTabMixPlus=function(message,confirmResult){
  var protectedCount=0;
  for(var i=0;i<this.tabArray.length;i++){
    protectedCount+=this.tabArray[i].getAttribute("protected")?1:0;
  }
  if(protectedCount>0){
    if(confirmResult==null){
      if(confirm(message.replace("%1",protectedCount))){
        for(var i=0;i<this.tabArray.length;i++){
          this.tabArray[i].removeAttribute("protected");
        }
      }else{
        return false;
      }
    }else{
      return confirmResult;
    }
  }
  return true;
};
TabGroupsManager.GroupClass.prototype.removeAllProgressListener=function(){
  for(var i=0;i<this.tabArray.length;i++){
    try
    {
      this.tabArray[i].linkedBrowser.removeProgressListener(this.progressListener);
    }
    catch(e){
    }
  }
};
TabGroupsManager.GroupClass.prototype.close=function(){
  let lastGroup=(TabGroupsManager.allGroups.childNodes.length==1);
  if(lastGroup){
    TabGroupsManager.allGroups.openNewGroup();
  }
  if(this.selected){
    TabGroupsManager.allGroups.selectNextGroup();
  }
  this.removeAllTabsWithoutClosedTabsList();
  if(this.groupTab.parentNode){
    this.groupTab.parentNode.removeChild(this.groupTab);
    var arrowScrollBox=document.getElementById("TabGroupsManagerGroupBarScrollbox");
    setTimeout(function(){arrowScrollBox.scrollByPixels(-1);arrowScrollBox.scrollByPixels(1);},0);
    TabGroupsManager.allGroups.saveAllGroupsData();
  }
  if(lastGroup&&TabGroupsManagerJsm.applicationStatus.windows.length>1&&TabGroupsManagerJsm.globalPreferences.windowCloseWhenLastGroupClose){
    window.close();
  }else{
    TabGroupsManager.groupBarDispHide.hideGroupBarByGroupCount();
  }
};
TabGroupsManager.GroupClass.prototype.removeTabWithoutClosedTabsList=function(tab){
  let closedTabsJson=TabGroupsManager.session.sessionStore.getClosedTabData(window);
  gBrowser.removeTab(tab);
  TabGroupsManager.session.setClosedTabJson(closedTabsJson);
};
TabGroupsManager.GroupClass.prototype.removeAllTabsWithoutClosedTabsList=function(){
  if(this.tabArray.length<=0){
    return;
  }
  let closedTabsJson=TabGroupsManager.session.sessionStore.getClosedTabData(window);
  for(var i=0;i<this.tabArray.length;i++){
    this.unlinkTab(this.tabArray[i],true);
    gBrowser.removeTab(this.tabArray[i]);
  }
  this.tabArray.splice(0);
  TabGroupsManager.session.setClosedTabJson(closedTabsJson);
};
TabGroupsManager.GroupClass.prototype.initDefaultGroupAndModifyId=function(){
  if(this.id==-1){
    this.id=TabGroupsManagerJsm.applicationStatus.makeNewId();
    for(var i=0;i<this.tabArray.length;i++){
      var tab=this.tabArray[i];
      var groupId=TabGroupsManager.session.getGroupId(tab);
      if(isNaN(groupId)){
        TabGroupsManager.session.sessionStore.setTabValue(tab,"TabGroupsManagerGroupId",this.id.toString());
        TabGroupsManager.session.sessionStore.setTabValue(tab,"TabGroupsManagerGroupName",this.name);
        if("TMP_TabGroupsManager" in window){
          TabmixSessionManager.updateTabProp(tab);
        }
      }else{
        TabGroupsManager.session.moveTabToGroupBySessionStore(tab);
      }
    }
    TabGroupsManager.allGroups.saveAllGroupsData();
  }
};
TabGroupsManager.GroupClass.prototype.getGroupDataBase=function(){
  var groupData=
  {
    type:TabGroupsManagerJsm.constValues.groupDataType,
    id:this.id,
    name:this.name,
    image:this.image,
    disableAutoRename:this.disableAutoRename
  };
  if(this.tabViewBounds){
    groupData.tabViewBounds={left:this.tabViewBounds.left,top:this.tabViewBounds.top,width:this.tabViewBounds.width,height:this.tabViewBounds.height};
  }
  return groupData;
};
TabGroupsManager.GroupClass.prototype.setGroupDataBase=function(groupData){
  this._disableAutoRename=groupData.disableAutoRename;
  if(groupData.tabViewBounds){
    this.tabViewBounds=groupData.tabViewBounds;
  }
};
TabGroupsManager.GroupClass.prototype.getGroupDataWithoutTabs=function(){
  var groupData=this.getGroupDataBase();
  groupData.suspended=this.suspended;
  if(this.suspended){
    groupData.suspendArray=JSON.stringify(this.suspendArray);
    groupData.suspendTitleList=this.suspendTitleList
  }
  return groupData;
};
TabGroupsManager.GroupClass.prototype.setGroupDataWithoutTabs=function(groupData){
  this.setGroupDataBase(groupData);
  this.suspended=groupData.suspended;
  if(groupData.suspended){
    this.suspendedTabIndex=0;
    if(groupData.suspendArray){
      this.suspendArray=JSON.parse(groupData.suspendArray);
      this.suspendTitleList=groupData.suspendTitleList;
      this.dispGroupLabel();
    }
    TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  }
};
TabGroupsManager.GroupClass.prototype.reassignGroupIdFromMinus2=function(){
  if(this.id==-2){
    this.id=TabGroupsManagerJsm.applicationStatus.makeNewId();
    for(var i=0;i<this.tabArray.length;i++){
      TabGroupsManager.session.sessionStore.setTabValue(this.tabArray[i],"TabGroupsManagerGroupId",this.id.toString());
      if("TMP_TabGroupsManager" in window){
        TabmixSessionManager.updateTabProp(this.tabArray[i]);
      }
    }
  }
};
TabGroupsManager.GroupClass.prototype.getGroupDataWithAllTabs=function(){
  this.reassignGroupIdFromMinus2();
  var groupData=this.getGroupDataBase();
  if(TabGroupsManager.preferences.groupRestoreOldPosition==true){
    groupData.index=TabGroupsManager.allGroups.groupbar.getIndexOfItem(this.groupTab);
  }
  this.sortTabArrayByTPos();
  groupData.titleList="";
  groupData.tabs=new Array();
  if(this.suspended){
    for(var i=0;i<this.suspendArray.length;i++){
      groupData.tabs.push(this.suspendArray[i]);
    }
  }else{
    for(var i=0;i<this.tabArray.length;i++){
      groupData.titleList+=this.tabArray[i].label+"\n";
      groupData.tabs.push(TabGroupsManager.session.getTabStateEx(this.tabArray[i]));
    }
  }
  return groupData;
};
TabGroupsManager.GroupClass.prototype.setGroupDataWithAllTabs=function(groupData,tabObject){
  this.setGroupDataBase(groupData);
  if(tabObject==null){
    if(groupData.tabs&&groupData.tabs.length){
      this.restoreTabs(groupData.tabs);
    }
  }else{
    var tab=TabGroupsManager.overrideMethod.gBrowserAddTab();
    TabGroupsManager.session.sessionStore.setTabState(tab,tabObject);
  }
  if(TabGroupsManager.preferences.groupRestoreOldPosition==true&&groupData.index!=null&&groupData.index<TabGroupsManager.allGroups.groupbar.childNodes.length){
    TabGroupsManager.allGroups.changeGroupOrder(this,groupData.index);
  }
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
};
TabGroupsManager.GroupClass.prototype.mouseCommand=function(no){
  switch(no){
    case 1:this.sleepGroup();break;
    case 2:this.closeAllTabsAndGroup();break;
    case 5:this.suspended=!this.suspended;break;
    case 4:if(!this.disableAutoRename)this.autoRenameNameIcon();break;
    case 3:this.renameDialog();break;
  }
};
TabGroupsManager.GroupClass.prototype.bookmarkThisGroup=function(){
  var folderName=window.prompt(TabGroupsManager.strings.getString("EnterBookmarkFolderName"),this.name);
  if(folderName){
    this.bookmarkThisGroupCore(folderName);
  }
};
TabGroupsManager.GroupClass.prototype.bookmarkThisGroupCore=function(folderName,parentFolder){
  var places=Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
  if(!folderName){
    folderName=this.name;
  }
  if(!parentFolder){
    parentFolder=places.bookmarksMenuFolder;
  }
  var newFolderId=places.createFolder(parentFolder,folderName,places.DEFAULT_INDEX);
  if(this.suspended){
    for(var i=0;i<this.suspendArray.length;i++){
      try
      {
        var tabData=JSON.parse(this.suspendArray[i]);
        if(tabData.index){
          var uri=TabGroupsManager.utils.createNewNsiUri(tabData.entries[tabData.index-1].url);
          var title=tabData.entries[tabData.index-1].title;
          places.insertBookmark(newFolderId,uri,places.DEFAULT_INDEX,title);
        }
      }
      catch(e){
        TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
      }
    }
  }else{
    this.sortTabArrayByTPos();
    for(var i=0;i<this.tabArray.length;i++){
      try
      {
        var uri=this.tabArray[i].linkedBrowser.currentURI;
        var title=this.tabArray[i].linkedBrowser.contentTitle;
        places.insertBookmark(newFolderId,uri,places.DEFAULT_INDEX,title);
      }
      catch(e){
        TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
      }
    }
  }
};
TabGroupsManager.GroupClass.prototype.reloadTabsInGroup=function(){
  for(var i=0;i<this.tabArray.length;i++){
    var tab=this.tabArray[i];
    if(tab.linkedBrowser.currentURI.spec=="about:blank"){
      TabGroupsManager.session.disableOnSSTabRestoring=true;
      try
      {
        TabGroupsManager.session.sessionStore.setTabState(tab,TabGroupsManager.session.getTabStateEx(tab));
      }
      finally
      {
        TabGroupsManager.session.disableOnSSTabRestoring=false;
      }
    }else{
      tab.linkedBrowser.reload();
    }
  }
};
TabGroupsManager.GroupClass.prototype.isBlank=function(){
  if(this.suspended){
    return false;
  }
  if(this.name==""
   || this.name==TabGroupsManager.strings.getString("StartGroupName")
   || this.name==TabGroupsManager.strings.getString("ExtAppGroupName")
   || this.name==TabGroupsManager.strings.getString("HomeGroupName")
  ){
    for(var i=0;i<this.tabArray.length;i++){
      if(!TabGroupsManager.utils.isBlankTab(this.tabArray[i])){
        return false;
      }
    }
    return true;
  }
  return false;
};
TabGroupsManager.GroupClass.prototype.getFirstTabVisible=function(){
  let index;
  if(window.getComputedStyle(gBrowser.mTabContainer.parentNode,null).direction=="rtl"&&!gBrowser.mTabContainer.hasAttribute("multibar")){
    var lastTab=this.getLastTabInGroup();
    if(!lastTab ||!gBrowser.mTabContainer.lastChild.group){
      lastTab=gBrowser.mTabContainer.lastChild;
    }
    index=lastTab._tPos;
  }else{
    var firstTab=this.getFirstTabInGroup();
    if(!firstTab ||!gBrowser.mTabContainer.firstChild.group){
      firstTab=gBrowser.mTabContainer.firstChild;
    }
    index=firstTab._tPos;
  }
  return gBrowser.mTabContainer.isTabVisible(index);
};
TabGroupsManager.GroupClass.prototype.getLastTabVisible=function(){
  let index;
  if(window.getComputedStyle(gBrowser.mTabContainer.parentNode,null).direction=="rtl"&&!gBrowser.mTabContainer.hasAttribute("multibar")){
    var firstTab=this.getFirstTabInGroup();
    if(!firstTab ||!gBrowser.mTabContainer.firstChild.group){
      firstTab=gBrowser.mTabContainer.firstChild;
    }
    index=firstTab._tPos;
  }else{
    var lastTab=this.getLastTabInGroup();
    if(!lastTab ||!gBrowser.mTabContainer.lastChild.group){
      lastTab=gBrowser.mTabContainer.lastChild;
    }
    index=lastTab._tPos;
  }
  return gBrowser.mTabContainer.isTabVisible(index);
};
TabGroupsManager.GroupClass.prototype.duplicateGroup=function(){
  try
  {
    var newGroup=TabGroupsManager.allGroups.openNewGroupCore(null,this.name,this.image);
    newGroup._suspended=this._suspended;
    newGroup.suspendedTabIndex=this.suspendedTabIndex;
    newGroup.suspendTitleList=this.suspendTitleList;
    newGroup._disableAutoRename=this._disableAutoRename;
    newGroup.autoRenameBak=this.autoRenameBak;
    newGroup.autoRenameIndex=this.autoRenameIndex;
    newGroup.autoRenameDisableTimer=this.autoRenameDisableTimer;
    let newTabArray=this.duplicateTabsInGroup(this.tabArray);
    for(var i=0;i<newTabArray.length;i++){
      newGroup.addTab(newTabArray[i]);
      if(this.selectedTab==this.tabArray[i]){
        newGroup.selectedTab=newTabArray[i];
      }
    }
    if("treeStyleTab" in gBrowser){
      for(let i=0;i<newTabArray.length;i++){
        let parent=TreeStyleTabService.getParentTab(this.tabArray[i]);
        if(parent){
          gBrowser.treeStyleTab.attachTabTo(newTabArray[i],newTabArray[this.tabArray.indexOf(parent)]);
        }
      }
    }
    if(this.suspended){
      newGroup.suspendArray=new Array();
      for(var i=0;i<this.suspendArray.length;i++){
        var object=JSON.parse(this.suspendArray[i]);
        object.extData.TabGroupsManagerGroupId=newGroup.id;
        newGroup.suspendArray.push(JSON.stringify(object));
      }
    }
    newGroup.relateGroupTab(newGroup.groupTab);
    TabGroupsManager.allGroups.saveAllGroupsData();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return newGroup;
};
TabGroupsManager.GroupClass.prototype.exportGroup=function(){
  let nsIFilePicker=Ci.nsIFilePicker;
  let filePicker=Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  filePicker.init(window,null,nsIFilePicker.modeSave);
  filePicker.appendFilter(TabGroupsManager.strings.getString("GroupDataExtDescription")+"(*."+TabGroupsManagerJsm.constValues.groupDataExt+")","*."+TabGroupsManagerJsm.constValues.groupDataExt);
  filePicker.appendFilters(nsIFilePicker.filterAll);
  filePicker.defaultString=this.name+"."+TabGroupsManagerJsm.constValues.groupDataExt;
  filePicker.defaultExtension=TabGroupsManagerJsm.constValues.groupDataExt;
  switch(filePicker.show()){
    case nsIFilePicker.returnOK:
    case nsIFilePicker.returnReplace:
      let file=new TabGroupsManagerJsm.NsIFileWrapper(filePicker.file);
      file.writeFileAsText(JSON.stringify(this.getGroupDataWithAllTabs()));
    break;
  }
};
TabGroupsManager.AllGroups=function(){
  try
  {
    this.updating=false;
    this.saveAllGroupsDataTimer=null;
    this.saveAllGroupsDataTimeout=100;
    this.__defineGetter__("groupbar",function(){return document.getElementById("TabGroupsManagerGroupbar");});
    this.__defineGetter__("childNodes",function(){return this.groupbar.childNodes;});
    this.__defineGetter__("firstChild",function(){return this.groupbar.firstChild;});
    this.__defineGetter__("lastChild",function(){return this.groupbar.lastChild;});
    this.__defineGetter__("selectedGroup",this.getSelectedGroup);
    this.__defineSetter__("selectedGroup",this.setSelectedGroup);
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.AllGroups.prototype.getSelectedGroup=function(){
  return this.groupbar.selectedItem.group;
};
TabGroupsManager.AllGroups.prototype.setSelectedGroup=function(value){
  this.groupbar.selectedItem=value.groupTab;
};
TabGroupsManager.AllGroups.prototype.selectNextGroup=function(){
  var selectedIndex=this.groupbar.selectedIndex;
  for(var i=selectedIndex+1;i<this.childNodes.length;i++){
    if(!this.childNodes[i].group.suspended){
      return this.groupbar.selectedItem=this.childNodes[i];
    }
  }
  for(var i=selectedIndex-1;i>=0;i--){
    if(!this.childNodes[i].group.suspended){
      return this.groupbar.selectedItem=this.childNodes[i];
    }
  }
  for(var i=selectedIndex+1;i<this.childNodes.length;i++){
    return this.groupbar.selectedItem=this.childNodes[i];
  }
  for(var i=selectedIndex-1;i>=0;i--){
    return this.groupbar.selectedItem=this.childNodes[i];
  }
  return null;
};
TabGroupsManager.AllGroups.prototype.selectLeftGroup=function(){
  this.groupbar.advanceSelectedTab(-1,true);
};
TabGroupsManager.AllGroups.prototype.selectRightGroup=function(){
  this.groupbar.advanceSelectedTab(1,true);
};
TabGroupsManager.AllGroups.prototype.selectLastGroup=function(){
  this.childNodes[this.childNodes.length-1].group.setSelected();
};
TabGroupsManager.AllGroups.prototype.selectNthGroup=function(n){
  if(this.childNodes.length>n){
    this.childNodes[n].group.setSelected();
  }
};
TabGroupsManager.AllGroups.prototype.getGroupById=function(id){
  var groupTab=document.getElementById("_group"+id);
  return groupTab?groupTab.group:null;
};
TabGroupsManager.AllGroups.prototype.openNewGroup=function(tab,id,name,image,forTabMixPlus){
  var group=this.openNewGroupCore(id,name,image);
  if(!tab){
    if(("TMP_BrowserOpenTab" in window)&&forTabMixPlus=="TMP_BrowserOpenTab"){
      tab=TMP_BrowserOpenTab(null,true);
    }else{
      tab=TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank");
    }
  }
  group.addTab(tab);
  return group;
};
TabGroupsManager.AllGroups.prototype.openNewGroupActive=function(tab,id,name,image){
  var group=this.openNewGroup(tab,id,name,image);
  this.selectedGroup=group;
  return group;
};
TabGroupsManager.AllGroups.prototype.openNewGroupRename=function(tab,id,name,image){
  name=window.prompt(TabGroupsManager.strings.getString("RenameDialogMessage"),"");
  if(name!==null){
    var group=this.openNewGroup(tab,id,name,image);
    TabGroupsManagerJsm.globalPreferences.addGroupNameHistory(name);
    group.disableAutoRename=true;
    return group;
  }
  return null;
};
TabGroupsManager.AllGroups.prototype.openNewGroupRenameActive=function(tab,id,name,image){
  var group=this.openNewGroupRename(tab,id,name,image);
  if(group){
    this.selectedGroup=group;
  }
  return group;
};
TabGroupsManager.AllGroups.prototype.openNewGroupHome=function(tab,id,name,image){
  if(name==null){
    name=TabGroupsManager.strings.getString("HomeGroupName");
  }
  var group=this.openNewGroup(tab,id,name,image);
  var browser=group.selectedTab.linkedBrowser;
  var homepageUri=gHomeButton.getHomePage().split("|")[0];
  browser.loadURI(homepageUri);
  return group;
};
TabGroupsManager.AllGroups.prototype.openNewGroupHomeActive=function(tab,id,name,image){
  var group=this.openNewGroupHome(tab,id,name,image);
  this.selectedGroup=group;
  return group;
};
TabGroupsManager.AllGroups.prototype.openNewGroupCore=function(id,name,image){
  var group=new TabGroupsManager.GroupClass(id,name,image);
  if(!this.groupbar.selectedItem){
    this.selectedGroup=group;
  }
  document.getElementById("TabGroupsManagerGroupBarScrollbox").ensureElementIsVisible(group.groupTab);
  return group;
};
TabGroupsManager.AllGroups.prototype.sleepActiveGroup=function(){
  this.selectedGroup.sleepGroup();
};
TabGroupsManager.AllGroups.prototype.closeActiveGroup=function(){
  this.selectedGroup.closeAllTabsAndGroup();
};
TabGroupsManager.AllGroups.prototype.suspendActiveGroup=function(){
  this.selectedGroup.suspendGroup();
};
TabGroupsManager.AllGroups.prototype.saveAllGroupsDataTimerChancel=function(){
  if(this.saveAllGroupsDataTimer!=null){
    clearTimeout(this.saveAllGroupsDataTimer);
    this.saveAllGroupsDataTimer=null;
  }
};
TabGroupsManager.AllGroups.prototype.saveAllGroupsData=function(){
  this.saveAllGroupsDataTimerChancel();
  if(TabGroupsManager.session.groupRestored<2 || this.updating==true){
    return;
  }
  var _this=this;
  this.saveAllGroupsDataTimer=setTimeout(function(){_this.saveAllGroupsDataImmediately();},this.saveAllGroupsDataTimeout,this);
};
TabGroupsManager.AllGroups.prototype.saveAllGroupsDataImmediately=function(_this){
  /*SSTabRestoring fires on every tab restoring -> so let us save data only if groups are in status restored         */
  /*in other case we will fetch data from the groups but the restore is still in progress and datas are not complete */ 
  /*so we lost our extData due the async stuff in sessionstore with fx > 29                                          */
  if(TabGroupsManager.session.groupRestored == 2) {
	  if(_this==null){
		_this=this;
	  }
	  _this.saveAllGroupsDataTimerChancel();
	  var allGroupsData={};
	  allGroupsData.groups=new Array();
	  for(var i=0;i<_this.childNodes.length;i++){
		allGroupsData.groups.push(_this.childNodes[i].group.getGroupDataWithoutTabs());
	  }
	  let jsonText=JSON.stringify(allGroupsData);
	  try
	  {
		TabGroupsManager.session.sessionStore.setWindowValue(window,"TabGroupsManagerAllGroupsData",jsonText);
	  }
	  catch(e){
		TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
	  }
	  if(("TMP_TabGroupsManager" in window)&&("saveAllGroupsData" in window.TabmixSessionManager)){
		TabmixSessionManager.saveAllGroupsData(jsonText);
	  }
  }
};
TabGroupsManager.AllGroups.prototype.beginUpdate=function(){
  this.updating=true;
  setTimeout(function(_this){_this.endUpdateByTimer();},0,this);
};
TabGroupsManager.AllGroups.prototype.endUpdate=function(){
  this.updating=false;
  this.saveAllGroupsData();
};
TabGroupsManager.AllGroups.prototype.endUpdateByTimer=function(){
  if(this.updating){
    this.endUpdate();
  }
};
TabGroupsManager.AllGroups.prototype.loadAllGroupsData=function(){
  TabGroupsManager.session.groupRestored=1;
  try
  {
    try
    {
      let jsonText=TabGroupsManager.session.sessionStore.getWindowValue(window,"TabGroupsManagerAllGroupsData");
      if(jsonText!=null&&jsonText!=""){
        var allGroupsData=JSON.parse(jsonText);
        for(var i=0;i<allGroupsData.groups.length;i++){
          var groupData=allGroupsData.groups[i];
          if(!this.getGroupById(groupData.id)){
            var group=this.openNewGroupCore(groupData.id,groupData.name,groupData.image);
            group.setGroupDataWithoutTabs(groupData);
          }
        }
      }
    }
    catch(e){ //show errors as window is not tracked during startup caused by small delay on initialisation > Fx33
		TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
    if(TabGroupsManager.session.sessionRestoring){
      if(TabGroupsManagerJsm.globalPreferences.lastSessionFinalized){
        TabGroupsManager.session.allTabsMoveToGroup();
      }
    }else{
      TabGroupsManager.allGroups.selectedGroup.initDefaultGroupAndModifyId();
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.session.groupRestored=2;
  }
};
TabGroupsManager.AllGroups.prototype.dispHideAllGroupIcon=function(){
  var value=TabGroupsManager.preferences.dispGroupTabIcon;
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].group.dispHideGroupIcon(value);
  }
};
TabGroupsManager.AllGroups.prototype.dispHideAllGroupTabCount=function(){
  var value=TabGroupsManager.preferences.dispGroupTabCount;
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].group.dispHideTabCount(value);
  }
};
TabGroupsManager.AllGroups.prototype.dispAllGroupLabel=function(){
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].group.dispGroupLabel();
  }
};
TabGroupsManager.AllGroups.prototype.mouseCommand=function(no){
  switch(no&255){
    case 1:TabGroupsManager.command.OpenNewGroup();break;
    case 6:TabGroupsManager.command.OpenNewGroupActive();break;
    case 7:TabGroupsManager.command.OpenNewGroupRename();break;
    case 8:TabGroupsManager.command.OpenNewGroupRenameActive();break;
    case 9:TabGroupsManager.command.OpenNewGroupHome();break;
    case 10:TabGroupsManager.command.OpenNewGroupHomeActive();break;
    case 2:TabGroupsManager.command.SleepActiveGroup();break;
    case 3:TabGroupsManager.command.CloseActiveGroup();break;
    case 11:TabGroupsManager.command.SuspendActiveGroup();break;
    case 4:TabGroupsManager.command.RestoreLatestSleepedGroup();break;
    case 5:TabGroupsManager.command.RestoreLatestClosedGroup();break;
  }
};
TabGroupsManager.AllGroups.prototype.setMinWidthAllGroup=function(){
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].minWidthWithReduce=TabGroupsManager.preferences.groupTabMinWidth;
  }
};
TabGroupsManager.AllGroups.prototype.setMaxWidthAllGroup=function(){
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].maxWidth=TabGroupsManager.preferences.groupTabMaxWidth;
  }
};
TabGroupsManager.AllGroups.prototype.setReduceAllGroup=function(){
  for(var i=0;i<this.childNodes.length;i++){
    if(this.childNodes[i].group.suspended){
      this.childNodes[i].group.groupTab.reduce=TabGroupsManager.preferences.reduceSuspendGroup;
    }
  }
};
TabGroupsManager.AllGroups.prototype.setCropAllGroup=function(){
  const GroupTabCropString=["none","start","end","center"];
  var value=GroupTabCropString[TabGroupsManager.preferences.groupTabCrop];
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].group.groupTab.setAttribute("crop",value);
  }
};
TabGroupsManager.AllGroups.prototype.scrollInActiveGroup=function(smooth){
  var scrollbox=document.getElementById("TabGroupsManagerGroupBarScrollbox");
  if(smooth ||!scrollbox.smoothScroll){
    scrollbox.ensureElementIsVisible(this.selectedGroup.groupTab);
  }else{
    scrollbox.smoothScroll=false;
    scrollbox.ensureElementIsVisible(this.selectedGroup.groupTab);
    scrollbox.smoothScroll=true;
  }
};
TabGroupsManager.AllGroups.prototype.changeGroupOrderInsertBefore=function(srcGroup,dstIndex,isCopy){
  if(isCopy){
    srcGroup=srcGroup.duplicateGroup();
  }
  var srcIndex=srcGroup.groupTab.parentNode.getIndexOfItem(srcGroup.groupTab);
  if(dstIndex==null || dstIndex>=this.childNodes.length){
    dstIndex=this.childNodes.length-1;
  }else if(dstIndex<0){
    dstIndex=0;
  }else if(srcIndex<dstIndex){
    dstIndex--;
  }
  return this.changeGroupOrder(srcGroup,dstIndex);
};
TabGroupsManager.AllGroups.prototype.changeGroupOrder=function(srcGroup,dstIndex){
  var srcIndex=srcGroup.groupTab.parentNode.getIndexOfItem(srcGroup.groupTab);
  if(srcIndex==dstIndex){
    return false;
  }
  var selectedIndex=this.groupbar.selectedIndex;
  var dir=(srcIndex<dstIndex)?+1:-1;
  var newSelectedIndex=-1;
  var i;
  for(i=srcIndex;i!=dstIndex;i+=dir){
    this.childNodes[i+dir].group.relateGroupTab(this.childNodes[i]);
    if(selectedIndex==i+dir){
      newSelectedIndex=i;
    }
  }
  srcGroup.relateGroupTab(this.childNodes[i]);
  if(selectedIndex==srcIndex){
    newSelectedIndex=i;
  }
  if(newSelectedIndex!=-1){
    this.groupbar.selectedIndex=newSelectedIndex;
  }
  TabGroupsManager.allGroups.saveAllGroupsData();
  return true;
};
TabGroupsManager.AllGroups.prototype.bookmarkAllGroups=function(){
  var folderName=window.prompt(TabGroupsManager.strings.getString("EnterBookmarkFolderName"),"");
  if(folderName){
    this.bookmarkAllGroupsCore(folderName)
  }
};
TabGroupsManager.AllGroups.prototype.bookmarkAllGroupsCore=function(folderName,parentFolder){
  var places=Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
  if(!parentFolder){
    parentFolder=places.bookmarksMenuFolder;
  }
  var newFolderId=places.createFolder(parentFolder,folderName,places.DEFAULT_INDEX);
  for(var i=0;i<this.childNodes.length;i++){
    this.childNodes[i].group.bookmarkThisGroupCore(null,newFolderId);
  }
  var sleepingFolderId=places.createFolder(newFolderId,"+ Hibernated Groups",places.DEFAULT_INDEX);
  TabGroupsManager.sleepingGroups.bookmarkAllStoredGroup(sleepingFolderId);
};
TabGroupsManager.AllGroups.prototype.listMoveGroup=function(){
  var groupArray=new Array();
  for(var i=0;i<this.childNodes.length;i++){
    var groupTab=this.childNodes[i];
    if(!groupTab.group.isBlank()){
      groupArray.push(groupTab);
    }
  }
  return groupArray;
};
TabGroupsManager.AllGroups.prototype.moveAllGroupsToMainWindow=function(){
  var groupArray=this.listMoveGroup();
  var targetWindow=TabGroupsManagerJsm.applicationStatus.searchMainWindow(window);
  for(var i=0;i<groupArray.length;i++){
    targetWindow.TabGroupsManager.allGroups.moveGroupToOtherWindow(groupArray[i],null,false);
  }
};
TabGroupsManager.AllGroups.prototype.moveGroupToSameWindow=function(groupTab,event,isCopy){
  if(groupTab==event.target&&!isCopy){
    return false;
  }
  var dropGroupIndex=TabGroupsManager.allGroups.groupbar.getIndexOfItem(event.target);
  dropGroupIndex+=TabGroupsManager.allGroups.dropPositionIsRight(groupTab,event.target,event.clientX);
  return TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group,dropGroupIndex,isCopy);
};
TabGroupsManager.AllGroups.prototype.makeNewTabAndSwapWithOtherWindow=function(newGroup,fromTab){
  var newTab=TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank");
  newTab.linkedBrowser.stop();
  gBrowser.swapBrowsersAndCloseOther(newTab,fromTab);
  newGroup.dndMoveTabToGroup(newTab);
  return newTab;
};
TabGroupsManager.AllGroups.prototype.moveGroupToOtherWindow=function(fromGroupTab,event,isCopy){
  var fromGroup=fromGroupTab.group;
  var fromWindow=fromGroupTab.ownerDocument.defaultView;
  if(isCopy){
    fromGroup=fromGroup.duplicateGroup();
  }
  fromGroup.sortTabArrayByTPos();
  var tabArray=fromGroup.tabArray.slice(0);
  var selectedTab=fromGroup.selectedTab;
  if(fromGroup.selected){
    if(fromWindow.TabGroupsManager.allGroups.childNodes.length>1){
      fromWindow.TabGroupsManager.allGroups.selectNextGroup();
    }else{
      fromWindow.gBrowser.selectedTab=fromGroup.tabArray[fromGroup.tabArray.length-1];
    }
  }
  var newGroup=TabGroupsManager.allGroups.openNewGroupCore(fromGroup.id,fromGroup.name,fromGroup.image);
  newGroup.setGroupDataWithoutTabs(fromGroup.getGroupDataWithoutTabs());
  for(var i=0;i<tabArray.length;i++){
    var fromTab=tabArray[i];
    var newTab=this.makeNewTabAndSwapWithOtherWindow(newGroup,fromTab);
    if(selectedTab==fromTab){
      newGroup.selectedTab=newTab;
    }
  }
  var sessionSaved=false;
  var groupBar=newGroup.groupTab.parentNode;
  if(event!=null){
    var dropGroupIndex=0;
    if(event!==0){
      var dropGroupIndex=groupBar.getIndexOfItem(event.target);
      dropGroupIndex+=TabGroupsManager.allGroups.dropPositionIsRight(newGroup.groupTab,event.target,event.clientX,true);
    }
    sessionSaved=TabGroupsManager.allGroups.changeGroupOrderInsertBefore(newGroup,dropGroupIndex)
  }
  if(fromWindow.TabGroupsManager&&fromGroup.groupTab.label!=null){
    fromGroup.close();
  }
  if(!sessionSaved){
    this.saveAllGroupsData();
  }
  return newGroup;
};
TabGroupsManager.AllGroups.prototype.dropPositionX=function(sourceTab,targetTab,clientX){
  var left=targetTab.getBoundingClientRect().left;
  var right=targetTab.getBoundingClientRect().right;
  if(sourceTab&&sourceTab.parentNode==targetTab.parentNode){
    if(left==sourceTab.getBoundingClientRect().right){
      return right;
    }else if(right==sourceTab.getBoundingClientRect().left){
      return left;
    }
  }
  return(clientX<((left+right)/ 2))?left:right;
};
TabGroupsManager.AllGroups.prototype.dropPositionIsRight=function(sourceTab,targetTab,clientX,isCopy){
  var left=targetTab.getBoundingClientRect().left;
  var right=targetTab.getBoundingClientRect().right;
  if(!isCopy){
    if(left==sourceTab.getBoundingClientRect().right){
      return 1;
    }else if(right==sourceTab.getBoundingClientRect().left){
      return 0;
    }
  }
  return(clientX<((left+right)/ 2))?0:1;
};
TabGroupsManager.AllGroups.prototype.checkCurrentTabInTabsOfMTH=function(tabs){
  return(-1!=tabs.indexOf(gBrowser.selectedTab));
};
TabGroupsManager.AllGroups.prototype.searchCurrentTabWithoutTabsOfMTH=function(){
  var group=gBrowser.selectedTab.group;
  var candidateTab=null;
  for(var tab=gBrowser.selectedTab.nextSibling;tab;tab=tab.nextSibling){
    if(tab.TabGroupsManagerMoveTabTmp!==true){
      if(tab.group==group){
        return tab;
      }else if(candidateTab==null){
        candidateTab=tab;
      }
    }
  }
  for(var tab=gBrowser.selectedTab.previousSibling;tab;tab=tab.previousSibling){
    if(tab.TabGroupsManagerMoveTabTmp!==true){
      if(tab.group==group){
        return tab;
      }else if(candidateTab==null){
        candidateTab=tab;
      }
    }
  }
  return candidateTab;
};
TabGroupsManager.AllGroups.prototype.moveCurrentTabWithoutTabsOfMTH=function(tabs){
  if(!this.checkCurrentTabInTabsOfMTH(tabs)){
    return;
  }
  for(var i=0;i<tabs.length;i++){
    tabs[i].TabGroupsManagerMoveTabTmp=true;
  }
  var newCuttentTab=this.searchCurrentTabWithoutTabsOfMTH();
  if(newCuttentTab){
    gBrowser.selectedTab=newCuttentTab;
  }
  for(var i=0;i<tabs.length;i++){
    delete tabs[i].TabGroupsManagerMoveTabTmp;
  }
};
TabGroupsManager.AllGroups.prototype.moveTabToGroupInSameWindow=function(tab,group,isCopy){
  if(group){
    group.deleteBlankTab();
  }else{
    group=TabGroupsManager.allGroups.openNewGroupCore();
  }
  if((group==tab.group || group.displayTabCount<=1)&&group.name==""){
    group.autoRenameNameIcon(tab);
  }
  var tabs=this.checkMultipleTabHandler(tab,window);
  for(var i=0;i<tabs.length;i++){
    var moveTab=isCopy?TabGroupsManager.session.duplicateTabEx(window,tabs[i]):tabs[i];
    group.dndMoveTabToGroup(moveTab);
  }
};
TabGroupsManager.AllGroups.prototype.moveTabToGroupInOtherWindow=function(fromTab,newGroup,isCopy){
  var fromWindow=fromTab.ownerDocument.defaultView;
  newGroup=newGroup || TabGroupsManager.allGroups.openNewGroupCore();
  newGroup.deleteBlankTab();
  if(newGroup.displayTabCount<=1&&newGroup.name==""){
    newGroup.autoRenameNameIcon(fromTab);
  }
  var tabs=this.checkMultipleTabHandler(fromTab,fromWindow);
  for(var i=0;i<tabs.length;i++){
    var moveTab=isCopy?TabGroupsManager.session.duplicateTabEx(fromWindow,tabs[i]):tabs[i];
    this.makeNewTabAndSwapWithOtherWindow(newGroup,moveTab);
  }
};
TabGroupsManager.AllGroups.prototype.checkMultipleTabHandler=function(fromTab,fromWindow){
  if("MultipleTabService" in fromWindow){
    var tabs=fromWindow.MultipleTabService.getBundledTabsOf(fromTab);
    if(tabs.length>0){
      this.moveCurrentTabWithoutTabsOfMTH(tabs);
      fromWindow.MultipleTabService.clearSelection();
      return tabs;
    }
  }
  return[fromTab];
};
TabGroupsManager.AllGroups.prototype.countNonSuspendedGroups=function(){
  var count=0;
  for(var i=0;i<this.childNodes.length;i++){
    if(!this.childNodes[i].group.suspended){
      count++;
    }
  }
  return count;
};
TabGroupsManager.AllGroups.prototype.makeNonSuspendedGroupsList=function(){
  let list=new Array();
  for(let i=0;i<this.childNodes.length;i++){
    if(!this.childNodes[i].group.suspended){
      list.push(this.childNodes[i].group);
    }
  }
  return list;
};
TabGroupsManager.AllGroups.prototype.suspendAllNonSelectedGroups=function(){
  let data=
  {
    object:this,
    function:this.suspendAllNonSelectedGroupsProgressFunction,
    title:TabGroupsManager.strings.getString("DialogTitle"),
    message:TabGroupsManager.strings.getString("SuspendingGroups"),
    progressMin:0,
    progressMax:this.childNodes.length * 1000,
    progressValue:0
  };
  window.openDialog("chrome://tabgroupsmanager/content/ProgressmeterDialog.xul","_blank","chrome,modal,dialog,centerscreen,resizable,close=no,titlebar=no",data);
  this.saveAllGroupsDataImmediately();
};
TabGroupsManager.AllGroups.prototype.suspendAllNonSelectedGroupsProgressFunction=function(progressWindow,progressClass){
  try
  {
    AxelUtils.setTimeoutDelegator.exec(progressWindow,this,this.suspendAllNonSelectedGroupsProgressFunctionLoop,0,[0,progressWindow,progressClass]);
  }
  catch(e){
    progressClass.finalize();
  }
};
TabGroupsManager.AllGroups.prototype.suspendAllNonSelectedGroupsProgressFunctionLoop=function(index,progressWindow,progressClass){
  try
  {
    for(;index<this.childNodes.length;index++){
      let group=this.childNodes[index].group;
      if(!group.selected&&!group.suspended){
        group.suspendGroup();
        break;
      }
    }
    index++;
    progressClass.progress.value=index * 1000;
    if(index<this.childNodes.length){
      AxelUtils.setTimeoutDelegator.exec(progressWindow,this,this.suspendAllNonSelectedGroupsProgressFunctionLoop,0,[index,progressWindow,progressClass]);
    }else{
      progressClass.finalize();
    }
  }
  catch(e){
    progressClass.finalize();
  }
};
TabGroupsManager.AllGroups.prototype.readDummyBlankPage=function(){
  let linkedBrowser=gBrowser.selectedTab.linkedBrowser;
  if(linkedBrowser.currentURI.spec=="about:blank"){
    linkedBrowser.loadURI("chrome://tabgroupsmanager/content/blank.html");
  }
};
TabGroupsManager.AllGroups.prototype.waitDummyBlankPage=function(){
  if(gBrowser.selectedTab.linkedBrowser.currentURI.spec!="about:blank"){
    return;
  }
  let data=
  {
    object:this,
    function:this.dummyBlankPageForTmpProgress,
    title:"",
    message:""
  };
  window.openDialog("chrome://tabgroupsmanager/content/ProgressmeterDialog.xul","_blank","chrome,modal,dialog,centerscreen,resizable,close=no,titlebar=no",data);
};
TabGroupsManager.AllGroups.prototype.dummyBlankPageForTmpProgress=function(progressWindow,progressClass,index){
  try
  {
    index=(index==undefined)?0:index+1;
    if(index<50 && gBrowser.selectedTab.linkedBrowser.currentURI.spec=="about:blank"){
      AxelUtils.setTimeoutDelegator.exec(progressWindow,this,this.dummyBlankPageForTmpProgress,100,[progressWindow,progressClass,index]);
      return;
    }
  }
  catch(e){
  }
  progressClass.finalize();
};
TabGroupsManager.GroupBarDispHide=function(){
  try
  {
    this.__defineGetter__("dispGroupBar",function(){return this.fDispGroupBar;});
    this.__defineSetter__("dispGroupBar",this.setDispGroupBar);
    this.fDispGroupBar=true;
    this.hideBarTimer=null;
    if(TabGroupsManager.preferences.hideGroupBarByContentClick){
      this.setContentClickEvent();
    }
    if(TabGroupsManager.preferences.hideGroupBarByMouseover){
      this.setMouseoverEvent();
    }
    if(TabGroupsManager.preferences.hideGroupBarByMouseout){
      setTimeout(function(){TabGroupsManager.groupBarDispHide.setMouseoutEvent();},0);
      setTimeout(function(){TabGroupsManager.groupBarDispHide.dispGroupBar=false;},10000);
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupBarDispHide.prototype.setContentClickEvent=function(){
  var contentArea=document.getAnonymousElementByAttribute(document.getElementById("content"),"anonid","panelcontainer");
  contentArea.addEventListener("click",this.contentAreaClick,false);
};
TabGroupsManager.GroupBarDispHide.prototype.removeContentClickEvent=function(){
  var contentArea=document.getAnonymousElementByAttribute(document.getElementById("content"),"anonid","panelcontainer");
  contentArea.removeEventListener("click",this.contentAreaClick,false);
};
TabGroupsManager.GroupBarDispHide.prototype.setMouseoverEvent=function(){
  let eventArea=document.getElementById((TabGroupsManager.preferences.groupBarPosition==2)?"browser-bottombox":"navigator-toolbox");
  eventArea.addEventListener("mouseover",this.onMouseoverToolbox,false);
  eventArea.addEventListener("dragenter",this.onMouseoverToolbox,false);
};
TabGroupsManager.GroupBarDispHide.prototype.removeMouseoverEvent=function(){
  let eventArea=document.getElementById((TabGroupsManager.preferences.groupBarPosition==2)?"browser-bottombox":"navigator-toolbox");
  eventArea.removeEventListener("mouseover",this.onMouseoverToolbox,false);
  eventArea.removeEventListener("dragenter",this.onMouseoverToolbox,false);
};
TabGroupsManager.GroupBarDispHide.prototype.setMouseoutEvent=function(){
  var contentArea=document.getAnonymousElementByAttribute(document.getElementById("content"),'anonid','panelcontainer');
  contentArea.addEventListener("mouseover",this.onMouseoutToolbox,false);
  contentArea.addEventListener("mouseout",this.onMouseoverToolbox2,false);
};
TabGroupsManager.GroupBarDispHide.prototype.removeMouseoutEvent=function(){
  var contentArea=document.getAnonymousElementByAttribute(document.getElementById("content"),'anonid','panelcontainer');
  contentArea.removeEventListener("mouseover",this.onMouseoutToolbox,false);
  contentArea.removeEventListener("mouseout",this.onMouseoverToolbox2,false);
};
TabGroupsManager.GroupBarDispHide.prototype.contentAreaClick=function(event){
  TabGroupsManager.groupBarDispHide.dispGroupBar=false;
};
TabGroupsManager.GroupBarDispHide.prototype.setDispGroupBar=function(value){
  if(!value&&document.getElementById("navigator-toolbox").customizing){
    return;
  }
  value=value || false;
  if(value!=this.fDispGroupBar){
    this.fDispGroupBar=value;
    TabGroupsManager.utils.setRemoveAttribute(TabGroupsManager.xulElements.groupBar,"collapsed",!this.dispGroupBar);
    if(value){
      TabGroupsManager.allGroups.scrollInActiveGroup();
    }
  }
};
TabGroupsManager.GroupBarDispHide.prototype.toggleDispGroupBar=function(){
  this.dispGroupBar=!this.fDispGroupBar;
  TabGroupsManager.allGroups.groupbar.selectedItem.focus();
};
TabGroupsManager.GroupBarDispHide.prototype.onMouseoverToolbox=function(event){
  let tabBarRect=TabGroupsManager.xulElements.tabBar.getBoundingClientRect();
  if(tabBarRect.top<=event.clientY&&event.clientY<=tabBarRect.bottom){
    return;
  }
  TabGroupsManager.groupBarDispHide.dispGroupBar=true;
};
TabGroupsManager.GroupBarDispHide.prototype.onMouseoverToolbox2=function(){
  if(this.hideBarTimer!=null){
    clearTimeout(this.hideBarTimer);
    this.hideBarTimer=null;
  }
};
TabGroupsManager.GroupBarDispHide.prototype.onMouseoutToolbox=function(){
  if(this.hideBarTimer!=null){
    clearTimeout(this.hideBarTimer);
    this.hideBarTimer=null;
  }
  this.hideBarTimer=setTimeout(function(){TabGroupsManager.groupBarDispHide.dispGroupBar=false;},TabGroupsManager.preferences.hideGroupBarByMouseoutTimer);
};
TabGroupsManager.GroupBarDispHide.prototype.dispGroupBarByGroupCount=function(){
  if(TabGroupsManager.allGroups.childNodes.length!=1){
    if(TabGroupsManager.preferences.hideGroupBarByTabGroupCount&10){
      this.dispGroupBar=true;
    }
    this.dispGroupBarByTabCount();
  }
};
TabGroupsManager.GroupBarDispHide.prototype.hideGroupBarByGroupCount=function(){
  if(TabGroupsManager.allGroups.childNodes.length==1){
    if(TabGroupsManager.preferences.hideGroupBarByTabGroupCount&2 ||
       TabGroupsManager.preferences.hideGroupBarByTabGroupCount&8&&
       TabGroupsManagerJsm.applicationStatus.groupBarIsDisplayedInOtherWindow(window)
    ){
      this.dispGroupBar=false;
    }
    this.hideGroupBarByTabCount();
  }
};
TabGroupsManager.GroupBarDispHide.prototype.dispGroupBarByTabCount=function(){
  if(TabGroupsManager.allGroups.childNodes.length!=1 || gBrowser.mTabContainer.childNodes.length!=1){
    if(TabGroupsManager.preferences.hideGroupBarByTabGroupCount&5){
      this.dispGroupBar=true;
    }
    if(TabGroupsManager.preferences.hideGroupBarByTabGroupCount&16){
      TabGroupsManager.xulElements.tabBar.removeAttribute("collapsed");
    }
  }
};
TabGroupsManager.GroupBarDispHide.prototype.hideGroupBarByTabCountDelay=function(){
  setTimeout(function(){TabGroupsManager.groupBarDispHide.hideGroupBarByTabCount()},0);
};
TabGroupsManager.GroupBarDispHide.prototype.hideGroupBarByTabCount=function(){
  if(TabGroupsManager.allGroups.childNodes.length==1&&gBrowser.mTabContainer.childNodes.length==1){
    if(TabGroupsManager.preferences.hideGroupBarByTabGroupCount&1 ||
       TabGroupsManager.preferences.hideGroupBarByTabGroupCount&5&&
       TabGroupsManagerJsm.applicationStatus.groupBarIsDisplayedInOtherWindow(window)
    ){
      this.dispGroupBar=false;
    }
    if(TabGroupsManager.preferences.hideGroupBarByTabGroupCount&16&&
       TabGroupsManagerJsm.applicationStatus.groupBarIsDisplayedInOtherWindow(window)
    ){
      TabGroupsManager.xulElements.tabBar.setAttribute("collapsed",true);
    }
  }
};
TabGroupsManager.GroupBarDispHide.prototype.saveGroupBarDispHideToSessionStore=function(){
  try
  {
    TabGroupsManager.session.sessionStore.setWindowValue(window,"TabGroupsManagerGroupBarHide",this.dispGroupBar);
  }
  catch(e){
  }
};
TabGroupsManager.GroupBarDispHide.prototype.firstStatusOfGroupBarDispHide=function(){
  let oldStatus="";
  try
  {
    oldStatus=TabGroupsManager.session.sessionStore.getWindowValue(window,"TabGroupsManagerGroupBarHide");
  }
  catch(e){
  }
  if(oldStatus!=null&&oldStatus!=""){
    TabGroupsManager.session.sessionStore.deleteWindowValue(window,"TabGroupsManagerGroupBarHide");
    this.dispGroupBar=(oldStatus=="true");
  }else{
    this.hideGroupBarByGroupCount();
    this.hideGroupBarByTabCountDelay();
  }
};
TabGroupsManager.GroupsStore=function(storeFunction,maxLength,saveWhenChangeing,menuitemContextMenu){
  try
  {
    this.maxLength=maxLength;
    this.saveWhenChangeing=(saveWhenChangeing===true);
    this.menuitemContextMenu=menuitemContextMenu;
    this.__defineGetter__("store",storeFunction);
    var _this=this;
    this.menuitemCommandEvent=function(event){_this.onMenuitemCommand(event);};
    this.menuitemClickEvent=function(event){_this.onMenuitemClick(event);};
    this.contextCommandEvent=function(event){_this.onContextMenuCommand(event);};
    this.contextClickEvent=function(event){_this.onContextMenuClick(event);};
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.GroupsStore.prototype.addGroup=function(groupData,closeGroup){
  var groupDataTmp=this.pop(groupData.id);
  if(groupDataTmp){
    for(var i=0;i<groupData.tabs.length;i++){
      groupDataTmp.tabs.push(groupData.tabs[i]);
    }
    groupDataTmp.titleList+=groupData.titleList;
    groupData=groupDataTmp;
  }
  this.store.unshift(groupData);
  this.storeLimitCheck();
  if(closeGroup){
    closeGroup.close();
  }
  if(this.saveWhenChangeing){
    TabGroupsManagerJsm.saveData.saveLatestData();
  }
};
TabGroupsManager.GroupsStore.prototype.sendTabToGroupsStore=function(tab,groupId){
  var groupData=this.peek(groupId);
  if(groupData){
    TabGroupsManager.session.sessionStore.setTabValue(tab,"TabGroupsManagerGroupId",groupId.toString());
    TabGroupsManager.session.sessionStore.setTabValue(tab,"TabGroupsManagerGroupName",groupData.name);
    groupData.titleList+=tab.linkedBrowser.contentTitle+"\n";
    groupData.tabs.push(TabGroupsManager.session.getTabStateEx(tab));
    tab.group.removeTabWithoutClosedTabsList(tab);
  }
};
TabGroupsManager.GroupsStore.prototype.restoreGroup=function(groupId){
  var groupData=this.pop(groupId);
  if(groupData){
    var group=TabGroupsManager.allGroups.getGroupById(groupData.id);
    if(!group){
      group=TabGroupsManager.allGroups.openNewGroupCore(groupData.id,groupData.name,groupData.image);
    }else{
      TabGroupsManager.allGroups.beginUpdate();
      this.name=groupData.name;
      this.image=groupData.image;
      TabGroupsManager.allGroups.endUpdate();
    }
    group.setGroupDataWithAllTabs(groupData);
    if(this.saveWhenChangeing){
      TabGroupsManagerJsm.saveData.saveLatestData();
    }
  }
};
TabGroupsManager.GroupsStore.prototype.restoreGroupPart=function(groupId,tabObject){
  var groupData=this.peek(groupId);
  if(groupData){
    if(groupData.tabs.length<2){
      this.restoreGroup(groupId);
      return true;
    }else{
      var group=TabGroupsManager.allGroups.getGroupById(groupData.id);
      if(!group){
        group=TabGroupsManager.allGroups.openNewGroupCore(groupData.id,groupData.name,groupData.image);
      }else{
        TabGroupsManager.allGroups.beginUpdate();
        this.name=groupData.name;
        this.image=groupData.image;
        TabGroupsManager.allGroups.endUpdate();
      }
      group.setGroupDataWithAllTabs(groupData,tabObject);
      var splitTitleList=groupData.titleList.split(/\n/);
      for(var i=0;i<groupData.tabs.length;i++){
        if(groupData.tabs[i]==tabObject){
          groupData.tabs.splice(i,1);
          splitTitleList.splice(i,1);
          break;
        }
      }
      groupData.titleList=splitTitleList.join("\n");
      if(this.saveWhenChangeing){
        TabGroupsManagerJsm.saveData.saveLatestData();
      }
    }
  }
  return false;
};
TabGroupsManager.GroupsStore.prototype.restoreLatestGroup=function(){
  if(this.store.length>0){
    this.restoreGroup(this.store[0].id);
  }
};
TabGroupsManager.GroupsStore.prototype.setMaxLength=function(value){
  this.maxLength=value;
  this.storeLimitCheck();
  TabGroupsManagerJsm.saveData.saveLatestData();
};
TabGroupsManager.GroupsStore.prototype.clear=function(){
  this.store.splice(0,this.store.length);
  TabGroupsManagerJsm.saveData.saveLatestData();
};
TabGroupsManager.GroupsStore.prototype.createMenu=function(menuPopup){
  this.destroyMenu(menuPopup);
  let insertPosition=menuPopup.firstChild;
  for(let i=0;i<this.store.length;i++){
    var nowGroup=this.store[i];
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("value",nowGroup.id);
    menuitem.setAttribute("label",(nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"))+"("+nowGroup.tabs.length+")");
    menuitem.setAttribute("image",nowGroup.image);
    menuitem.className="menuitem-iconic menuitem-with-favicon";
    menuitem.setAttribute("validate","never");
    menuitem.setAttribute("tooltiptext",nowGroup.titleList);
    menuitem.setAttribute("context",this.menuitemContextMenu);
    menuitem.addEventListener("command",this.menuitemCommandEvent,false);
    menuitem.addEventListener("click",this.menuitemClickEvent,false);
    let start=new Date();
    menuPopup.insertBefore(menuitem,insertPosition);
    if((new Date()).getTime()-start.getTime()>3000){
      nowGroup.image="moz-anno:favicon:"+nowGroup.image;
      menuitem.setAttribute("image",nowGroup.image);
    }
  }
  if(this.store.length==0){
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("label",TabGroupsManager.strings.getString("MenuitemThereIsNoData"));
    menuitem.setAttribute("disabled",true);
    menuPopup.insertBefore(menuitem,insertPosition);
  }
};
TabGroupsManager.GroupsStore.prototype.destroyMenu=function(menuPopup){
  while(true){
    var menuitem=menuPopup.firstChild;
    if(!menuitem || menuitem.tagName=="menuseparator"){
      break;
    }
    menuitem.removeEventListener("command",this.menuitemCommandEvent,false);
    menuitem.removeEventListener("click",this.menuitemClickEvent,false);
    menuPopup.removeChild(menuitem);
  }
};
TabGroupsManager.GroupsStore.prototype.onMenuitemCommand=function(event){
  this.restoreGroup(event.originalTarget.getAttribute("value")-0);
};
TabGroupsManager.GroupsStore.prototype.onMenuitemClick=function(event){
  if(event.button==1){
    this.restoreGroup(event.target.getAttribute("value")-0);
    event.target.parentNode.removeChild(event.target);
  }
};
TabGroupsManager.GroupsStore.prototype.onShowingMenuitemContextMenu=function(event){
  var group=this.peek(document.popupNode.getAttribute("value")-0);
  if(!group ||!group.tabs)
    return;
  this.onHiddenMenuitemContextMenu(event);
  var flgmntNode=document.createDocumentFragment();
  for(var i=0;i<group.tabs.length;i++){
    var tabData=JSON.parse(group.tabs[i]);
    var title=null;
    try
    {
      title=(tabData.entries[tabData.index-1].title)?tabData.entries[tabData.index-1].title:"untitled";
    }
    catch(e){
      title="untitled";
    }
    var image=(tabData.attributes)?tabData.attributes.image:null;
    var menuitem=document.createElement("menuitem");
    menuitem.setAttribute("maxwidth","300");
    menuitem.setAttribute("label",title);
    menuitem.setAttribute("image",image);
    menuitem.setAttribute("class","menuitem-iconic");
    menuitem.setAttribute("validate","never");
    menuitem.addEventListener("command",this.contextCommandEvent,false);
    menuitem.addEventListener("click",this.contextClickEvent,false);
    menuitem.tabObject=group.tabs[i];
    flgmntNode.appendChild(menuitem);
  }
  TabGroupsManager.utils.insertElementAfterAnonid(event.target,null,flgmntNode);
};
TabGroupsManager.GroupsStore.prototype.onHiddenMenuitemContextMenu=function(event){
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.target,null,"end");
};
TabGroupsManager.GroupsStore.prototype.onContextMenuCommand=function(event){
  var groupId=document.popupNode.getAttribute("value")-0;
  var tabObject=event.target.tabObject;
  this.restoreGroupPart(groupId,tabObject);
};
TabGroupsManager.GroupsStore.prototype.onContextMenuClick=function(event){
  if(event.button==1){
    var groupId=document.popupNode.getAttribute("value")-0;
    var tabObject=event.target.tabObject;
    if(this.restoreGroupPart(groupId,tabObject)){
      event.target.parentNode.hidePopup();
      document.popupNode.parentNode.removeChild(document.popupNode);
    }else{
      event.target.parentNode.removeChild(event.target);
    }
  }
};
TabGroupsManager.GroupsStore.prototype.pop=function(groupId){
  for(var i=0;i<this.store.length;i++){
    if(this.store[i].id==groupId){
      var groupData=this.store[i];
      this.store.splice(i,1);
      return groupData;
    }
  }
  return null;
};
TabGroupsManager.GroupsStore.prototype.peek=function(groupId){
  for(var i=0;i<this.store.length;i++){
    if(this.store[i].id==groupId){
      return this.store[i];
    }
  }
  return null;
};
TabGroupsManager.GroupsStore.prototype.storeLimitCheck=function(){
  if(this.maxLength>=0){
    this.store.splice(this.maxLength);
  }
};
TabGroupsManager.GroupsStore.prototype.getGroupById=function(id){
  for(var i=0;i<this.store.length;i++){
    if(this.store[i].id==id){
      return this.store[i];
    }
  }
  return null;
};
TabGroupsManager.GroupsStore.prototype.bookmarkAllStoredGroup=function(parentFolder){
  for(var i=0;i<this.store.length;i++){
    var group=this.store[i];
    this.bookmarkOneGroup(group,group.name,parentFolder);
  }
};
TabGroupsManager.GroupsStore.prototype.setSleepGroupsImage=function(){
  var sleepButton=document.getElementById("TabGroupsManagerButtonSleep");
  if(sleepButton){
    sleepButton.setAttribute("storecount",this.store.length);
  }
};
TabGroupsManager.GroupsStore.prototype.sendToClosedGroup=function(event){
  var id=document.popupNode.getAttribute("value")-0;
  var group=TabGroupsManager.sleepingGroups.pop(id);
  TabGroupsManager.closedGroups.addGroup(group);
  TabGroupsManager.sleepingGroups.setSleepGroupsImage();
  TabGroupsManagerJsm.saveData.saveLatestData();
};
TabGroupsManager.GroupsStore.prototype.sendToClosedGroupClick=function(event){
  if(event.button==1){
    TabGroupsManager.sleepingGroups.sendToClosedGroup(event);
    document.getElementById("TabGroupsManagerSleepingGroupsMenuitemContextMenu").hidePopup();
    let menu2=document.getElementById("TabGroupsManagerSleepingGroupsButtonMenu");
    menu2.hidePopup();
    menu2.openPopup(document.getElementById("TabGroupsManagerButtonSleep"),"after_start",0,0,false,false);
  }
};
TabGroupsManager.GroupsStore.prototype.sendThisGroupToHibernatedGroup=function(){
  var id=document.popupNode.getAttribute("value")-0;
  var group=TabGroupsManager.closedGroups.pop(id);
  TabGroupsManager.sleepingGroups.addGroup(group);
  TabGroupsManager.sleepingGroups.setSleepGroupsImage();
  TabGroupsManagerJsm.saveData.saveLatestData();
};
TabGroupsManager.GroupsStore.prototype.deleteThisGroup=function(){
  var id=document.popupNode.getAttribute("value")-0;
  var group=TabGroupsManager.closedGroups.pop(id);
  TabGroupsManagerJsm.saveData.saveLatestData();
};
TabGroupsManager.GroupsStore.prototype.bookmarkSleepingGroup=function(){
  var id=document.popupNode.getAttribute("value")-0;
  var group=TabGroupsManager.sleepingGroups.peek(id);
  var folderName=window.prompt(TabGroupsManager.strings.getString("EnterBookmarkFolderName"),group.name);
  if(folderName){
    this.bookmarkOneGroup(group,folderName);
  }
};
TabGroupsManager.GroupsStore.prototype.renameStoredGroup=function(){
  var group=this.peek(document.popupNode.getAttribute("value")-0);
  let oldName=group.name;
  let oldIcon=group.image;
  let data={"name":oldName,"image":oldIcon};
  window.openDialog("chrome://tabgroupsmanager/content/GroupSettingsDialog.xul","TabGroupsManagerGroupSettingsDialog","chrome,modal,dialog,centerscreen,resizable",data);
  if(data.name!=null){
    group.name=data.name;
  }
  if(data.image!=null){
    group.image=data.image;
  }
};
TabGroupsManager.GroupsStore.prototype.bookmarkOneGroup=function(group,folderName,parentFolder){
  var places=Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
  if(!folderName){
    folderName="untitled";
  }
  if(!parentFolder){
    parentFolder=places.bookmarksMenuFolder;
  }
  var newFolderId=places.createFolder(parentFolder,folderName,places.DEFAULT_INDEX);
  if(group.tabs&&group.tabs.length){
    for(var i=0;i<group.tabs.length;i++){
      try
      {
        var tabData=JSON.parse(group.tabs[i]);
        var uri=TabGroupsManager.utils.createNewNsiUri(tabData.entries[tabData.index-1].url);
        var title=tabData.entries[tabData.index-1].title;
        places.insertBookmark(newFolderId,uri,places.DEFAULT_INDEX,title);
      }
      catch(e){
      }
    }
  }
};
TabGroupsManager.TabOpenStatus=function(){
  try
  {
    this.colorArray=["Orange","Lavenderblush","aqua","PeachPuff","yellow","lime","Gold","white","Turquoise","DarkKhaki","SandyBrown","DarkTurquoise","Khaki","BurlyWood","LemonChiffon","GreenYellow","SpringGreen","Aquamarine","Pink","Lavender"];
    this.colorIndex=-1;
    this.openerDOMWindow=null;
    this.openerTab=null;
    this.openerContext=null;
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.TabOpenStatus.prototype.getColor=function(){
  this.colorIndex=(this.colorIndex+1)% this.colorArray.length;
  return this.colorArray[this.colorIndex];
};
TabGroupsManager.TabOpenStatus.prototype.clearOpenerData=function(){
  this.openerDOMWindow=null;
  this.openerContext=null;
  this.openerTab=null;
};
TabGroupsManager.TabOpenStatus.prototype.setOpenerData=function(aOpener,aContext){
  this.openerDOMWindow=aOpener;
  this.openerContext=aContext;
  this.openerTab=TabGroupsManager.utils.getTabFromDOMWindow(aOpener);
};
TabGroupsManager.TabTree=function(aOwner){
  try
  {
    this.owner=aOwner;
    this.parentTab=null;
    this.childTabs=null;
    this.__defineGetter__("outerBackgroundColor",this.getOuterBackgroundColor);
    this.__defineSetter__("outerBackgroundColor",this.setOuterBackgroundColor);
    this.__defineGetter__("innerBackgroundColor",this.getInnerBackgroundColor);
    this.__defineSetter__("innerBackgroundColor",this.setInnerBackgroundColor);
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.TabTree.prototype.getOuterBackgroundColor=function(){
  return this.owner.style.backgroundColor;
};
TabGroupsManager.TabTree.prototype.setOuterBackgroundColor=function(value){
  this.owner.style.backgroundImage="none";
  this.owner.style.backgroundColor=value;
};
TabGroupsManager.TabTree.prototype.getInnerBackgroundColor=function(){
  var tmp=document.getAnonymousElementByAttribute(this.owner,"class","tab-text");
  if(!tmp){
    tmp=document.getAnonymousElementByAttribute(this.owner,"class","tab-text tab-label");
  }
  return tmp.style.backgroundColor;
};
TabGroupsManager.TabTree.prototype.setInnerBackgroundColor=function(value){
  var tmp=document.getAnonymousElementByAttribute(this.owner,"class","tab-text");
  if(!tmp){
    tmp=document.getAnonymousElementByAttribute(this.owner,"class","tab-text tab-label");
  }
  tmp.style.backgroundColor=value;
};
TabGroupsManager.TabTree.prototype.addTabToTree=function(tab,insertIndex){
  if(!this.childTabs){
    this.childTabs=new Array();
  }
  if(this.childTabs.length==0){
    if(insertIndex==null){
      TabGroupsManager.tabMoveByTGM.moveTabTo(tab,this.owner._tPos+1);
    }
    if(TabGroupsManager.preferences.tabTreeDisplayParentAndChild&&this.innerBackgroundColor==""){
      this.innerBackgroundColor=TabGroupsManager.tabOpenStatus.getColor();
    }
  }else{
    if(insertIndex==null){
      var lastTab=this.searchLastTabInTabToTree(this.childTabs[this.childTabs.length-1]);
      TabGroupsManager.tabMoveByTGM.moveTabTo(tab,lastTab._tPos+1);
    }
  }
  if(insertIndex!=null){
    this.childTabs.splice(insertIndex,0,tab);
  }else{
    this.childTabs.push(tab);
  }
  tab.tabGroupsManagerTabTree=new TabGroupsManager.TabTree(tab);
  tab.tabGroupsManagerTabTree.parentTab=this.owner;
  if(TabGroupsManager.preferences.tabTreeDisplayParentAndChild){
    tab.tabGroupsManagerTabTree.outerBackgroundColor=this.innerBackgroundColor;
  }
};
TabGroupsManager.TabTree.prototype.searchLastTabInTabToTree=function(tab){
  var tabTree=tab.tabGroupsManagerTabTree;
  if(tabTree&&tabTree.childTabs){
    return tabTree.searchLastTabInTabToTree(tabTree.childTabs[tabTree.childTabs.length-1]);
  }else{
    return tab;
  }
};
TabGroupsManager.TabTree.prototype.removeTabFromTree=function(tabClose){
  try
  {
    let tab=this.owner;
    let closingSelectedTab=(tabClose&&tab==gBrowser.selectedTab)?tab:null;
    let newTargetTab=null;
    if(this.childTabs&&this.childTabs.length>0){
      newTargetTab=this.childTabs[0];
      newTargetTab.tabGroupsManagerTabTree.outerBackgroundColor=this.outerBackgroundColor;
      newTargetTab.tabGroupsManagerTabTree.innerBackgroundColor=this.innerBackgroundColor;
      if(TabGroupsManager.preferences.tabTreeFocusTabByParentAndChild&&closingSelectedTab==gBrowser.selectedTab){
        gBrowser.selectedTab=newTargetTab;
      }
    }
    if(this.parentTab&&this.parentTab.tabGroupsManagerTabTree){
      let childTabs=this.parentTab.tabGroupsManagerTabTree.childTabs;
      if(childTabs){
        for(let i=0;i<childTabs.length;i++){
          if(childTabs[i]==tab){
            childTabs.splice(i,1);
            if(newTargetTab){
              this.parentTab.tabGroupsManagerTabTree.addTabToTree(newTargetTab,i);
            }
            if(TabGroupsManager.preferences.tabTreeFocusTabByParentAndChild&&closingSelectedTab==gBrowser.selectedTab&&childTabs.length>0){
              gBrowser.selectedTab=(i<childTabs.length)?childTabs[i]:childTabs[i-1];
            }
          }
        }
        if(childTabs.length==0){
          if(TabGroupsManager.preferences.tabTreeDisplayParentAndChild){
            this.parentTab.tabGroupsManagerTabTree.innerBackgroundColor="";
          }
          delete this.parentTab.tabGroupsManagerTabTree.childTabs;
          if(!this.parentTab.tabGroupsManagerTabTree.parentTab){
            delete this.parentTab.tabGroupsManagerTabTree;
          }
          if(TabGroupsManager.preferences.tabTreeFocusTabByParentAndChild&&closingSelectedTab==gBrowser.selectedTab){
            gBrowser.selectedTab=this.parentTab;
          }
        }
      }
    }
    if(newTargetTab){
      for(let i=1;i<this.childTabs.length;i++){
        newTargetTab.tabGroupsManagerTabTree.addTabToTree(this.childTabs[i]);
      }
      if(!newTargetTab.tabGroupsManagerTabTree.childTabs){
        newTargetTab.tabGroupsManagerTabTree.innerBackgroundColor="";
      }
      delete this.childTabs;
    }
    if(TabGroupsManager.preferences.tabTreeDisplayParentAndChild&&!tabClose){
      this.outerBackgroundColor="";
      this.innerBackgroundColor="";
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.TabTree.prototype.parentTabIsRemoved=function(){
  if(TabGroupsManager.preferences.tabTreeDisplayParentAndChild){
    this.outerBackgroundColor="";
  }
  this.parentTab=null;
  if(!this.childTabs){
    delete this.owner.tabGroupsManagerTabTree;
  }
};
TabGroupsManager.TabsInTitleBar=function(){
  document.documentElement.addEventListener("DOMAttrModified",this,false);
  document.getElementById("navigator-toolbox").addEventListener("DOMAttrModified",this,false);
  document.getElementById("navigator-toolbox").addEventListener("dblclick",this,true);
  document.getElementById("appmenu-button").addEventListener("dblclick",this,false);
  this.topToolBarBak=this.searchTopToolBar();
};
TabGroupsManager.TabsInTitleBar.prototype.handleEvent=function(event){
  switch(event.type){
    case"DOMAttrModified":this.onDOMAttrModified(event);break;
    case"dblclick":this.onDblClick(event);break;
  }
};
TabGroupsManager.TabsInTitleBar.prototype.onDOMAttrModified=function(event){
  switch(event.attrName){
    case"tabsintitlebar":
      if(event.currentTarget==document.documentElement){
        this.onTabsInTitleBarChanged(event);
      }
    break;
    case"ordinal":
    case"collapsed":
    case"autohide":
      if(event.currentTarget.id=="navigator-toolbox"&&event.target.tagName=="toolbar"){
        this.onToolBarOrderChanged();
      }
    break;
  }
};
TabGroupsManager.TabsInTitleBar.prototype.onDblClick=function(event){
  if(document.documentElement.getAttribute("tabsintitlebar")){
    if(event.currentTarget.id=="appmenu-button" || event.screenY==0){
      window.restore();
      event.stopPropagation();
      event.preventDefault();
    }
  }
};
TabGroupsManager.TabsInTitleBar.prototype.onToolBarOrderChanged=function(){
  let topToolBar=this.searchTopToolBar();
  if(topToolBar!=this.topToolBarBak){
    if(document.documentElement.getAttribute("tabsintitlebar")){
      if(topToolBar==TabGroupsManager.xulElements.tabBar){
        this.tabBarSpaceCollapse(false);
      }else{
        this.adjustToolBarSpace(topToolBar,true);
      }
      if(this.topToolBarBak==TabGroupsManager.xulElements.tabBar){
        this.tabBarSpaceCollapse(true);
      }else if(this.topToolBarBak){
        this.adjustToolBarSpace(this.topToolBarBak,false);
      }
    }
    this.topToolBarBak=topToolBar;
  }
};
TabGroupsManager.TabsInTitleBar.prototype.onTabsInTitleBarChanged=function(event){
  let topToolBar=this.searchTopToolBar();
  if(topToolBar.id!="TabsToolbar"){
    this.adjustTitleBarMargin(topToolBar,event.newValue);
    this.adjustToolBarSpace(topToolBar,event.newValue);
    this.tabBarSpaceCollapse(event.newValue);
  }
  this.topToolBarBak=topToolBar;
};
TabGroupsManager.TabsInTitleBar.prototype.searchTopToolBar=function(){
  let toolBox=document.getElementById("navigator-toolbox");
  let topToolBar=null;
  let minY=9999;
  for(let i=0;i<toolBox.childNodes.length;i++){
    if(toolBox.childNodes[i].tagName=="toolbar"){
      let box=toolBox.childNodes[i].boxObject;
      if(box.height>0&&box.y<minY){
        minY=box.y;
        topToolBar=toolBox.childNodes[i];
      }
    }
  }
  return topToolBar;
};
TabGroupsManager.TabsInTitleBar.prototype.tabBarSpaceCollapse=function(flag){
  let tabsToolBar=TabGroupsManager.xulElements.tabBar;
  for(let i=0;i<tabsToolBar.childNodes.length;i++){
    let item=tabsToolBar.childNodes[i];
    if(item.tagName=="hbox"){
      let type=item.getAttribute("type");
      if(type=="appmenu-button" || type=="caption-buttons"){
        TabGroupsManager.utils.setRemoveAttribute(item,"collapsed",flag);
      }
    }
  }
  if(flag){
    tabsToolBar.style.backgroundImage="none";
  }else{
    tabsToolBar.style.backgroundImage="";
  }
};
TabGroupsManager.TabsInTitleBar.prototype.adjustTitleBarMargin=function(topToolBar,flag){
  let titleBar=document.getElementById("titlebar");
  titleBar.style.marginBottom="";
  if(flag){
    let titlebarTop=document.getElementById("titlebar-content").getBoundingClientRect().top;
    let topToolBarBox=topToolBar.getBoundingClientRect();
    titleBar.style.marginBottom=-Math.min(topToolBarBox.top-titlebarTop,topToolBarBox.height)+"px";
  }
};
TabGroupsManager.TabsInTitleBar.prototype.adjustToolBarSpace=function(toolBar,flag){
  if(flag){
    toolBar.style.paddingLeft=document.getElementById("appmenu-button-container").boxObject.width+"px";
    toolBar.style.paddingRight=document.getElementById("titlebar-buttonbox-container").boxObject.width+"px";
  }else{
    toolBar.style.paddingLeft="";
    toolBar.style.paddingRight="";
  }
};
TabGroupsManager.ForPanorama=function(){
  window.addEventListener("tabviewframeinitialized",this,false);
  window.addEventListener("tabviewhidden",this,false);
};
TabGroupsManager.ForPanorama.prototype.handleEvent=function(event){
  switch(event.type){
    case"tabviewframeinitialized":this.onTabViewFrameInitialized(event);break;
    case"tabviewhidden":this.onTabViewHidden(event);break;
  }
};
TabGroupsManager.ForPanorama.prototype.onTabViewFrameInitialized=function(event){
  TabView._window=TabView._window || TabView._iframe.contentWindow;
  TabGroupsManager.overrideMethod.overrideTabViewFunctions();
};
TabGroupsManager.ForPanorama.prototype.onTabViewShow=function(){
  try
  {
    let nonSuspendedGroups=TabGroupsManager.allGroups.makeNonSuspendedGroupsList();
    let panoramaGroups=TabView._window.GroupItems.groupItems.slice(0);
    for(let i=panoramaGroups.length-1;i>=0;i--){
      let index=nonSuspendedGroups.indexOf(panoramaGroups[i].TgmGroup);
      if(-1!=index){
        nonSuspendedGroups.splice(index,1);
        panoramaGroups.splice(i,1);
      }
    }
    for(let i=panoramaGroups.length;i<nonSuspendedGroups.length;i++){
      let box={left:i * 100,top:i * 100,width:300,height:200};
      panoramaGroups.push(new TabView._window.GroupItem([],{bounds:box,immediately:true}));
    }
    for(let i=panoramaGroups.length-1;i>=nonSuspendedGroups.length;i--){
      panoramaGroups[i].close();
    }
    for(let i=0;i<nonSuspendedGroups.length;i++){
      panoramaGroups[i].TgmGroup=nonSuspendedGroups[i];
    }
    for(let i=0;i<TabView._window.GroupItems.groupItems.length;i++){
      let panoramaGroup=TabView._window.GroupItems.groupItems[i];
      let group=panoramaGroup.TgmGroup;
      for(let j=0;j<group.tabArray.length;j++){
        this.moveTabToPanoramaGroup(group.tabArray[j],panoramaGroup);
      }
      panoramaGroup.setTitle(group.name);
      if(group.tabViewBounds){
        panoramaGroup.setBounds(group.tabViewBounds,true);
      }
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.ForPanorama.prototype.onTabViewHidden=function(event){
  try
  {
    let selectedTabBak=gBrowser.selectedTab;
    let nonSuspendedGroups=TabGroupsManager.allGroups.makeNonSuspendedGroupsList();
    let panoramaGroups=TabView._window.GroupItems.groupItems.slice(0);
    let panoramaOrphanedTabs=TabView._window.GroupItems.getOrphanedTabs?TabView._window.GroupItems.getOrphanedTabs():[];
    for(let i=panoramaGroups.length-1;i>=0;i--){
      let index=nonSuspendedGroups.indexOf(panoramaGroups[i].TgmGroup);
      if(-1!=index){
        nonSuspendedGroups.splice(index,1);
        panoramaGroups.splice(i,1);
      }
    }
    for(let i=nonSuspendedGroups.length;i<panoramaGroups.length+panoramaOrphanedTabs.length;i++){
      nonSuspendedGroups.push(TabGroupsManager.allGroups.openNewGroupCore());
    }
    let i=0;
    for(i=0;i<panoramaGroups.length;i++){
      panoramaGroups[i].TgmGroup=nonSuspendedGroups[i];
    }
    for(let j=0;j<panoramaOrphanedTabs.length;j++){
      panoramaOrphanedTabs[j].TgmGroup=nonSuspendedGroups[i+j];
    }
    for(let i=0;i<TabView._window.GroupItems.groupItems.length;i++){
      let panoramaGroup=TabView._window.GroupItems.groupItems[i];
      let group=panoramaGroup.TgmGroup;
      for(let j=0;j<panoramaGroup._children.length;j++){
        this.moveTabToGroup(panoramaGroup._children[j].tab,group);
      }
      group.name=panoramaGroup.getTitle();
      group.tabViewBounds={left:panoramaGroup.bounds.left,top:panoramaGroup.bounds.top,width:panoramaGroup.bounds.width,height:panoramaGroup.bounds.height};
    }
    for(let i=0;i<panoramaOrphanedTabs.length;i++){
      let orphanedTab=panoramaOrphanedTabs[i];
      let group=orphanedTab.TgmGroup;
      this.moveTabToGroup(orphanedTab.tab,group);
      group.autoRenameBak=null;
      group.autoRename(orphanedTab.tab.label);
      group.tabViewBounds={left:orphanedTab.bounds.left,top:orphanedTab.bounds.top,width:orphanedTab.bounds.width,height:orphanedTab.bounds.height};
    }
    nonSuspendedGroups=TabGroupsManager.allGroups.makeNonSuspendedGroupsList();
    for(let i=0;i<nonSuspendedGroups.length;i++){
      if(nonSuspendedGroups[i].tabArray.length==0){
        nonSuspendedGroups[i].close();
      }
    }
    gBrowser.selectedTab=selectedTabBak;
    TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.ForPanorama.prototype.moveTabToPanoramaGroup=function(tab,panoramaGroupItem){
  let tabItem=tab._tabViewTabItem;
  if(tabItem.parent){
    tabItem.parent.remove(tabItem,{dontClose:true,immediately:true});
  }
  panoramaGroupItem.add(tabItem,{immediately:true});
};
TabGroupsManager.ForPanorama.prototype.moveTabToGroup=function(tab,group){
  tab.group.removeTab(tab,undefined,true);
  group.addTab(tab);
};
TabGroupsManager.OverrideMethod=function(){
  try
  {
    var toolbox=document.getElementById("navigator-toolbox");
    toolbox.watch("customizing",this.toolboxCustomizeChange);
    if(!("tabBarWidthChange" in window)&&!("TabmixTabbar" in window)){
      var tabBar=TabGroupsManager.utils.getElementByIdAndAnonids("content","tabcontainer","arrowscrollbox");
      if(tabBar){
        tabBar.ensureElementIsVisible = tabBar.ensureElementIsVisible.toSource()
            .replace("element.getBoundingClientRect();","TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( element )");
        //eval("tabBar.ensureElementIsVisible = "+tabBar.ensureElementIsVisible.toSource()
        //  .replace("element.getBoundingClientRect();","TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( element );")
        //);

        tabBar._elementFromPoint = tabBar._elementFromPoint.toSource()
            .replace(/(elements\[[^\]]+\]|element)\.getBoundingClientRect\(\)/g,"TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( $1 )");
        //eval("tabBar._elementFromPoint = "+tabBar._elementFromPoint.toSource()
        //  .replace(/(elements\[[^\]]+\]|element)\.getBoundingClientRect\(\)/g,"TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( $1 )")
        //);
      }
    }
    if("TabmixSessionManager" in window){
      TabmixSessionManager.loadOneWindow = TabmixSessionManager.loadOneWindow.toSource()
          .replace("TabGroupsManagerJsm.applicationStatus.makeNewId()","group.id");
      //eval("TabmixSessionManager.loadOneWindow = "+TabmixSessionManager.loadOneWindow.toSource()
      //  .replace("TabGroupsManagerJsm.applicationStatus.makeNewId()","group.id")
      //);
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.OverrideMethod.prototype.delayOverride=function(){
  this.setOverride();
  if(TabGroupsManager.preferences.openNewGroupOperation){
    this.setOverrideForNewGroup();
  }
};
TabGroupsManager.OverrideMethod.prototype.setOverride=function(){
  if(gBrowser.tabContainer._handleTabDrag){
    this.bakup_handleTabDrag=gBrowser.tabContainer._handleTabDrag;
    this.bakup_handleTabDrop=gBrowser.tabContainer._handleTabDrop;
    gBrowser.tabContainer._handleTabDrag=this.override_handleTabDrag;
    gBrowser.tabContainer._handleTabDrop=this.override_handleTabDrop;
  }
  document.getElementById("TabGroupsManagerGroupBarScrollbox").scrollByIndex=this.arrowScrollBoxScrollByIndex;
  if(TabGroupsManager.preferences.tabTreeAnalysis){
    this.backup_window_handleLinkClick=window.handleLinkClick;
    window.handleLinkClick=this.override_window_handleLinkClick;
    this.backup_nsBrowserAccess_prototype_openURI=nsBrowserAccess.prototype.openURI;
    nsBrowserAccess.prototype.openURI=this.override_nsBrowserAccess_prototype_openURI;
  }
  this.backup_window_canQuitApplication=window.canQuitApplication;
  window.canQuitApplication=this.override_window_canQuitApplication;
  this.backup_WindowIsClosing=WindowIsClosing;
  window.WindowIsClosing=this.override_WindowIsClosing;
  this.backup_gBrowser_removeTab=gBrowser.removeTab;
  gBrowser.removeTab=this.override_gBrowser_removeTab;
  if("swapBrowsersAndCloseOther" in gBrowser){
    this.backup_gBrowser_swapBrowsersAndCloseOther=gBrowser.swapBrowsersAndCloseOther;
    gBrowser.swapBrowsersAndCloseOther=this.override_gBrowser_swapBrowsersAndCloseOther;
  }
  if("_beginRemoveTab" in gBrowser){
    this.backup_gBrowser__beginRemoveTab=gBrowser._beginRemoveTab;
    gBrowser._beginRemoveTab=this.override_gBrowser__beginRemoveTab;
  }
  if("_endRemoveTab" in gBrowser){
    this.backup_gBrowser__endRemoveTab=gBrowser._endRemoveTab;
    gBrowser._endRemoveTab=this.override_gBrowser__endRemoveTab;
  }
  if("TabView" in window){
    if(TabView._tabShowEventListener){
      gBrowser.tabContainer.removeEventListener("TabShow",TabView._tabShowEventListener,true);
    }
  }
};
TabGroupsManager.OverrideMethod.prototype.setOverrideForNewGroup=function(){
  this.backup_gBrowser_addTab=gBrowser.addTab;
  gBrowser.addTab=this.override_gBrowser_addTab;
  this.backup_gBrowser_loadOneTab=gBrowser.loadOneTab;
  gBrowser.loadOneTab=this.override_gBrowser_loadOneTab;
  this.backup_gBrowser_loadURI=gBrowser.loadURI;
  gBrowser.loadURI=this.override_gBrowser_loadURI;
  this.backup_gBrowser_loadURIWithFlags=gBrowser.loadURIWithFlags;
  gBrowser.loadURIWithFlags=this.override_gBrowser_loadURIWithFlags;
  this.backup_window_openUILinkIn=window.openUILinkIn;
  window.openUILinkIn=this.override_window_openUILinkIn;
  var searchBar=document.getElementById("searchbar");
  if(searchBar){
    this.backup_searchbar_handleSearchCommand=searchBar.handleSearchCommand;
    searchBar.handleSearchCommand=this.override_searchbar_handleSearchCommand;
  }
};
TabGroupsManager.OverrideMethod.prototype.parseReferrerURI=function(arg,aCharset,aPostData){
  if(arg.length==2&&typeof arg[1]=="object"&&!(arg[1]instanceof Ci.nsIURI)){
    aCharset=arg[1].charset;
    aPostData=arg[1].postData;
  }
  return[aCharset,aPostData];
};
TabGroupsManager.OverrideMethod.prototype.gBrowserAddTab=function(){
  if(this.backup_gBrowser_addTab){
    return this.backup_gBrowser_addTab.apply(gBrowser,arguments);
  }else{
    return gBrowser.addTab.apply(gBrowser,arguments);
  }
};
TabGroupsManager.OverrideMethod.prototype.override_handleTabDrag=function(event){
 var draggedTab=this.draggedTab;
 if(!draggedTab){
 return;
}
 if(event){
 draggedTab._dragData._savedEvent=event;
}else{
 event=draggedTab._dragData._savedEvent;
}
  let groupBarBox=TabGroupsManager.xulElements.groupBar.boxObject;
  let x1=groupBarBox.screenX;
  let y1=groupBarBox.screenY;
  let x2=x1+groupBarBox.width;
  let y2=y1+groupBarBox.height;
  if(x1<=event.screenX&&event.screenX<=x2&&y1<=event.screenY&&event.screenY<=y2){
    event.dataTransfer={};
    event.dataTransfer.types={};
    event.dataTransfer.types.contains=function(item){return item=="application/x-moz-tabbrowser-tab" || item=="text/x-moz-text-internal";};
    let parentChild=event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupTabs);
    if(parentChild==0 || parentChild==10){
      TabGroupsManager.groupDnDObserver.onDragOver(event,draggedTab);
    }else{
      TabGroupsManager.groupBarDnDObserver.onDragOver(event,draggedTab);
    }
    let dragPanel=this._tabDragPanel;
    if(!dragPanel.hidden){
      let width=dragPanel.clientWidth;
      let[left,top]=this._getAdjustedCoords(event.screenX,event.screenY,width,dragPanel.clientHeight,width/ 2,-12,true);
      dragPanel.moveTo(left,top);
    }
    return;
  }
  TabGroupsManager.groupDnDObserver.onDragLeave(event);
  TabGroupsManager.groupBarDnDObserver.onDragLeave(event);
  return TabGroupsManager.overrideMethod.bakup_handleTabDrag.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_handleTabDrop=function(event){
  let groupBarBox=TabGroupsManager.xulElements.groupBar.boxObject;
  let x1=groupBarBox.screenX;
  let y1=groupBarBox.screenY;
  let x2=x1+groupBarBox.width;
  let y2=y1+groupBarBox.height;
  if(x1<=event.screenX&&event.screenX<=x2&&y1<=event.screenY&&event.screenY<=y2){
    event.dataTransfer={};
    event.dataTransfer.types={};
    event.dataTransfer.types.contains=function(item){return item=="application/x-moz-tabbrowser-tab" || item=="text/x-moz-text-internal";};
    let parentChild=event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupTabs);
    if(parentChild==0 || parentChild==10){
      TabGroupsManager.groupDnDObserver.onDrop(event,this.draggedTab);
    }else{
      TabGroupsManager.groupBarDnDObserver.onDrop(event,this.draggedTab);
    }
    this._endTabDrag();
    return;
  }
  return TabGroupsManager.overrideMethod.bakup_handleTabDrop.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_TabView__window_UI_showTabView=function(zoomOut){
  TabGroupsManager.forPanorama.onTabViewShow();
  return TabGroupsManager.overrideMethod.backup_TabView__window_UI_showTabView.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.overrideTabViewFunctions=function(){
  TabView._window.GroupItems._updateTabBar=function(){};
  TabView._window.UI._removeTabActionHandlers();
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_open=TabView._window.UI._eventListeners.open;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_close=TabView._window.UI._eventListeners.close;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_move=TabView._window.UI._eventListeners.move;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_select=TabView._window.UI._eventListeners.select;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_pinned=TabView._window.UI._eventListeners.pinned;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_unpinned=TabView._window.UI._eventListeners.unpinned;
  TabView._window.UI._eventListeners.open=TabGroupsManager.overrideMethod.override_TabView__eventListeners_open;
  TabView._window.UI._eventListeners.close=TabGroupsManager.overrideMethod.override_TabView__eventListeners_close;
  TabView._window.UI._eventListeners.move=TabGroupsManager.overrideMethod.override_TabView__eventListeners_move;
  TabView._window.UI._eventListeners.select=TabGroupsManager.overrideMethod.override_TabView__eventListeners_select;
  TabView._window.UI._eventListeners.pinned=TabGroupsManager.overrideMethod.override_TabView__eventListeners_pinned;
  TabView._window.UI._eventListeners.unpinned=TabGroupsManager.overrideMethod.override_TabView__eventListeners_unpinned;
  for(let name in TabView._window.UI._eventListeners){
    TabView._window.AllTabs.register(name,TabView._window.UI._eventListeners[name]);
  }
  TabGroupsManager.overrideMethod.backup_TabView__window_UI_showTabView=TabView._window.UI.showTabView;
  TabView._window.UI.showTabView=TabGroupsManager.overrideMethod.override_TabView__window_UI_showTabView;
};
TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_open=function(tab){if(TabView._window.UI.isTabViewVisible()){TabGroupsManager.overrideMethod.backup_TabView__eventListeners_open.apply(this,arguments);}};
TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_close=function(tab){if(TabView._window.UI.isTabViewVisible()){TabGroupsManager.overrideMethod.backup_TabView__eventListeners_close.apply(this,arguments);}};
TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_move=function(tab){if(TabView._window.UI.isTabViewVisible()){TabGroupsManager.overrideMethod.backup_TabView__eventListeners_move.apply(this,arguments);}};
TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_select=function(tab){if(TabView._window.UI.isTabViewVisible()){TabGroupsManager.overrideMethod.backup_TabView__eventListeners_select.apply(this,arguments);}};
TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_pinned=function(tab){if(TabView._window.UI.isTabViewVisible()){TabGroupsManager.overrideMethod.backup_TabView__eventListeners_pinned.apply(this,arguments);}};
TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_unpinned=function(tab){if(TabView._window.UI.isTabViewVisible()){TabGroupsManager.overrideMethod.backup_TabView__eventListeners_unpinned.apply(this,arguments);}};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser__beginRemoveTab=function(aTab,aTabWillBeMoved,aCloseWindowWithLastTab,aCloseWindowFastpath){
 if(1==(this.mTabs.length-this._removingTabs.length)){
    TabGroupsManager.allGroups.selectNextGroup();
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser__beginRemoveTab.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser__endRemoveTab=function(args){
  if(args._endRemoveArgs){
    args._endRemoveArgs[1]=false;
  }else{
    args[2]=false;
  }
  TabGroupsManager.overrideMethod.backup_gBrowser__endRemoveTab.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_window_canQuitApplication=function(){
  TabGroupsManagerJsm.quitApplicationObserver.inCanQuitApplication=true;
  let result=true;
  try
  {
    result=TabGroupsManager.overrideMethod.backup_window_canQuitApplication.apply(this,arguments);
    if(result){
      TabGroupsManagerJsm.quitApplicationObserver.afterQuitApplicationRequested();
    }
  }
  finally
  {
    delete TabGroupsManagerJsm.quitApplicationObserver.inCanQuitApplication;
  }
  return result
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser_swapBrowsersAndCloseOther=function(aOurTab,aOtherTab){
  let tabGroupsManagerBackupProgressListener=aOurTab.group.progressListener;
  try
  {
    aOurTab.linkedBrowser.removeProgressListener(tabGroupsManagerBackupProgressListener);
  }
  catch(e){
  }
  aOtherTab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag=true;
  try
  {
    TabGroupsManager.overrideMethod.backup_gBrowser_swapBrowsersAndCloseOther.apply(this,arguments);
    aOurTab.linkedBrowser.webProgress.addProgressListener(tabGroupsManagerBackupProgressListener,Ci.nsIWebProgress.NOTIFY_STATE_NETWORK);
  }
  finally
  {
    delete aOtherTab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag;
  }
};
TabGroupsManager.OverrideMethod.prototype.override_nsBrowserAccess_prototype_openURI=function(aURI,aOpener,aWhere,aContext){
  if(aContext!=Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL || aURI || aURI.schemeIs("chrome")){
    let whereTmp=(aWhere==Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW)?gPrefService.getIntPref("browser.link.open_newwindow"):aWhere;
    if(whereTmp==Ci.nsIBrowserDOMWindow.OPEN_NEWTAB){
      TabGroupsManager.tabOpenStatus.setOpenerData(aOpener,aContext);
    }
  }
  return TabGroupsManager.overrideMethod.backup_nsBrowserAccess_prototype_openURI.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_window_handleLinkClick=function(event,href,linkNode){
  if(event.button!=2){
    let where=whereToOpenLink(event);
    if(where!="current"&&where!="save"){
      TabGroupsManager.tabOpenStatus.setOpenerData(event.target.ownerDocument.defaultView,null);
  }
  }
 return TabGroupsManager.overrideMethod.backup_window_handleLinkClick.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_WindowIsClosing=function(){
  return TabGroupsManager.overrideMethod.backup_WindowIsClosing.apply(this,arguments)&&TabGroupsManager.overrideMethod.methodInWindowOnCloseForTGM();
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser_removeTab=function(aTab,aParams){
  if(!TabGroupsManager.overrideMethod.tabCloseDisableCheck(aTab)){
    TabGroupsManager.overrideMethod.backup_gBrowser_removeTab.apply(this,arguments);
  }
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser_addTab=function(aURI,aReferrerURI,aCharset,aPostData,aOwner,aAllowThirdPartyFixup){
  if(TabGroupsManager.preferences.openNewGroupByShift&&TabGroupsManager.keyboardState.shiftKey){
    let newTab=TabGroupsManager.overrideMethod.backup_gBrowser_addTab.apply(this,arguments);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_addTab.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser_loadOneTab=function(aURI,aReferrerURI,aCharset,aPostData,aLoadInBackground,aAllowThirdPartyFixup){
  if(TabGroupsManager.preferences.openNewGroupByShift&&TabGroupsManager.keyboardState.shiftKey){
    let newTab=TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this,aURI,aReferrerURI,aCharset,aPostData,undefined,aAllowThirdPartyFixup);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_loadOneTab.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser_loadURI=function(aURI,aReferrerURI,aCharset){
  if(TabGroupsManager.preferences.openNewGroupByShift&&TabGroupsManager.keyboardState.shiftKey){
    let newTab=TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this,aURI,aReferrerURI,aCharset);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_loadURI.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_gBrowser_loadURIWithFlags=function(aURI,aFlags,aReferrerURI,aCharset,aPostData){
  if(TabGroupsManager.preferences.openNewGroupByShift&&TabGroupsManager.keyboardState.shiftKey){
    let newTab=TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this,aURI,aReferrerURI,aCharset,aPostData);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_loadURIWithFlags.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_window_openUILinkIn=function(url,where,allowThirdPartyFixup,postData,referrerUrl){
  if(TabGroupsManager.preferences.openNewGroupByShift&&TabGroupsManager.keyboardState.shiftKey){
    let newTab=TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this,url,referrerUrl,undefined,postData);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_window_openUILinkIn.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.override_searchbar_handleSearchCommand=function(aEvent,aOverride){
  var engine=document.getElementById("searchbar").currentEngine;
  if(("getSecondSearch" in window)&&aOverride){
    var ss=window.getSecondSearch();
    engine=ss.selectedEngine || ss.getRecentEngines()[0];
    engine=ss.getSearchEngineFromName(engine.name);
  }
  TabGroupsManager.overrideMethod.backup_searchbar_handleSearchCommand.apply(this,arguments);
};
TabGroupsManager.OverrideMethod.prototype.tabCloseDisableCheck=function(aTab){
  try
  {
    if(!TabGroupsManagerJsm.privateBrowsing.enteringOrExiting
    &&aTab.group
    &&aTab.group.tabArray.length==1
    ){
      if(TabGroupsManager.preferences.groupNotCloseWhenCloseAllTabsInGroup){
        aTab.group.addTab(TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank"));
        return false;
      }else if(gBrowser.mTabContainer.childNodes.length==1){
        if(TabGroupsManager.allGroups.childNodes.length>1){
          TabGroupsManager.allGroups.selectNextGroup();
        }else{
          if(TabGroupsManagerJsm.applicationStatus.windows.length>1&&TabGroupsManagerJsm.globalPreferences.windowCloseWhenLastGroupClose){
            window.close();
          }else if(TabGroupsManager.utils.isBlankTab(aTab)){
            return true;
          }
        }
      }
    }
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return false;
};
TabGroupsManager.OverrideMethod.prototype.methodInWindowOnCloseForTGM=function(){
  if(TabGroupsManagerJsm.applicationStatus.windows.length<=1){
    TabGroupsManager.afterQuitApplicationRequested();
    return true;
  }
  if(TabGroupsManager.allGroups.childNodes.length==1&&gBrowser.mTabContainer.childNodes.length==1){
    return true;
  }
  TabGroupsManagerJsm.saveData.backupByWindowClose();
  switch(TabGroupsManager.preferences.processWhenWindowClose){
    case 0:
      if(TabGroupsManager.allGroups.listMoveGroup().length>0){
        var result=this.confirmWhenWindowClose();
        if(result==0){
          TabGroupsManager.allGroups.moveAllGroupsToMainWindow();
        }else{
          return(result==2);
        }
      }
    return true;
    case 1:
      TabGroupsManager.allGroups.moveAllGroupsToMainWindow();
    return true;
    case 2:return true;
  }
  return true;
};
TabGroupsManager.OverrideMethod.prototype.arrowScrollBoxScrollByIndex=function(index){
  index=index/ Math.abs(index)|| 0;
  this.scrollByPixels(index * 100);
};
TabGroupsManager.OverrideMethod.prototype.confirmWhenWindowClose=function(){
  var prompt=Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
  var title=TabGroupsManager.strings.getString("DialogTitle");
  var check={value:false};
  if("swapBrowsersAndCloseOther" in gBrowser){
    var flags=prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_YES+prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_CANCEL+prompt.BUTTON_POS_2 * prompt.BUTTON_TITLE_NO;
    var message=TabGroupsManager.strings.getString("ConfirmMessageWhenWindowClose");
    var checkMessage=TabGroupsManager.strings.getString("ConfirmCheckMessageWhenWindowClose");
    var result=prompt.confirmEx(null,title,message,flags,"","","",checkMessage,check);
    if(check.value&&result!=1){
      TabGroupsManager.preferences.prefBranch.setIntPref("processWhenWindowClose",(result==0)?1:2);
    }
    return result;
  }else{
    var message=TabGroupsManager.strings.getString("ConfirmMessageWhenWindowClose30");
    var checkMessage=TabGroupsManager.strings.getString("ConfirmCheckMessageWhenWindowClose30");
    var result=prompt.confirmCheck(null,title,message,checkMessage,check);
    if(check.value&&result){
      TabGroupsManager.preferences.prefBranch.setIntPref("processWhenWindowClose",2);
    }
    return result?2:1;
  }
};
TabGroupsManager.OverrideMethod.prototype.getBoundingClientRectIfElementHidden=function(element){
  if(element.hidden){
    for(var newElement=element.nextSibling;newElement;newElement=newElement.nextSibling){
      if(!newElement.hidden){
        var rect=newElement.getBoundingClientRect();
        return{"left":rect.left,"right":rect.left};
      }
    }
    for(newElement=element.previousSibling;newElement;newElement=newElement.previousSibling){
      if(!newElement.hidden){
        var rect=newElement.getBoundingClientRect();
        return{"left":rect.right,"right":rect.right};
      }
    }
  }
  return element.getBoundingClientRect();
};
TabGroupsManager.OverrideMethod.prototype.toolboxCustomizeChange=function(id,oldval,newval){
  if(newval==false){
    try
    {
      TabGroupsManager.preferences.setButtonType("TabGroupsManagerButtonSleep",TabGroupsManager.preferences.buttonSleepLClick);
      TabGroupsManager.preferences.setButtonType("TabGroupsManagerButtonClose",TabGroupsManager.preferences.buttonCloseLClick);
      TabGroupsManager.preferences.setButtonType("TabGroupsManagerButtonOpen",TabGroupsManager.preferences.buttonOpenLClick);
      TabGroupsManager.sleepingGroups.setSleepGroupsImage();
    }
    catch(e){
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
  }
};
TabGroupsManager.OverrideOtherAddOns=function(){
  this.overrideTreeStyleTab();
};
TabGroupsManager.OverrideOtherAddOns.prototype.delayOverride=function(){
  try
  {
    this.overrideSessionManager();
  }
  catch(e){
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};
TabGroupsManager.OverrideOtherAddOns.prototype.overrideSessionManager=function(){
  if(("gSessionManager" in window)&&TabGroupsManager.preferences.prefBranch.getBoolPref("overrideSessionManagerRestoreSession")){
    this.backup_gSessionManager_restoreSession=window.gSessionManager.restoreSession;
    window.gSessionManager.restoreSession=this.override_gSessionManager_restoreSession;
  }
};
TabGroupsManager.OverrideOtherAddOns.prototype.override_gSessionManager_restoreSession=function(){
  TabGroupsManager.session.restoreSessionInit();
  TabGroupsManager.overrideOtherAddOns.backup_gSessionManager_restoreSession.apply(this,arguments);
};
TabGroupsManager.OverrideOtherAddOns.prototype.overrideTreeStyleTab=function(){
  if(("TreeStyleTabBrowser" in window)&&TabGroupsManager.preferences.prefBranch.getBoolPref("overrideTreeStyleTab")){
    this.backup_gSessionManager_attachTabFromPosition=window.TreeStyleTabBrowser.prototype.attachTabFromPosition;
    window.TreeStyleTabBrowser.prototype.attachTabFromPosition=this.override_gSessionManager_attachTabFromPosition;
  }
};
TabGroupsManager.OverrideOtherAddOns.prototype.override_gSessionManager_attachTabFromPosition=function(){
  if(!TabGroupsManager.tabMoveByTGM.cancelTabMoveEventOfTreeStyleTab&&TabGroupsManager.session.groupRestored>=2){
    TabGroupsManager.overrideOtherAddOns.backup_gSessionManager_attachTabFromPosition.apply(this,arguments);
  }
};
window.addEventListener("load",TabGroupsManager.onLoad,false);