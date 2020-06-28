/*jshint browser: true, devel: true */
/*eslint-env browser */
/* globals TabGroupsManagerJsm */

var Cc = Components.classes;
var Ci = Components.interfaces;
Components.utils.import("resource://tabgroupsmanager/modules/AxelUtils.jsm");
try
{
  Components.utils.import("resource://gre/modules/PlacesUtils.jsm");
}
catch (e)
{
  Components.utils.import("resource://gre/modules/utils.js");
}
var TabGroupsManager = {
  initialized: false,
  apiEnabled: false,
  contextTargetHref: null,

  //setup E10s message processing
  MESSAGES: ['sendToTGMChrome'],

  receiveMessage: function (msg)
  {
    if (msg.name != 'sendToTGMChrome') return;

    switch (msg.data.msgType)
    {
    case "linkTarget": // set our target in chrome code
      TabGroupsManager.contextTargetHref = msg.data.href;
      break;
    }
  }
};
//setup E10s message manager and framescript
TabGroupsManager.addFrameScript = function ()
{
  let mm = null;

  //use group mm browsers only for Fx > 32
  if (window.getGroupMessageManager) mm = window.getGroupMessageManager("browsers");
  else mm = window.messageManager;

  //enable delayed load for new tabs
  mm.loadFrameScript("chrome://tabgroupsmanager/content/TabGroupsManager-content.js", true);

  //setup chrome message listener
  for (let msg of this.MESSAGES)
  {
    mm.addMessageListener(msg, this.receiveMessage);
  }
};

TabGroupsManager.onLoad = function (event)
{
  window.removeEventListener("load", arguments.callee, false);
  if (document.getElementById("TabGroupsManagerToolbar"))
  {
    window.addEventListener("unload", TabGroupsManager.onUnload, false);
    TabGroupsManager.initialize();
  }
};

TabGroupsManager.onUnload = function (event)
{
  window.removeEventListener("unload", arguments.callee, false);
  TabGroupsManager.finalize();
};

TabGroupsManager.initialize = function (event)
{
  try
  {
    this.addFrameScript();
    this.lastId = 1;
    this.strings = document.getElementById("TabGroupsManagerStrings");
    Components.utils.import("resource://tabgroupsmanager/modules/TabGroupsManager.jsm");
    TabGroupsManagerJsm.applicationStatus.addWindow(window);
    this.xulElements = new this.XulElements;
    this.preferences = new this.Preferences();
    this.tabOpenStatus = new this.TabOpenStatus();
    this.keyboardState = new this.KeyboardState();
    this.eventListener = new this.EventListener();
    this.tabContextMenu = new this.TabContextMenu();
    var supportDnD = new this.SupportDnD();
    this.groupDnDObserver = new this.GroupDnDObserver(supportDnD);
    this.groupBarDnDObserver = new this.GroupBarDnDObserver(supportDnD);
    this.windowDnDObserver = new this.WindowDnDObserver(supportDnD);
    this.allGroups = new this.AllGroups();
    this.closedGroups = new this.GroupsStore(TabGroupsManagerJsm.saveData.getClosedGroups, this.preferences.maxClosedTabStoreCount, false, "TabGroupsManagerClosedGroupsMenuitemContextMenu");
    this.sleepingGroups = new this.GroupsStore(TabGroupsManagerJsm.saveData.getSleepingGroups, -1, true, "TabGroupsManagerSleepingGroupsMenuitemContextMenu");
    this.session = new this.Session();
    this.groupBarDispHide = new this.GroupBarDispHide();
    this.keyboardShortcut = new this.KeyboardShortcut();
    this.places = new this.Places();
    this.localGroupIcons = new this.LocalGroupIcons();
    this.toolMenu = new this.ToolMenu();
    this.groupMenu = new this.GroupMenu();
    if (!("toolbar_order" in window) && document.getElementById("appmenu-button"))
    {
      this.tabsInTitleBar = new this.TabsInTitleBar();
    }
    if ("TabView" in window)
    {
      this.forPanorama = new this.ForPanorama();
    }
    TabGroupsManager.sleepingGroups.setSleepGroupsImage();
    this.titleSplitRegExp = new RegExp(this.strings.getString("TitleSplitRegExp"), "i");
    var group = this.allGroups.openNewGroup(gBrowser.selectedTab, -1, this.strings.getString("StartGroupName"), null);
    for (var tab = gBrowser.mTabContainer.firstChild; tab; tab = tab.nextSibling)
    {
      this.allGroups.selectedGroup.addTab(tab, true);
    }
    this.eventListener.createEventListener();
    this.xulElements.groupBar.addEventListener("click", TabGroupsManager.utils.popupNotContextMenuOnRightClick, false);
    this.apiEnabled = true;
    this.overrideMethod = new this.OverrideMethod();
    this.overrideOtherAddOns = new this.OverrideOtherAddOns();
    if (("arguments" in window) && window.arguments.length > 2 && window.arguments[1] == "TabGroupsManagerNewWindowWithGroup")
    {
      var fromGroupTab = window.arguments[2];
      var isCopy = window.arguments[3];
      if (fromGroupTab.group)
      {
        var newGroup = this.allGroups.moveGroupToOtherWindow(fromGroupTab, null, isCopy);
        this.allGroups.selectedGroup = newGroup;
        group.close();
      }
    }
    //FIXME: this also seems screwy. why not load the groups up anyway?
    //we need this only on blank page on homepage startup - this will be called again later on session restore in mode 3
    //Startup seems to work as follows:
    //1) Blank session works same as select session. This ends up with getting
    //   things in completely the wrong place. I suspect what should be done is to
    //   save orphan tabs at the start of restore, not the end. or at least work them
    //   out from the groupSelecting
    //2) restore specified session seems to have the same problems. just more racily.
    if (TabGroupsManager.preferences.startupMode < 3) setTimeout(function ()
    {
      TabGroupsManager.initializeAfterOnLoad();
    }, 10);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.initializeAfterOnLoad = function ()
{
  //This check is because we call this from startup of in 'blank page' mode, and
  //from restore tab function otherwise. this seems ropy. Which makes the whole thing
  //very racy.
  if (this.initialized)
  {
    return;
  }
  this.initialized = true;
  //prepare promiseInitialized request
  //note that this looks racy to me as its waiting for promises to complete.
  var _this = this;
  var ss = Components.utils.import('resource:///modules/sessionstore/SessionStore.jsm');

  var tabmixSessionsManager = ("TMP_TabGroupsManager" in window) && TMP_TabGroupsManager.tabmixSessionsManager();
  const use_session_manager =
    TabGroupsManager.preferences.prefBranch.getBoolPref("useSessionManagerSessions");

  //Unfortunately session manager is bootstrappable and hence completely invisible,
  //so we have to have a preference for it :-(
  //FIXME Irrelevant. remove the whole thing.

  //2 5 1 4 6.
  //select gives 1
  //
  //This is a right mess. The restore groups happens in the background and it's
  //possible we could start restoring the session before these bits have finished
  if (TabGroupsManager.session.sessionRestoreManually ||
    (!tabmixSessionsManager /*&& !use_session_manager*/ ))
  {
    ss.SessionStore.promiseInitialized.then(function ()
    {
      /**/
      console.log("kick1")
      _this.session.restoreGroupsAndSleepingGroupsAndClosedGroups();
    });
  }

  /**/
  console.log("kick2");
  try
  {
    if (TabGroupsManagerJsm.globalPreferences.prefService.getBranch("extensions.tabmix.sessions.").getBoolPref("manager"))
    {
      try
      {
        /**/
        console.log("kick3");
        this.session.sessionStore.getWindowState(window);
      }
      catch (e)
      {
        this.session.sessionStore.init(window);
      }
    }
  }
  catch (e)
  {}
  this.tabContextMenu.makeMenu();
  ss.SessionStore.promiseInitialized.then(function ()
  {
    /**/
    console.log("kick4");
    _this.groupBarDispHide.firstStatusOfGroupBarDispHide();
  });
  /**/
  console.log("kick5");
  setTimeout(function ()
  {
    TabGroupsManager.onLoadDelay1000();
  }, 1000);
};

TabGroupsManager.onLoadDelay1000 = function ()
{
  /**/
  console.log("kick6")
  //this can take effect *after* the first session has been restored when you select
  //restore from specific session without prompting...
  TabGroupsManager.overrideMethod.delayOverride();
  TabGroupsManager.overrideOtherAddOns.delayOverride();
  if (("TMP_eventListener" in window) && !("TMP_TabGroupsManager" in window))
  {
    window.openDialog("chrome://tabgroupsmanager/content/versionAlertTMP.xul", "TabGroupsManagerVersionAlertTMP", "chrome,modal,dialog,centerscreen,resizable", TabGroupsManager.callbackOpenUriInSelectedTab);
  }
  //if you are manually restoring, this important bit doesn't happen.
  TabGroupsManager.allGroups.scrollInActiveGroup();
};

TabGroupsManager.callbackOpenUriInSelectedTab = function (uri)
{
  gBrowser.selectedTab = TabGroupsManager.overrideMethod.gBrowserAddTab(uri);
};

TabGroupsManager.finalize = function ()
{
  this.apiEnabled = false;
  TabGroupsManagerJsm.applicationStatus.removeWindow(window);
  for (var i = 0; i < TabGroupsManager.allGroups.childNodes.length; i++)
  {
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
  TabGroupsManagerJsm.applicationStatus.dateBackup = new Date;
};

TabGroupsManager.afterQuitApplicationRequested = function ()
{
  this.allGroups.readDummyBlankPage();
  if (TabGroupsManagerJsm.globalPreferences.suspendWhenFirefoxClose)
  {
    this.allGroups.suspendAllNonSelectedGroups();
  }
  this.allGroups.waitDummyBlankPage();
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  try
  {
    let modifyFlag = false;
    let windowState = JSON.parse(this.session.sessionStore.getWindowState(window));
    for (let i = 0; i < gBrowser.tabContainer.childNodes.length; i++)
    {
      let tab = gBrowser.tabContainer.childNodes[i];
      let extData = windowState.windows[0].tabs[i].extData;
      if (extData && extData.TabGroupsManagerGroupId != tab.group.id && tab.__SS_extdata)
      {
        modifyFlag = true;
        windowState.windows[0].tabs[i].extData = tab.__SS_extdata;
      }
    }
    if (modifyFlag)
    {
      this.session.sessionStore.setWindowState(window, JSON.stringify(windowState), true);
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

//------------------------------------------------------------------------------------

TabGroupsManager.utils = {
  nsIIOService: Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
};

//add result and rename tmp to result because tmp will be 0 if nothing is found
//id is content and arguments are content, tabbrowser, arrowscrollbox
//it seems that from getAnonymousElementByAttribute() nothing will be found here
TabGroupsManager.utils.getElementByIdAndAnonids = function (id)
{
  var result;
  var tmp = document.getElementById(id);
  for (var i = 1; i < arguments.length; i++)
  {
    result = document.getAnonymousElementByAttribute(tmp, "anonid", arguments[i]);
  }
  return result;
};

TabGroupsManager.utils.getElementByElementAndAnonids = function (element)
{
  var tmp = element;
  for (var i = 1; i < arguments.length; i++)
  {
    tmp = document.getAnonymousElementByAttribute(tmp, "anonid", arguments[i]);
  }
  return tmp;
};

TabGroupsManager.utils.isBlankTab = function (tab)
{
  if (tab.linkedBrowser.currentURI.spec == "about:blank" && !tab.hasAttribute("busy"))
  {
    try
    {
      var tabData = JSON.parse(TabGroupsManager.session.getTabStateEx(tab));
      if (tabData.entries.length == 0 || tabData.entries[0].url == "about:blank")
      {
        return true;
      }
    }
    catch (e)
    {
      return true;
    }
  }
  return false;
};

TabGroupsManager.utils.insertElementAfterAnonid = function (parent, anonid, element)
{
  if (!anonid)
  {
    parent.insertBefore(element, parent.childNodes[0]);
    return;
  }
  for (var i = 0; i < parent.childNodes.length; i++)
  {
    if (parent.childNodes[i].getAttribute("anonid") == anonid)
    {
      parent.insertBefore(element, parent.childNodes[i + 1]);
      return;
    }
  }
  parent.insertBefore(element, null);
};

TabGroupsManager.utils.deleteFromAnonidToAnonid = function (parent, from, to)
{
  var element = parent.firstChild;
  if (from)
  {
    element = parent.firstChild;
    for (; element && element.getAttribute("anonid") != from; element = element.nextSibling);
    element = element.nextSibling;
  }
  while (element && (!to || element.getAttribute("anonid") != to))
  {
    var nextElement = element.nextSibling;
    parent.removeChild(element);
    element = nextElement;
  }
};

TabGroupsManager.utils.popupNotContextMenuOnRightClick = function (event)
{
  if (event.button == 2)
  {
    var element = event.currentTarget;
    if (element.hasAttribute("context"))
    {
      element.contextBak = element.getAttribute("context");
      element.removeAttribute("context");
    }
    if (element.contextBak)
    {
      for (var tmp = event.target; tmp && tmp.getAttribute; tmp = tmp.parentNode)
      {
        var context = tmp.getAttribute("context") || tmp.contextBak;
        if (context)
        {
          if (context == element.contextBak)
          {
            document.getElementById(element.contextBak).openPopup(null, null, event.clientX, event.clientY, false, true);
          }
          return;
        }
      }
    }
  }
};

TabGroupsManager.utils.createNewNsiUri = function (aSpec)
{
  return this.nsIIOService.newURI(aSpec, null, null);
};

TabGroupsManager.utils.getTabFromDOMWindow = function (DOMWindow)
{
  try
  {
    if (DOMWindow)
    {
      let index = gBrowser.getBrowserIndexForDocument(DOMWindow.top.document);
      return (index != -1) ? gBrowser.tabContainer.childNodes[index] : null;
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return null;
};

TabGroupsManager.utils.setRemoveAttribute = function (element, key, value)
{
  if (value)
  {
    element.setAttribute(key, value);
  }
  else
  {
    element.removeAttribute(key);
  }
};

TabGroupsManager.utils.traceProperty = function (root)
{
  let target = root;
  for (let i = 1; i < arguments.length && target; i++)
  {
    target = target[arguments[i]];
  }
  return target;
};

TabGroupsManager.utils.hideTab = function (tab)
{
  if (('undefined' !== typeof tab) && (tab))
  {
    tab.setAttribute("hidden", "true");
    gBrowser._visibleTabs = null; // invalidate cache
    gBrowser.hideTab(tab);
  }
};

TabGroupsManager.utils.unHideTab = function (tab)
{
  if (('undefined' !== typeof tab) && (tab))
  {
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
TabGroupsManager.utils.dataTransferTypesContains = function (eventDataTransfer, needle)
{
  let result = false;
  if (('undefined' !== typeof eventDataTransfer) && (eventDataTransfer))
  {
    var dataTransferTypes = eventDataTransfer.mozTypesAt(0);
    if ((dataTransferTypes.length > 0) && (dataTransferTypes.contains(needle)))
    {
      result = true;
    }
  }
  return result;
};

TabGroupsManager.tabMoveByTGM = {
  tabMovingByTGM: false,

  cancelTabMoveEventOfTreeStyleTab: false,

  moveTabTo: function (tab, to)
  {
    this.tabMovingByTGM = true;
    var backupNextTabOfTMP = gBrowser.mTabContainer.nextTab;
    try
    {
      gBrowser.moveTabTo(tab, to);
    }
    finally
    {
      this.tabMovingByTGM = false;
      if (backupNextTabOfTMP)
      {
        gBrowser.mTabContainer.nextTab = backupNextTabOfTMP;
      }
    }
  },

  moveTabToWithoutTST: function (tab, to)
  {
    if ("treeStyleTab" in gBrowser)
    {
      gBrowser.treeStyleTab.partTab(tab);
    }
    this.cancelTabMoveEventOfTreeStyleTab = true;
    try
    {
      this.moveTabTo(tab, to);
    }
    finally
    {
      this.cancelTabMoveEventOfTreeStyleTab = false;
    }
  }
};

//------------------------------------------------------------------------------------

TabGroupsManager.XulElements = function ()
{
  this.groupBar = document.getElementById("TabGroupsManagerToolbar");
  this.groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  this.tabBar = document.getElementById("TabsToolbar");
  if (!this.tabBar)
  {
    this.tabBar = TabGroupsManager.utils.getElementByIdAndAnonids("content", "strip");
  }
};

//------------------------------------------------------------------------------------

TabGroupsManager.Preferences = function ()
{
  try
  {
    this.isMac = navigator.platform.match(/mac/i);
    this.firefoxAppInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
    this.versionComparator = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
    this.prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
    this.prefRoot = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
    this.prefBranch = this.prefService.getBranch("extensions.tabgroupsmanager.");
    this.prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    this.prefBranch.addObserver("", this, false);
    this.hideGroupBarByContentClick = this.prefBranch.getBoolPref("hideGroupBarByContentClick");
    this.groupBarSmoothScroll = this.prefBranch.getBoolPref("groupBarSmoothScroll");
    this.hideGroupBarByMouseover = this.prefBranch.getBoolPref("hideGroupBarByMouseover");
    this.hideGroupBarByMouseout = this.prefBranch.getBoolPref("hideGroupBarByMouseout");
    this.hideGroupBarByMouseoutTimer = this.prefBranch.getIntPref("hideGroupBarByMouseoutTimer");
    this.hideGroupBarByTabGroupCount = this.prefBranch.getIntPref("hideGroupBarByTabGroupCount");
    this.groupBarPosition = this.prefBranch.getIntPref("groupBarPosition");
    this.groupBarOrdinal = this.prefBranch.getIntPref("groupBarOrdinal");
    this.tabBarOrdinal = this.prefBranch.getIntPref("tabBarOrdinal");
    this.dispGroupTabIcon = this.prefBranch.getBoolPref("dispGroupTabIcon");
    this.observe(null, "nsPref:changed", "dispGroupTabIconReading");
    this.dispGroupTabCount = this.prefBranch.getBoolPref("dispGroupTabCount");
    this.dispGroupTabCountReading = this.prefBranch.getBoolPref("dispGroupTabCountReading");
    this.groupTabMinWidth = this.prefBranch.getIntPref("groupTabMinWidth");
    this.groupTabMaxWidth = this.prefBranch.getIntPref("groupTabMaxWidth");
    this.reduceSuspendGroup = this.prefBranch.getBoolPref("reduceSuspendGroup");
    this.groupTabCrop = this.prefBranch.getIntPref("groupTabCrop");
    document.getElementById("TabGroupsManagerGroupBarScrollbox").smoothScroll = this.groupBarSmoothScroll;
    switch (this.groupBarPosition)
    {
    case 2:
      document.getElementById("appcontent").insertBefore(TabGroupsManager.xulElements.groupBar, document.getElementById("content").nextSibling);
      break;
    }
    if (!("toolbar_order" in window))
    {
      TabGroupsManager.xulElements.groupBar.setAttribute("ordinal", this.groupBarOrdinal);
      let tabBar = document.getElementById("TabsToolbar");
      if (tabBar)
      {
        tabBar.setAttribute("ordinal", this.tabBarOrdinal);
      }
    }
    this.observe(null, "nsPref:changed", "normalGroupStyle");
    this.observe(null, "nsPref:changed", "selectedGroupStyle");
    this.observe(null, "nsPref:changed", "unreadGroupStyle");
    this.observe(null, "nsPref:changed", "suspendedGroupStyle");
    this.groupMClick = this.prefBranch.getIntPref("groupMClick");
    this.groupDblClick = this.prefBranch.getIntPref("groupDblClick");
    this.groupDblRClick = this.prefBranch.getIntPref("groupDblRClick");
    this.groupBarLClick = this.prefBranch.getIntPref("groupBarLClick");
    this.groupBarMClick = this.prefBranch.getIntPref("groupBarMClick");
    this.groupBarDblClick = this.prefBranch.getIntPref("groupBarDblClick");
    this.buttonOpenLClick = this.prefBranch.getIntPref("buttonOpenLClick");
    this.buttonOpenMClick = this.prefBranch.getIntPref("buttonOpenMClick");
    this.buttonOpenDblClick = this.prefBranch.getIntPref("buttonOpenDblClick");
    this.buttonSleepLClick = this.prefBranch.getIntPref("buttonSleepLClick");
    this.buttonSleepMClick = this.prefBranch.getIntPref("buttonSleepMClick");
    this.buttonSleepDblClick = this.prefBranch.getIntPref("buttonSleepDblClick");
    this.buttonCloseLClick = this.prefBranch.getIntPref("buttonCloseLClick");
    this.buttonCloseMClick = this.prefBranch.getIntPref("buttonCloseMClick");
    this.buttonCloseDblClick = this.prefBranch.getIntPref("buttonCloseDblClick");
    this.buttonDispMClick = this.prefBranch.getIntPref("buttonDispMClick");
    this.setButtonType("TabGroupsManagerButtonSleep", this.buttonSleepLClick);
    this.setButtonType("TabGroupsManagerButtonClose", this.buttonCloseLClick);
    this.setButtonType("TabGroupsManagerButtonOpen", this.buttonOpenLClick);
    this.keyBindJson = this.prefBranch.getCharPref("keyBindJson");
    this.keyBindOverride = this.prefBranch.getBoolPref("keyBindOverride");
    this.ctrlTab = this.prefBranch.getIntPref("ctrlTab");
    this.openNewGroupOperation = this.prefBranch.getBoolPref("openNewGroupOperation");
    this.openNewGroupByShift = this.prefBranch.getBoolPref("openNewGroupByShift");
    this.observe(null, "nsPref:changed", "groupMenuOpen");
    this.observe(null, "nsPref:changed", "groupMenuOpenActive");
    this.observe(null, "nsPref:changed", "groupMenuOpenRename");
    this.observe(null, "nsPref:changed", "groupMenuOpenActiveRename");
    this.observe(null, "nsPref:changed", "groupMenuOpenWithHome");
    this.observe(null, "nsPref:changed", "groupMenuOpenActiveWithHome");
    this.observe(null, "nsPref:changed", "groupMenuOpenByRenameHistory");
    this.observe(null, "nsPref:changed", "groupMenuSleepActiveGroup");
    this.observe(null, "nsPref:changed", "groupMenuCloseActiveGroup");
    this.observe(null, "nsPref:changed", "groupMenuSleepingGroups");
    this.observe(null, "nsPref:changed", "groupMenuClosedGroups");
    this.observe(null, "nsPref:changed", "groupMenuBookmarkAllGroups");
    this.observe(null, "nsPref:changed", "groupMenuBackupSession");
    this.tabMenuSendToOtherGroup = this.prefBranch.getBoolPref("tabMenuSendToOtherGroup");
    this.tabMenuCloseOtherTabInGroup = this.prefBranch.getBoolPref("tabMenuCloseOtherTabInGroup");
    this.tabMenuCloseLeftTabInGroup = this.prefBranch.getBoolPref("tabMenuCloseLeftTabInGroup");
    this.tabMenuSelectLeftTabInGroup = this.prefBranch.getBoolPref("tabMenuSelectLeftTabInGroup");
    this.tabMenuCloseRightTabInGroup = this.prefBranch.getBoolPref("tabMenuCloseRightTabInGroup");
    this.tabMenuSelectRightTabInGroup = this.prefBranch.getBoolPref("tabMenuSelectRightTabInGroup");
    this.groupRestoreOldPosition = this.prefBranch.getBoolPref("groupRestoreOldPosition");
    this.maxClosedTabStoreCount = this.prefBranch.getIntPref("maxClosedTabStoreCount");
    this.autoRenameDisableTime = this.prefBranch.getIntPref("autoRenameDisableTime");
    this.focusTabWhenActiveTabClosed = this.prefBranch.getIntPref("focusTabWhenActiveTabClosed");
    this.groupNotCloseWhenCloseAllTabsInGroup = this.prefBranch.getBoolPref("groupNotCloseWhenCloseAllTabsInGroup");
    this.processWhenWindowClose = this.prefBranch.getIntPref("processWhenWindowClose");
    this.tabTreeAnalysis = this.prefBranch.getBoolPref("tabTreeAnalysis");
    this.tabTreeOpenTabByExternalApplication = this.prefBranch.getBoolPref("tabTreeOpenTabByExternalApplication");
    this.tabTreeOpenTabByJavaScript = this.prefBranch.getBoolPref("tabTreeOpenTabByJavaScript");
    this.tabTreeRecordParentAndChild = this.prefBranch.getBoolPref("tabTreeRecordParentAndChild");
    this.tabTreeDisplayParentAndChild = this.prefBranch.getBoolPref("tabTreeDisplayParentAndChild");
    this.tabTreeFocusTabByParentAndChild = this.prefBranch.getBoolPref("tabTreeFocusTabByParentAndChild");
    if (this.tabTreeOpenTabByJavaScript)
    {
      this.prefRoot.setBoolPref("browser.tabs.insertRelatedAfterCurrent", false);
    }
    //I do not think we need this vvvvv as far as I can tell, the test it is used
    //for is spurious.
    this.startupMode = this.prefRoot.getIntPref("browser.startup.page");
    this.debug = this.prefBranch.getBoolPref("debug");
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Preferences.prototype.destructor = function ()
{
  if (this.prefBranch)
  {
    this.prefBranch.removeObserver("", this);
  }
};

TabGroupsManager.Preferences.prototype.observe = function (aSubject, aTopic, aData)
{
  if (aTopic != "nsPref:changed")
  {
    return;
  }
  switch (aData)
  {
  case "groupBarSmoothScroll":
    this.groupBarSmoothScroll = this.prefBranch.getBoolPref("groupBarSmoothScroll");
    document.getElementById("TabGroupsManagerGroupBarScrollbox").smoothScroll = this.groupBarSmoothScroll;
    break;
  case "hideGroupBarByContentClick":
    this.hideGroupBarByContentClick = this.prefBranch.getBoolPref("hideGroupBarByContentClick");
    if (this.hideGroupBarByContentClick)
    {
      TabGroupsManager.groupBarDispHide.setContentClickEvent();
    }
    else
    {
      TabGroupsManager.groupBarDispHide.removeContentClickEvent();
    }
    break;
  case "hideGroupBarByMouseover":
    this.hideGroupBarByMouseover = this.prefBranch.getBoolPref("hideGroupBarByMouseover");
    if (this.hideGroupBarByMouseover)
    {
      TabGroupsManager.groupBarDispHide.setMouseoverEvent();
    }
    else
    {
      TabGroupsManager.groupBarDispHide.removeMouseoverEvent();
      TabGroupsManager.groupBarDispHide.dispGroupBar = true;
    }
    break;
  case "hideGroupBarByMouseout":
    this.hideGroupBarByMouseout = this.prefBranch.getBoolPref("hideGroupBarByMouseout");
    if (this.hideGroupBarByMouseout)
    {
      TabGroupsManager.groupBarDispHide.setMouseoutEvent();
      TabGroupsManager.groupBarDispHide.dispGroupBar = false;
    }
    else
    {
      TabGroupsManager.groupBarDispHide.removeMouseoutEvent();
      TabGroupsManager.groupBarDispHide.dispGroupBar = true;
    }
    break;
  case "hideGroupBarByMouseoutTimer":
    this.hideGroupBarByMouseoutTimer = this.prefBranch.getIntPref("hideGroupBarByMouseoutTimer");
    break;
  case "groupBarOrdinal":
    this.groupBarOrdinal = this.prefBranch.getIntPref("groupBarOrdinal");
    if (!("toolbar_order" in window))
    {
      TabGroupsManager.xulElements.groupBar.setAttribute("ordinal", this.groupBarOrdinal);
    }
    break;
  case "tabBarOrdinal":
    this.tabBarOrdinal = this.prefBranch.getIntPref("tabBarOrdinal");
    if (!("toolbar_order" in window))
    {
      let tabBar = document.getElementById("TabsToolbar");
      if (tabBar)
      {
        tabBar.setAttribute("ordinal", this.tabBarOrdinal);
      }
    }
    break;
  case "hideGroupBarByTabGroupCount":
    this.hideGroupBarByTabGroupCount = this.prefBranch.getIntPref("hideGroupBarByTabGroupCount");
    TabGroupsManager.groupBarDispHide.dispGroupBar = true;
    TabGroupsManager.xulElements.tabBar.removeAttribute("collapsed");
    TabGroupsManager.groupBarDispHide.hideGroupBarByGroupCount();
    TabGroupsManager.groupBarDispHide.hideGroupBarByTabCount();
    break;
  case "dispGroupTabIcon":
    this.dispGroupTabIcon = this.prefBranch.getBoolPref("dispGroupTabIcon");
    TabGroupsManager.allGroups.dispHideAllGroupIcon();
    break;
  case "dispGroupTabIconReading":
    this.dispGroupTabIconReading = this.prefBranch.getBoolPref("dispGroupTabIconReading");
    this.addOrRemoveStyleSheet(this.dispGroupTabIconReading, ".tabgroupsmanager-grouptab-image-busy[busy] { display: -moz-box !important; }");
    break;
  case "dispGroupTabCount":
    this.dispGroupTabCount = this.prefBranch.getBoolPref("dispGroupTabCount");
    TabGroupsManager.allGroups.dispHideAllGroupTabCount();
    break;
  case "dispGroupTabCountReading":
    this.dispGroupTabCountReading = this.prefBranch.getBoolPref("dispGroupTabCountReading");
    TabGroupsManager.allGroups.dispAllGroupLabel();
    break;
  case "groupTabMinWidth":
    this.groupTabMinWidth = this.prefBranch.getIntPref("groupTabMinWidth");
    TabGroupsManager.allGroups.setMinWidthAllGroup();
    break;
  case "groupTabMaxWidth":
    this.groupTabMaxWidth = this.prefBranch.getIntPref("groupTabMaxWidth");
    TabGroupsManager.allGroups.setMaxWidthAllGroup();
    break;
  case "reduceSuspendGroup":
    this.reduceSuspendGroup = this.prefBranch.getBoolPref("reduceSuspendGroup");
    TabGroupsManager.allGroups.setReduceAllGroup();
    break;
  case "groupTabCrop":
    this.groupTabCrop = this.prefBranch.getIntPref("groupTabCrop");
    TabGroupsManager.allGroups.setCropAllGroup();
    break;
  case "normalGroupStyle":
  {
    let tmp = this.prefBranch.getCharPref("normalGroupStyle");
    if (!this.normalGroupStyle) this.normalGroupStyle = null;
    this.rewriteStyleSheet(".tabgroupsmanager-grouptab ", this.normalGroupStyle, tmp);
    this.normalGroupStyle = tmp;
    break;
  }
  case "selectedGroupStyle":
  {
    let tmp = this.prefBranch.getCharPref("selectedGroupStyle");
    if (!this.selectedGroupStyle) this.selectedGroupStyle = null;
    this.rewriteStyleSheet(".tabgroupsmanager-grouptab[selected='true'] ", this.selectedGroupStyle, tmp);
    this.selectedGroupStyle = tmp;
    break;
  }
  case "unreadGroupStyle":
  {
    let tmp = this.prefBranch.getCharPref("unreadGroupStyle");
    if (!this.unreadGroupStyle) this.unreadGroupStyle = null;
    this.rewriteStyleSheet(".tabgroupsmanager-grouptab[unread] ", this.unreadGroupStyle, tmp);
    this.unreadGroupStyle = tmp;
    break;
  }
  case "suspendedGroupStyle":
  {
    let tmp = this.prefBranch.getCharPref("suspendedGroupStyle");
    if (!this.suspendedGroupStyle) this.suspendedGroupStyle = null;
    this.rewriteStyleSheet(".tabgroupsmanager-grouptab[suspended] ", this.suspendedGroupStyle, tmp);
    this.suspendedGroupStyle = tmp;
    break;
  }
  case "groupMClick":
    this.groupMClick = this.prefBranch.getIntPref("groupMClick");
    break;
  case "groupDblClick":
    this.groupDblClick = this.prefBranch.getIntPref("groupDblClick");
    break;
  case "groupDblRClick":
    this.groupDblRClick = this.prefBranch.getIntPref("groupDblRClick");
    break;
  case "groupBarLClick":
    this.groupBarLClick = this.prefBranch.getIntPref("groupBarLClick");
    break;
  case "groupBarMClick":
    this.groupBarMClick = this.prefBranch.getIntPref("groupBarMClick");
    break;
  case "groupBarDblClick":
    this.groupBarDblClick = this.prefBranch.getIntPref("groupBarDblClick");
    break;
  case "buttonOpenMClick":
    this.buttonOpenMClick = this.prefBranch.getIntPref("buttonOpenMClick");
    break;
  case "buttonOpenDblClick":
    this.buttonOpenDblClick = this.prefBranch.getIntPref("buttonOpenDblClick");
    break;
  case "buttonSleepMClick":
    this.buttonSleepMClick = this.prefBranch.getIntPref("buttonSleepMClick");
    break;
  case "buttonSleepDblClick":
    this.buttonSleepDblClick = this.prefBranch.getIntPref("buttonSleepDblClick");
    break;
  case "buttonCloseMClick":
    this.buttonCloseMClick = this.prefBranch.getIntPref("buttonCloseMClick");
    break;
  case "buttonCloseDblClick":
    this.buttonCloseDblClick = this.prefBranch.getIntPref("buttonCloseDblClick");
    break;
  case "buttonDispMClick":
    this.buttonDispMClick = this.prefBranch.getIntPref("buttonDispMClick");
    break;
  case "buttonSleepLClick":
    this.buttonSleepLClick = this.prefBranch.getIntPref("buttonSleepLClick");
    this.setButtonType("TabGroupsManagerButtonSleep", this.buttonSleepLClick);
    break;
  case "buttonCloseLClick":
    this.buttonCloseLClick = this.prefBranch.getIntPref("buttonCloseLClick");
    this.setButtonType("TabGroupsManagerButtonClose", this.buttonCloseLClick);
    break;
  case "buttonOpenLClick":
    this.buttonOpenLClick = this.prefBranch.getIntPref("buttonOpenLClick");
    this.setButtonType("TabGroupsManagerButtonOpen", this.buttonOpenLClick);
    break;
  case "keyBindJson":
  case "keyBindOverride":
    this.keyBindJson = this.prefBranch.getCharPref("keyBindJson");
    this.keyBindOverride = this.prefBranch.getBoolPref("keyBindOverride");
    TabGroupsManager.keyboardShortcut.setKeyBind();
    break;
  case "ctrlTab":
    this.ctrlTab = this.prefBranch.getIntPref("ctrlTab");
    break;
  case "openNewGroupOperation":
    this.openNewGroupOperation = this.prefBranch.getBoolPref("openNewGroupOperation");
    break;
  case "openNewGroupByShift":
    this.openNewGroupByShift = this.prefBranch.getBoolPref("openNewGroupByShift");
    break;
  case "groupMenuOpen":
    this.groupMenuOpen = this.prefBranch.getBoolPref("groupMenuOpen");
    document.getElementById("TabGroupsManagerGroupMenuOpen").hidden = !this.groupMenuOpen;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuOpenActive":
    this.groupMenuOpenActive = this.prefBranch.getBoolPref("groupMenuOpenActive");
    document.getElementById("TabGroupsManagerGroupMenuOpenActive").hidden = !this.groupMenuOpenActive;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuOpenRename":
    this.groupMenuOpenRename = this.prefBranch.getBoolPref("groupMenuOpenRename");
    document.getElementById("TabGroupsManagerGroupMenuOpenRename").hidden = !this.groupMenuOpenRename;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuOpenActiveRename":
    this.groupMenuOpenActiveRename = this.prefBranch.getBoolPref("groupMenuOpenActiveRename");
    document.getElementById("TabGroupsManagerGroupMenuOpenActiveRename").hidden = !this.groupMenuOpenActiveRename;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuOpenWithHome":
    this.groupMenuOpenWithHome = this.prefBranch.getBoolPref("groupMenuOpenWithHome");
    document.getElementById("TabGroupsManagerGroupMenuOpenWithHome").hidden = !this.groupMenuOpenWithHome;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuOpenActiveWithHome":
    this.groupMenuOpenActiveWithHome = this.prefBranch.getBoolPref("groupMenuOpenActiveWithHome");
    document.getElementById("TabGroupsManagerGroupMenuOpenActiveWithHome").hidden = !this.groupMenuOpenActiveWithHome;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuOpenByRenameHistory":
    this.groupMenuOpenByRenameHistory = this.prefBranch.getBoolPref("groupMenuOpenByRenameHistory");
    document.getElementById("TabGroupsManagerGroupMenuOpenByRenameHistory").hidden = !this.groupMenuOpenByRenameHistory;
    document.getElementById("TabGroupsManagerGroupMenuSeparator1").hidden = !(this.groupMenuOpen || this.groupMenuOpenActive || this.groupMenuOpenRename || this.groupMenuOpenActiveRename || this.groupMenuOpenWithHome || this.groupMenuOpenActiveWithHome || this.groupMenuOpenByRenameHistory);
    break;
  case "groupMenuSleepActiveGroup":
    this.groupMenuSleepActiveGroup = this.prefBranch.getBoolPref("groupMenuSleepActiveGroup");
    document.getElementById("TabGroupsManagerGroupMenuSleepActiveGroup").hidden = !this.groupMenuSleepActiveGroup;
    document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden = !(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);
    break;
  case "groupMenuCloseActiveGroup":
    this.groupMenuCloseActiveGroup = this.prefBranch.getBoolPref("groupMenuCloseActiveGroup");
    document.getElementById("TabGroupsManagerGroupMenuCloseActiveGroup").hidden = !this.groupMenuCloseActiveGroup;
    document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden = !(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);
    break;
  case "groupMenuSleepingGroups":
    this.groupMenuSleepingGroups = this.prefBranch.getBoolPref("groupMenuSleepingGroups");
    document.getElementById("TabGroupsManagerGroupMenuSleepingGroups").hidden = !this.groupMenuSleepingGroups;
    document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden = !(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);
    break;
  case "groupMenuClosedGroups":
    this.groupMenuClosedGroups = this.prefBranch.getBoolPref("groupMenuClosedGroups");
    document.getElementById("TabGroupsManagerGroupMenuClosedGroups").hidden = !this.groupMenuClosedGroups;
    document.getElementById("TabGroupsManagerGroupMenuSeparator2").hidden = !(this.groupMenuSleepActiveGroup || this.groupMenuCloseActiveGroup || this.groupMenuSleepingGroups || this.groupMenuClosedGroups);
    break;
  case "groupMenuBookmarkAllGroups":
    this.groupMenuBookmarkAllGroups = this.prefBranch.getBoolPref("groupMenuBookmarkAllGroups");
    document.getElementById("TabGroupsManagerGroupMenuBookmarkAllGroups").hidden = !this.groupMenuBookmarkAllGroups;
    document.getElementById("TabGroupsManagerGroupMenuSeparator3").hidden = !(this.groupMenuBookmarkAllGroups || this.groupMenuBackupSession);
    break;
  case "groupMenuBackupSession":
    this.groupMenuBackupSession = this.prefBranch.getBoolPref("groupMenuBackupSession");
    document.getElementById("TabGroupsManagerGroupMenuBackupSession").hidden = !this.groupMenuBackupSession;
    document.getElementById("TabGroupsManagerGroupMenuSeparator3").hidden = !(this.groupMenuBookmarkAllGroups || this.groupMenuBackupSession);
    break;
  case "tabMenuSendToOtherGroup":
    this.tabMenuSendToOtherGroup = this.prefBranch.getBoolPref("tabMenuSendToOtherGroup");
    break;
  case "tabMenuCloseOtherTabInGroup":
    this.tabMenuCloseOtherTabInGroup = this.prefBranch.getBoolPref("tabMenuCloseOtherTabInGroup");
    break;
  case "tabMenuCloseLeftTabInGroup":
    this.tabMenuCloseLeftTabInGroup = this.prefBranch.getBoolPref("tabMenuCloseLeftTabInGroup");
    break;
  case "tabMenuSelectLeftTabInGroup":
    this.tabMenuSelectLeftTabInGroup = this.prefBranch.getBoolPref("tabMenuSelectLeftTabInGroup");
    break;
  case "tabMenuCloseRightTabInGroup":
    this.tabMenuCloseRightTabInGroup = this.prefBranch.getBoolPref("tabMenuCloseRightTabInGroup");
    break;
  case "tabMenuSelectRightTabInGroup":
    this.tabMenuSelectRightTabInGroup = this.prefBranch.getBoolPref("tabMenuSelectRightTabInGroup");
    break;
  case "maxClosedTabStoreCount":
    this.maxClosedTabStoreCount = this.prefBranch.getIntPref("maxClosedTabStoreCount");
    TabGroupsManager.closedGroups.setMaxLength(this.maxClosedTabStoreCount);
    break;
  case "groupRestoreOldPosition":
    this.groupRestoreOldPosition = this.prefBranch.getBoolPref("groupRestoreOldPosition");
    break;
  case "autoRenameDisableTime":
    this.autoRenameDisableTime = this.prefBranch.getIntPref("autoRenameDisableTime");
    break;
  case "focusTabWhenActiveTabClosed":
    this.focusTabWhenActiveTabClosed = this.prefBranch.getIntPref("focusTabWhenActiveTabClosed");
    break;
  case "groupNotCloseWhenCloseAllTabsInGroup":
    this.groupNotCloseWhenCloseAllTabsInGroup = this.prefBranch.getBoolPref("groupNotCloseWhenCloseAllTabsInGroup");
    break;
  case "processWhenWindowClose":
    this.processWhenWindowClose = this.prefBranch.getIntPref("processWhenWindowClose");
    break;
  case "debug":
    this.debug = this.prefBranch.getBoolPref("debug");
    break;
  }
};

TabGroupsManager.Preferences.prototype.setButtonType = function (id, value)
{
  let element = document.getElementById(id);
  if (element)
  {
    if (value & 256)
    {
      element.type = "menu-button";
    }
    else if (value == 99)
    {
      element.type = "menu";
    }
    else
    {
      element.type = "";
    }
  }
};

TabGroupsManager.Preferences.prototype.firefoxVersionCompare = function (target)
{
  return this.versionComparator.compare(this.firefoxAppInfo.version, target);
};

TabGroupsManager.Preferences.prototype.firefoxVersion = function ()
{
  return this.firefoxAppInfo.version.substr(0, this.firefoxAppInfo.version.indexOf('.'));
};

TabGroupsManager.Preferences.prototype.addStyleSheet = function (text)
{
  var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  var uri = TabGroupsManager.utils.createNewNsiUri("data:text/css," + encodeURIComponent("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul); " + text));
  if (!sss.sheetRegistered(uri, sss.USER_SHEET))
  {
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  }
};

TabGroupsManager.Preferences.prototype.removeStyleSheet = function (text)
{
  var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  var uri = TabGroupsManager.utils.createNewNsiUri("data:text/css," + encodeURIComponent("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul); " + text));
  if (sss.sheetRegistered(uri, sss.USER_SHEET))
  {
    sss.unregisterSheet(uri, sss.USER_SHEET);
  }
};

TabGroupsManager.Preferences.prototype.addOrRemoveStyleSheet = function (flag, text)
{
  if (flag)
  {
    this.addStyleSheet(text);
  }
  else
  {
    this.removeStyleSheet(text);
  }
};

TabGroupsManager.Preferences.prototype.rewriteStyleSheet = function (base, oldStyle, newStyle)
{
  if (oldStyle == newStyle)
  {
    return;
  }
  if (oldStyle)
  {
    this.removeStyleSheet(base + " { " + oldStyle + " } ");
  }
  if (newStyle)
  {
    this.addStyleSheet(base + " { " + newStyle + " } ");
  }
};

TabGroupsManager.Preferences.prototype.openPrefWindow = function ()
{
  window.openDialog("chrome://tabgroupsmanager/content/options.xul", "TabGroupsManagerSettingsWindow", "chrome,titlebar,toolbar,centerscreen");
};

//------------------------------------------------------------------------------------

TabGroupsManager.KeyboardShortcut = function ()
{
  this.keyset = null;
  this.setKeyBind();
};

TabGroupsManager.KeyboardShortcut.prototype.setKeyBind = function ()
{
  try
  {
    this.removeKeybind();
    var keyBind = this.readKeyBindJson();
    this.deleteDuplicatedKeyBind(keyBind);
    this.setMyKeyBind(keyBind);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.KeyboardShortcut.prototype.removeKeybind = function ()
{
  if (this.keyset)
  {
    for (var i = this.keyset.childNodes.length - 1; i >= 0; i--)
    {
      this.keyset.removeChild(this.keyset.childNodes[i]);
    }
    this.keyset.parentNode.removeChild(this.keyset);
    this.keyset = null;
  }
};

TabGroupsManager.KeyboardShortcut.prototype.readKeyBindJson = function ()
{
  let keyBindTmp = JSON.parse(TabGroupsManager.preferences.keyBindJson);
  let keyBind = new Array();
  for (var i = 0; i < keyBindTmp.length; i++)
  {
    if (keyBindTmp[i][0] && keyBindTmp[i][1])
    {
      let splitKey = keyBindTmp[i][0].split(/ *\| */);
      if (splitKey.length > 1 && splitKey[1] != "")
      {
        let keyBindOne = {};
        keyBind.push(keyBindOne);
        keyBindOne.keycode = "VK_" + splitKey[1];
        keyBindOne.modifiers = ((-1 != splitKey[0].indexOf("c") ? "control " : "") + (-1 != splitKey[0].indexOf("s") ? "shift " : "") + (-1 != splitKey[0].indexOf("a") ? "alt " : "") + (-1 != splitKey[0].indexOf("m") ? "meta " : "")).replace(/ $/, "");
        keyBindOne.code = keyBindTmp[i][1];
        if (keyBindTmp[i].length > 2)
        {
          keyBindOne.params = keyBindTmp[i].slice(2);
        }
      }
    }
  }
  return keyBind;
};

TabGroupsManager.KeyboardShortcut.prototype.deleteDuplicatedKeyBind = function (keyBind)
{
  if (TabGroupsManager.preferences.keyBindOverride)
  {
    var keysetList = document.getElementsByTagName("keyset");
    for (var i = 0; i < keysetList.length; i++)
    {
      for (var j = 0; j < keysetList[i].childNodes.length; j++)
      {
        var oldKeyBind = keysetList[i].childNodes[j];
        var modifiersTmp = oldKeyBind.getAttribute("modifiers");
        var modifiers = (modifiersTmp.match(/control|accel/i) ? "control " : "" + modifiersTmp.match(/shift/i) ? "shift " : "" + modifiersTmp.match(/alt|access/i) ? "alt " : "" + modifiersTmp.match(/meta/i) ? "meta " : "").replace(/ $/, "");
        var keycode = oldKeyBind.getAttribute("keycode").toUpperCase();
        if (!keycode)
        {
          keycode = "VK_" + oldKeyBind.getAttribute("key").toUpperCase();
        }
        for (var k = 0; k < keyBind.length; k++)
        {
          if (keyBind[k].modifiers == modifiers && keyBind[k].keycode == keycode)
          {
            oldKeyBind.setAttribute("disabled", true);
          }
        }
      }
    }
  }
};

TabGroupsManager.KeyboardShortcut.prototype.setMyKeyBind = function (keyBind)
{
  this.keyset = document.documentElement.appendChild(document.createElement("keyset"));
  for (var i = 0; i < keyBind.length; i++)
  {
    var key = this.keyset.appendChild(document.createElement("key"));
    key.setAttribute("modifiers", keyBind[i].modifiers);
    if (keyBind[i].keycode.length > 4)
    {
      key.setAttribute("keycode", keyBind[i].keycode);
    }
    else
    {
      key.setAttribute("key", keyBind[i].keycode.substr(3));
    }

    //key.setAttribute("oncommand","TabGroupsManager.keyboardShortcut.onCommand( event );");
    key.addEventListener("command", function (event)
    {
      TabGroupsManager.keyboardShortcut.onCommand(event);
    }, false);

    key.commandCode = keyBind[i].code;
    if (keyBind[i].params)
    {
      key.commandParams = keyBind[i].params.slice(0);
    }
  }
};

TabGroupsManager.KeyboardShortcut.prototype.onCommand = function (event)
{
  switch (event.target.commandCode)
  {
  case 0:
    TabGroupsManager.command.OpenNewGroup();
    break;
  case 1:
    TabGroupsManager.command.OpenNewGroupActive();
    break;
  case 2:
    TabGroupsManager.command.OpenNewGroupRename();
    break;
  case 3:
    TabGroupsManager.command.OpenNewGroupRenameActive();
    break;
  case 4:
    TabGroupsManager.command.OpenNewGroupHome();
    break;
  case 5:
    TabGroupsManager.command.OpenNewGroupHomeActive();
    break;
  case 10:
    TabGroupsManager.command.SleepActiveGroup();
    break;
  case 11:
    TabGroupsManager.command.RestoreLatestSleepedGroup();
    break;
  case 12:
    TabGroupsManager.command.SleepingGroupList();
    break;
  case 20:
    TabGroupsManager.command.CloseActiveGroup();
    break;
  case 21:
    TabGroupsManager.command.RestoreLatestClosedGroup();
    break;
  case 22:
    TabGroupsManager.command.ClosedGroupList();
    break;
  case 30:
    TabGroupsManager.command.SuspendActiveGroup();
    break;
  case 40:
    TabGroupsManager.command.SelectLeftGroup();
    break;
  case 41:
    TabGroupsManager.command.SelectRightGroup();
    break;
  case 42:
    TabGroupsManager.command.SelectLastGroup();
    break;
  case 43:
    TabGroupsManager.command.SelectNthGroup(event.target.commandParams[0] - 1);
    break;
  case 44:
    TabGroupsManager.command.SelectLeftTabInGroup();
    break;
  case 45:
    TabGroupsManager.command.SelectRightTabInGroup();
    break;
  case 46:
    TabGroupsManager.command.SelectLastTabInGroup();
    break;
  case 47:
    TabGroupsManager.command.SelectNthTabInGroup(event.target.commandParams[0] - 1);
    break;
  case 50:
    TabGroupsManager.command.DisplayHideGroupBar();
    break;
  case 60:
    TabGroupsManager.command.ActiveGroupMenu();
    break;
  case 61:
    TabGroupsManager.command.GroupBarMenu();
    break;
  }
};

//------------------------------------------------------------------------------------

TabGroupsManager.KeyboardState = function ()
{
  try
  {
    this.fCtrlKey = false;
    this.fShiftKey = false;
    this.fAltKey = false;
    this.fMetaKey = false;
    this.eventObject = null;
    this.__defineGetter__("ctrlKey", this.getCtrlKey);
    this.__defineGetter__("shiftKey", this.getShiftKey);
    this.__defineGetter__("altKey", this.getAltKey);
    this.__defineGetter__("metaKey", this.getMetaKey);
    this.__defineGetter__("mouseButton", this.mouseButton);
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.KeyboardState.prototype.createEventListener = function ()
{
  window.addEventListener("click", this, true);
  window.addEventListener("mousedown", this, true);
  window.addEventListener("mouseup", this, true);
  window.addEventListener("keydown", this, true);
  window.addEventListener("keyup", this, true);
  window.addEventListener("keypress", this, true);
};

TabGroupsManager.KeyboardState.prototype.destroyEventListener = function ()
{
  window.removeEventListener("click", this, true);
  window.removeEventListener("mousedown", this, true);
  window.removeEventListener("mouseup", this, true);
  window.removeEventListener("keydown", this, true);
  window.removeEventListener("keyup", this, true);
  window.removeEventListener("keypress", this, true);
};

TabGroupsManager.KeyboardState.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "click":
  case "mousedown":
  case "mouseup":
  case "keydown":
  case "keyup":
    this.getModifierKeys(event);
    break;
  case "keypress":
    this.onKeyPress(event);
    break;
  }
};

TabGroupsManager.KeyboardState.prototype.onKeyPress = function (event)
{
  if (event.keyCode == event.DOM_VK_TAB && !event.altKey && this.isAccelKeyDown(event))
  {
    if (event.shiftKey)
    {
      switch (TabGroupsManager.preferences.ctrlTab)
      {
      case 0:
        TabGroupsManager.allGroups.selectedGroup.selectLeftLoopTabInGroup();
        break;
      case 1:
        TabGroupsManager.allGroups.selectRightGroup();
        break;
      default:
        return;
      }
    }
    else
    {
      switch (TabGroupsManager.preferences.ctrlTab)
      {
      case 0:
      case 1:
        TabGroupsManager.allGroups.selectedGroup.selectRightLoopTabInGroup();
        break;
      default:
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.KeyboardState.prototype.selectObject = function ()
{
  if (this.eventObject)
  {
    return this.eventObject;
  }
  else if (("easyDragToGo" in window) && window.easyDragToGo.onDropEvent)
  {
    return window.easyDragToGo.onDropEvent;
  }
  return null;
};

TabGroupsManager.KeyboardState.prototype.getCtrlKey = function ()
{
  var object = this.selectObject();
  return object ? object.ctrlKey : this.fCtrlKey;
};

TabGroupsManager.KeyboardState.prototype.getShiftKey = function ()
{
  var object = this.selectObject();
  return object ? object.shiftKey : this.fShiftKey;
};

TabGroupsManager.KeyboardState.prototype.getAltKey = function ()
{
  var object = this.selectObject();
  return object ? object.altKey : this.fAltKey;
};

TabGroupsManager.KeyboardState.prototype.getMetaKey = function ()
{
  var object = this.selectObject();
  return object ? object.metaKey : this.fMetaKey;
};

TabGroupsManager.KeyboardState.prototype.mouseButton = function ()
{
  var eventObject = this.selectObject();
  if (!eventObject)
  {
    return null;
  }
  return eventObject.button;
};

TabGroupsManager.KeyboardState.prototype.getModifierKeys = function (event)
{
  try
  {
    if (undefined != event.ctrlKey) this.fCtrlKey = event.ctrlKey;
    if (undefined != event.shiftKey) this.fShiftKey = event.shiftKey;
    if (undefined != event.altKey) this.fAltKey = event.altKey;
    if (undefined != event.metaKey) this.fMetaKey = event.metaKey;
  }
  catch (e)
  {}
};

TabGroupsManager.KeyboardState.prototype.isAccelKeyDown = function (event)
{
  return (TabGroupsManager.preferences.isMac ? event.metaKey : event.ctrlKey);
};

//------------------------------------------------------------------------------------

TabGroupsManager.Places = function ()
{
  try
  {
    this.bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
    this.allOpenInNewGroupString = document.getElementById("TabGroupsManagerPlacesAllOpenInNewGroup").label;
    this.allOpenInSelectedGroupString = document.getElementById("TabGroupsManagerPlacesAllOpenInSelectedGroup").label;
    let modifyList = ["bookmarksBarContent", "PlacesToolbar", "bookmarksMenuPopup", "bookmarks-menu-button", "PlacesChevron"];
    for (let i = 0; i < modifyList.length; i++)
    {
      let element = document.getElementById(modifyList[i]);
      if (element)
      {
        element.addEventListener("click", this, true);
        element.addEventListener("dblclick", this, true);
      }
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Places.prototype.addAllOpenInGroupMenuitem = function (target)
{
  target._openAllInNewGroup = document.createElement("menuitem");
  target._openAllInNewGroup.setAttribute("id", "TabGroupsManagerMenuitemAllOpenInNewGroup");

  //target._openAllInNewGroup.setAttribute("oncommand","TabGroupsManager.places.menuitemAllOpenInNewGroupCommand( event );");
  target._openAllInNewGroup.addEventListener("command", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInNewGroupCommand(event);
  }, false);

  //target._openAllInNewGroup.setAttribute("onclick","TabGroupsManager.places.menuitemAllOpenInNewGroupClick( event );");
  target._openAllInNewGroup.addEventListener("click", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInNewGroupClick(event);
  }, false);

  target._openAllInNewGroup.setAttribute("label", this.allOpenInNewGroupString);
  target.appendChild(target._openAllInNewGroup);
  target._openAllInSelectedGroup = document.createElement("menuitem");
  target._openAllInSelectedGroup.setAttribute("id", "TabGroupsManagerMenuitemAllOpenInSelectedGroup");

  //target._openAllInSelectedGroup.setAttribute("oncommand","TabGroupsManager.places.menuitemAllOpenInSelectedGroupCommand( event );");
  target._openAllInSelectedGroup.addEventListener("command", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInSelectedGroupCommand(event);
  }, false);

  //target._openAllInSelectedGroup.setAttribute("onclick","TabGroupsManager.places.menuitemAllOpenInSelectedGroupClick( event );");
  target._openAllInSelectedGroup.addEventListener("click", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInSelectedGroupClick(event);
  }, false);

  target._openAllInSelectedGroup.setAttribute("label", this.allOpenInSelectedGroupString);
  target.appendChild(target._openAllInSelectedGroup);
};

TabGroupsManager.Places.prototype.removeAllOpenInGroupMenuitem = function (target)
{
  target.removeChild(target._openAllInNewGroup);
  target.removeChild(target._openAllInSelectedGroup);
  delete target._openAllInNewGroup;
  delete target._openAllInSelectedGroup;
};

TabGroupsManager.Places.prototype.menuitemAllOpenInNewGroupCommand = function (event)
{
  this.allOpenInNewGroup(event.target.parentNode.parentNode.node);
};

TabGroupsManager.Places.prototype.menuitemAllOpenInNewGroupClick = function (event)
{
  if (event.button == 1)
  {
    this.allOpenInNewGroup(event.target.parentNode.parentNode.node);
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.Places.prototype.menuitemAllOpenInSelectedGroupCommand = function (event)
{
  this.allOpenInSelectedGroup(event.target.parentNode.parentNode.node);
};

TabGroupsManager.Places.prototype.menuitemAllOpenInSelectedGroupClick = function (event)
{
  if (event.button == 1)
  {
    this.allOpenInSelectedGroup(event.target.parentNode.parentNode.node);
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.Places.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "click":
    this.onClick(event);
    break;
  case "dblclick":
    this.onDblClick(event);
    break;
  }
};

TabGroupsManager.Places.prototype.onClick = function (event)
{
  switch (event.button)
  {
  case 0:
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderLClick, event);
    break;
  case 1:
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderMClick, event);
    break;
  }
};

TabGroupsManager.Places.prototype.onDblClick = function (event)
{
  if (event.button == 0)
  {
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderDblClick, event);
  }
};

TabGroupsManager.Places.prototype.execBookmarkFolderClick = function (no, event)
{
  if (no == -1)
  {
    return;
  }
  let result;
  if (no > 2)
  {
    result = this.allOpenInSelectedGroup(event.target._placesNode || event.target.node);
  }
  else if (no > 0)
  {
    result = this.allOpenInNewGroup(event.target._placesNode || event.target.node);
  }
  if (result)
  {
    if (no % 2 != 0)
    {
      for (let node = event.target.parentNode; node; node = node.parentNode)
      {
        if (node.localName == "menupopup")
        {
          node.hidePopup();
        }
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.Places.prototype.openInNewGroup = function (bookmarkItem)
{
  var groupName = bookmarkItem.title;
  var icon = bookmarkItem.icon ? bookmarkItem.icon.spec : "";
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(bookmarkItem.uri);
  return TabGroupsManager.allGroups.openNewGroup(newTab, undefined, groupName, icon);
};

TabGroupsManager.Places.prototype.openInSelectedGroup = function (bookmarkItem)
{
  var group = this.openInNewGroup(bookmarkItem);
  TabGroupsManager.allGroups.selectedGroup = group;
};

TabGroupsManager.Places.prototype.allOpenInNewGroup = function (bookmarkFolder)
{
  if (!bookmarkFolder || !PlacesUtils.nodeIsFolder(bookmarkFolder))
  {
    return null;
  }
  bookmarkFolder = PlacesUtils.getFolderContents(bookmarkFolder.itemId).root;
  var count = 0;
  for (var i = 0; i < bookmarkFolder.childCount; i++)
  {
    if (PlacesUtils.nodeIsBookmark(bookmarkFolder.getChild(i)))
    {
      count++;
    }
  }
  if (count <= 0)
  {
    return null;
  }
  if (count > 10)
  {
    var message = TabGroupsManager.strings.getFormattedString("MenuItemAllOpenTooManyBookmarks", [count]);
    if (!window.confirm(message))
    {
      return null;
    }
  }
  var groupName = bookmarkFolder.title;
  var icon = bookmarkFolder.icon ? bookmarkItem.icon.spec : "";
  var group = TabGroupsManager.allGroups.openNewGroupCore(undefined, groupName, icon);
  for (var i = 0; i < bookmarkFolder.childCount; i++)
  {
    var bookmarkItem = bookmarkFolder.getChild(i);
    if (PlacesUtils.nodeIsBookmark(bookmarkItem))
    {
      let tab = TabGroupsManager.overrideMethod.gBrowserAddTab(bookmarkItem.uri);
      group.addTab(tab);
    }
  }
  return group;
};

TabGroupsManager.Places.prototype.allOpenInSelectedGroup = function (bookmarkFolder)
{
  var group = this.allOpenInNewGroup(bookmarkFolder);
  if (group)
  {
    group.setSelected();
  }
  return group;
};

//------------------------------------------------------------------------------------

TabGroupsManager.Session = function ()
{
  try
  {
    this.groupRestored = 0;
    this.sessionRestoring = null;
    this.disableOnSSTabRestoring = false;
    this.sessionRestoreManually = false;
    this.sessionStore = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Session.prototype.createEventListener = function ()
{
  gBrowser.tabContainer.addEventListener("SSTabRestoring", this, false);
  window.addEventListener("SSWindowStateBusy", this, false);
  window.addEventListener("SSWindowStateReady", this, false);
};

TabGroupsManager.Session.prototype.destroyEventListener = function ()
{
  gBrowser.tabContainer.removeEventListener("SSTabRestoring", this, false);
  window.removeEventListener("SSWindowStateBusy", this, false);
  window.removeEventListener("SSWindowStateReady", this, false);
};

TabGroupsManager.Session.prototype.handleEvent = function (event)
{
  try
  {
    switch (event.type)
    {
    case "SSTabRestoring":
      this.onSSTabRestoring(event);
      break;
    case "SSWindowStateBusy":
      this.onSSWindowStateBusy(event);
      break;
    case "SSWindowStateReady":
      this.onSSWindowStateReady(event);
      break;
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Session.prototype.onSSWindowStateBusy = function (event)
{
  this.sessionRestoring = true;
};

TabGroupsManager.Session.prototype.onSSWindowStateReady = function (event)
{
  this.sessionRestoring = false;
};

TabGroupsManager.Session.prototype.onSSTabRestoring = function (event)
{
  TabGroupsManager.initializeAfterOnLoad(); //FIXME <<= you have to be kidding!
  if (!this.disableOnSSTabRestoring)
  {
    this.moveTabToGroupBySessionStore(event.originalTarget);
  }
};

TabGroupsManager.Session.prototype.moveTabToGroupBySessionStore = function (restoringTab)
{
  try
  {
    var groupId = this.getGroupId(restoringTab);
    if (isNaN(groupId))
    {
      groupId = (restoringTab.group) ? restoringTab.group.id : TabGroupsManager.allGroups.selectedGroup.id;
      this.sessionStore.setTabValue(restoringTab, "TabGroupsManagerGroupId", groupId.toString());
    }
    if (restoringTab.group && restoringTab.group.id == groupId)
    {
      return;
    }
    var group = TabGroupsManager.allGroups.getGroupById(groupId);
    if (group)
    {
      this.moveTabToGroupWithSuspend(group, restoringTab);
      return;
    }
    if (null == TabGroupsManagerJsm.applicationStatus.getGroupById(groupId))
    {
      var groupName = this.sessionStore.getTabValue(restoringTab, "TabGroupsManagerGroupName");
      var group = TabGroupsManager.allGroups.openNewGroupCore(groupId, groupName);
      /**/
      console.log("created", group)
      this.moveTabToGroupWithSuspend(group, restoringTab);
      return;
    }
    /**/
    console.log("yelp? this should NOT occur")
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Session.prototype.moveTabToGroupWithSuspend = function (group, tab)
{
  if (tab == gBrowser.selectedTab)
  {
    group.suspended = false;
    group.addTab(tab, true);
    group.selectedTab = tab;
    group.setSelected();
  }
  else
  {
    group.addTab(tab, true);
  }
};

TabGroupsManager.Session.prototype.allTabsMoveToGroup = function ()
{
  this.allTabsMovingToGroup = true;
  try
  {
    for (let tab = gBrowser.tabContainer.firstChild; tab; tab = tab.nextSibling)
    {
      let groupId = parseInt(this.sessionStore.getTabValue(tab, "TabGroupsManagerGroupId"), 10);
      if (!isNaN(groupId))
      {
        if (!tab.group || tab.group.id != groupId)
        {
          let group = TabGroupsManager.allGroups.getGroupById(groupId);
          if (group)
          {
            this.moveTabToGroupWithSuspend(group, tab);
          }
        }
      }
      else
      {
        if (!tab.group)
        {
          let group = TabGroupsManager.allGroups.getGroupById(-1) || TabGroupsManager.allGroups.selectedGroup;
          group.addTab(tab);
        }
        this.sessionStore.setTabValue(tab, "TabGroupsManagerGroupId", tab.group.id.toString());
        this.sessionStore.setTabValue(tab, "TabGroupsManagerGroupName", tab.group.name);
      }
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    delete this.allTabsMovingToGroup;
    TabGroupsManager.eventListener.onGroupSelect(null);
    let startGroup = TabGroupsManager.allGroups.getGroupById(-1);
    if (startGroup && startGroup.tabArray.length == 0)
    {
      startGroup.close();
    }
  }
};

TabGroupsManager.Session.prototype.getGroupId = function (tab)
{
  return parseInt(this.sessionStore.getTabValue(tab, "TabGroupsManagerGroupId"), 10);
};

TabGroupsManager.Session.prototype.setGroupNameAllTabsInGroup = function (group)
{
  for (var i = 0; i < group.tabArray.length; i++)
  {
    this.sessionStore.setTabValue(group.tabArray[i], "TabGroupsManagerGroupName", group.name);
  }
};

TabGroupsManager.Session.prototype.restoreGroupsAndSleepingGroupsAndClosedGroups = function ()
{
  if (this.groupRestored == 0)
  {
    TabGroupsManager.allGroups.loadAllGroupsData();
  }
};

TabGroupsManager.Session.prototype.backupByManually = function ()
{
  TabGroupsManagerJsm.saveData.backupByManually();
};

TabGroupsManager.Session.prototype.exportDataEmergency = function (message)
{
  let strings = window.TabGroupsManager.strings;
  alert(strings.getString(message) + strings.getString("ExportDataEmergency"));
  this.exportSession();
};

TabGroupsManager.Session.prototype.exportSession = function ()
{
  let nsIFilePicker = Ci.nsIFilePicker;
  let filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  filePicker.init(window, null, nsIFilePicker.modeSave);
  filePicker.appendFilter(TabGroupsManager.strings.getString("SessionDataExtDescription") + "(*." + TabGroupsManagerJsm.constValues.sessionDataExt2 + ")", "*." + TabGroupsManagerJsm.constValues.sessionDataExt2);
  filePicker.appendFilters(nsIFilePicker.filterAll);
  filePicker.defaultString = "TabGroupsManager_Session_" + TabGroupsManagerJsm.applicationStatus.getNowString() + "." + TabGroupsManagerJsm.constValues.sessionDataExt2;
  filePicker.defaultExtension = TabGroupsManagerJsm.constValues.sessionDataExt2;
  let result = filePicker.show();
  if (result == nsIFilePicker.returnOK || result == nsIFilePicker.returnReplace)
  {
    try
    {
      TabGroupsManagerJsm.saveData.saveFileFromTgmData(filePicker.file);
    }
    catch (e)
    {
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
  }
};

TabGroupsManager.Session.prototype.onShowingBackupSessionMenu = function (event)
{
  var menuPopup = event.originalTarget;
  TabGroupsManager.session.onHiddenBackupSessionMenu(event);
  var flgmntNode = document.createDocumentFragment();
  let list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupSwapFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupManuallyFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupWindowCloseFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupTimerFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.dataFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, false);
  menuPopup.appendChild(flgmntNode);
};

TabGroupsManager.Session.prototype.makeRestoresSessionMenu = function (flgmntNode, list, reverseSort)
{
  if (list.length <= 0)
  {
    return;
  }
  let menuitem = document.createElement("menuseparator");
  flgmntNode.appendChild(menuitem);
  list.sort(reverseSort ? TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafNameReverse : TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafName);
  for (var i = 0; i < list.length; i++)
  {
    let one = list[i];
    let menuitem = document.createElement("menuitem");
    let label = one.leafName;
    label = label.replace(TabGroupsManagerJsm.saveData.backupSwapFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionBackupSwap"));
    label = label.replace(TabGroupsManagerJsm.saveData.backupManuallyFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionSave"));
    label = label.replace(TabGroupsManagerJsm.saveData.backupWindowCloseFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionBackupWindowCloseLabel"));
    label = label.replace(TabGroupsManagerJsm.saveData.backupTimerFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionBackupByTimerLabel"));
    if (label.match(TabGroupsManagerJsm.saveData.dataFileRegexp))
    {
      label = label.replace(TabGroupsManagerJsm.saveData.dataFileNowRegexp, TabGroupsManager.strings.getString("ReplaceSessionSaveDataNow"));
      label = label.replace(TabGroupsManagerJsm.saveData.dataFileMirrorRegexp, TabGroupsManager.strings.getString("ReplaceSessionSaveDataMirror"));
      label = label.replace(TabGroupsManagerJsm.saveData.dataFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionSaveData"));
    }
    else
    {
      menuitem.setAttribute("context", "TabGroupsManagerSessionContextMenu");
    }
    menuitem.setAttribute("value", one.leafName);
    menuitem.setAttribute("label", label);
    menuitem.setAttribute("tooltiptext", TabGroupsManager.strings.getString("SessionBackupTooltip"));
    //menuitem.setAttribute("oncommand","TabGroupsManager.session.restoreSessionCommand(event);");
    menuitem.addEventListener("command", function (event)
    {
      TabGroupsManager.session.restoreSessionCommand(event);
    }, false);

    flgmntNode.appendChild(menuitem);
  }
};

TabGroupsManager.Session.prototype.onHiddenBackupSessionMenu = function (event)
{
  var menuPopup = event.originalTarget;
  menuitem = menuPopup.childNodes[2];
  while (menuitem)
  {
    menuPopup.removeChild(menuitem);
    menuitem = menuPopup.childNodes[2];
  }
};

TabGroupsManager.Session.prototype.restoreSessionCommand = function (event)
{
  TabGroupsManagerJsm.saveData.restoreSession(event.originalTarget.getAttribute("value"));
};

TabGroupsManager.Session.prototype.restoreSessionInit = function ()
{
  TabGroupsManager.allGroups.openNewGroup(null, -1, null, null);
  var groupTab = TabGroupsManager.allGroups.childNodes;
  for (var i = groupTab.length - 2; i >= 0; i--)
  {
    groupTab[i].group.closeAllTabsAndGroup();
  }
  this.groupRestored = 0;
  this.sessionRestoreManually = true;
};

TabGroupsManager.Session.prototype.restoreSessionFromAboutSessionRestore = function ()
{
  TabGroupsManager.allGroups.selectedGroup.id = -1;
  this.groupRestored = 0;
  this.sessionRestoreManually = true;
};

TabGroupsManager.Session.prototype.menuitemDelete = function (event)
{
  TabGroupsManagerJsm.saveData.deleteSession(document.popupNode.getAttribute("value"));
};

TabGroupsManager.Session.prototype.setClosedTabJson = function (jsonData)
{
  window.removeEventListener("SSWindowStateBusy", this, false);
  window.removeEventListener("SSWindowStateReady", this, false);
  try
  {
    let stateJson = JSON.stringify(
    {
      windows: [
      {
        tabs: [],
        _closedTabs: JSON.parse(jsonData)
      }],
      _firstTabs: true
    });
    this.sessionStore.setWindowState(window, stateJson, false);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    window.addEventListener("SSWindowStateBusy", this, false);
    window.addEventListener("SSWindowStateReady", this, false);
  }
};

TabGroupsManager.Session.prototype.getTabStateEx = function (tab)
{
  //when do we get no textbox in about:config? -> override this for E10s
  if (!tab.linkedBrowser.ownerDocument.defaultView.gMultiProcessBrowser)
  {
    if (tab.linkedBrowser && tab.linkedBrowser.currentURI.spec == "about:config" && !tab.linkedBrowser.contentDocument.getElementById("textbox"))
    {
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

TabGroupsManager.Session.prototype.duplicateTabEx = function (aWindow, tab)
{
  //when do we get no textbox in about:config? -> override this for E10s
  if (!tab.linkedBrowser.ownerDocument.defaultView.gMultiProcessBrowser)
  {
    if (tab.linkedBrowser && tab.linkedBrowser.currentURI.spec == "about:config" && !tab.linkedBrowser.contentDocument.getElementById("textbox"))
    {
      this.tmpOverrideGetElementByIdForAboutConfig(tab);
      try
      {
        return this.sessionStore.duplicateTab(aWindow, tab);
      }
      finally
      {
        delete tab.linkedBrowser.contentDocument.getElementById;
      }
    }
  }
  return this.sessionStore.duplicateTab(aWindow, tab);
};

TabGroupsManager.Session.prototype.tmpOverrideGetElementByIdForAboutConfig = function (tab)
{
  //http://zpao.com/posts/session-restore-changes-in-firefox-15/ > '#' removed > fx 15
  //Bug 947212 - Broadcast form data and move it out of tabData.entries[] > fx 29
  //let state = JSON.parse(this.sessionStore.getTabState(tab));
  //let textbox = state.formdata.id["textbox"];

  //no reason to fix this, there is always a textbox element for about:config - not sure when this will be called
  let ssData = tab.linkedBrowser.__SS_data;
  let textbox = ssData.entries[ssData.index - 1].formdata["#textbox"];
  tab.linkedBrowser.contentDocument.getElementById = function ()
  {
    return {
      value: textbox
    }
  };
};

//------------------------------------------------------------------------------------

TabGroupsManager.openMenu = {};

TabGroupsManager.openMenu.onShowing = function (event)
{
  this.onHidden(event);
  var flgmntNode = this.makeOpenGroupWithRegisteredNameFragment();
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "start", flgmntNode);
  var flgmntNode = this.makeOpenGroupWithHistoryFragment();
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "startHistory", flgmntNode);
};

TabGroupsManager.openMenu.onShowingRename = function (event)
{
  this.onHidden(event);
  var flgmntNode = this.makeOpenGroupWithRegisteredNameFragment(true);
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "start", flgmntNode);
  var flgmntNode = this.makeOpenGroupWithHistoryFragment(true);
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "startHistory", flgmntNode);
};

TabGroupsManager.openMenu.makeOpenGroupWithRegisteredNameFragment = function (rename)
{
  var flgmntNode = document.createDocumentFragment();
  var list = TabGroupsManagerJsm.globalPreferences.groupNameRegistered;
  var i;
  for (i = 0; i < list.length; i++)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", list[i]);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("context", "TabGroupsManagerRegisteredGroupNameMenuitemContextMenu");
    menuitem.groupNameTypeIsRegistered = true;
    menuitem.groupNameIndex = i;
    if (rename)
    {
      menuitem.addEventListener("command", this.renameGroupByMenuitem, false);
    }
    else
    {
      menuitem.setAttribute("tooltiptext", TabGroupsManager.strings.getString("OpenMenuitemOpenNamedGroupHelp"));
      menuitem.addEventListener("command", this.openNamedGroupByMenuitem, false);
      menuitem.addEventListener("click", this.openNamedGroupByMenuitemClick, false);
    }
    flgmntNode.appendChild(menuitem);
  }
  if (i > 0)
  {
    var menuitem = document.createElement("menuseparator");
    menuitem.style.marginLeft = "20px";
    flgmntNode.appendChild(menuitem);
  }
  return flgmntNode;
};

TabGroupsManager.openMenu.makeOpenGroupWithHistoryFragment = function (rename)
{
  var flgmntNode = document.createDocumentFragment();
  var list = TabGroupsManagerJsm.globalPreferences.groupNameHistory;
  var i;
  for (i = 0; i < list.length; i++)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", list[i]);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("context", "TabGroupsManagerHistoryGroupNameMenuitemContextMenu");
    menuitem.groupNameTypeIsRegistered = false;
    menuitem.groupNameIndex = i;
    if (rename)
    {
      menuitem.addEventListener("command", this.renameGroupByMenuitem, false);
    }
    else
    {
      menuitem.setAttribute("tooltiptext", TabGroupsManager.strings.getString("OpenMenuitemOpenNamedGroupHelp"));
      menuitem.addEventListener("command", this.openNamedGroupByMenuitem, false);
      menuitem.addEventListener("click", this.openNamedGroupByMenuitemClick, false);
    }
    flgmntNode.appendChild(menuitem);
  }
  if (i > 0)
  {
    var menuitem = document.createElement("menuseparator");
    menuitem.style.marginLeft = "20px";
    flgmntNode.appendChild(menuitem);
  }
  return flgmntNode;
};

TabGroupsManager.openMenu.onHidden = function (event)
{
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.originalTarget, "start", "end");
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.originalTarget, "startHistory", "endHistory");
};

TabGroupsManager.openMenu.openNamedGroupByMenuitem = function (event)
{
  var name = event.target.getAttribute("label");
  var group = TabGroupsManager.allGroups.openNewGroup(null, null, name, null);
  group.disableAutoRename = true;
  if (event.ctrlKey)
  {
    TabGroupsManager.allGroups.selectedGroup = group;
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.openNamedGroupByMenuitemClick = function (event)
{
  if (event.button == 1)
  {
    TabGroupsManager.openMenu.openNamedGroupByMenuitem(event);
    event.stopPropagation();
  }
};

TabGroupsManager.openMenu.renameGroupByMenuitem = function (event)
{
  var group = TabGroupsManager.groupMenu.popupGroup;
  if (group)
  {
    group.name = event.target.getAttribute("label");
    group.disableAutoRename = true;
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.menuitemDelete = function (event)
{
  var menuitem = document.popupNode;
  if (menuitem.groupNameIndex != undefined)
  {
    if (menuitem.groupNameTypeIsRegistered)
    {
      TabGroupsManagerJsm.globalPreferences.deleteGroupNameRegistered(menuitem.groupNameIndex);
    }
    else
    {
      TabGroupsManagerJsm.globalPreferences.deleteGroupNameHistory(menuitem.groupNameIndex);
    }
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.toRegisteredGroupName = function (event)
{
  var menuitem = document.popupNode;
  var name = TabGroupsManagerJsm.globalPreferences.groupNameHistory[menuitem.groupNameIndex];
  TabGroupsManagerJsm.globalPreferences.deleteGroupNameHistory(menuitem.groupNameIndex);
  TabGroupsManagerJsm.globalPreferences.addGroupNameRegistered(name);
  event.stopPropagation();
};

TabGroupsManager.openMenu.registerGroupName = function (event)
{
  var name = window.prompt(TabGroupsManager.strings.getString("RenameDialogMessage"), "");
  if (name)
  {
    TabGroupsManagerJsm.globalPreferences.addGroupNameRegistered(name);
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.clearGroupNameHistory = function (event)
{
  TabGroupsManagerJsm.globalPreferences.clearGroupNameHistory();
  event.stopPropagation();
};

//------------------------------------------------------------------------------------

TabGroupsManager.ToolMenu = function ()
{
  document.getElementById("menu_ToolsPopup").addEventListener("popupshowing", this, false);
};

TabGroupsManager.ToolMenu.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "popupshowing":
    document.getElementById("TabGroupsMnagerDispGroupBarInToolBarMenu").hidden = TabGroupsManager.groupBarDispHide.dispGroupBar;
    break;
  }
};

//------------------------------------------------------------------------------------

TabGroupsManager.EventListener = function ()
{
  this.groupSelecting = false;
  this.tabOpenTarget = null;
};

TabGroupsManager.EventListener.prototype.createEventListener = function ()
{
  var groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.addEventListener("mousedown", this, true);
  groupTabs.addEventListener("click", this, false);
  groupTabs.addEventListener("dblclick", this, false);
  groupTabs.addEventListener("select", this, false);
  if (!("TMP_TabGroupsManager" in window))
  {
    gBrowser.tabContainer.addEventListener("TabOpen", this, false);
    gBrowser.tabContainer.addEventListener("TabClose", this, false);
  }
  gBrowser.tabContainer.addEventListener("TabSelect", this, false);
  gBrowser.tabContainer.addEventListener("TabMove", this, false);
  gBrowser.tabContainer.addEventListener("TabShow", this, false);
  gBrowser.tabContainer.addEventListener("TabHide", this, false);
  var contextMenu = document.getElementById("contentAreaContextMenu");
  if (contextMenu)
  {
    contextMenu.addEventListener("popupshowing", this, false);
  }
};

TabGroupsManager.EventListener.prototype.destroyEventListener = function ()
{
  var groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.removeEventListener("mousedown", this, true);
  groupTabs.removeEventListener("click", this, false);
  groupTabs.removeEventListener("dblclick", this, false);
  groupTabs.removeEventListener("select", this, false);
  if (!("TMP_TabGroupsManager" in window))
  {
    gBrowser.tabContainer.removeEventListener("TabOpen", this, false);
    gBrowser.tabContainer.removeEventListener("TabClose", this, false);
  }
  gBrowser.tabContainer.removeEventListener("TabSelect", this, false);
  gBrowser.tabContainer.removeEventListener("TabMove", this, false);
  var contextMenu = document.getElementById("contentAreaContextMenu");
  if (contextMenu)
  {
    contextMenu.removeEventListener("popupshowing", this, false);
  }
};

TabGroupsManager.EventListener.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "mousedown":
    event.stopPropagation();
    break;
  case "click":
    this.onGroupClick(event);
    break;
  case "dblclick":
    this.onGroupDblClick(event);
    break;
  case "select":
    this.onGroupSelect(event);
    break;
  case "TabOpen":
    this.onTabOpen(event);
    break;
  case "TabClose":
    this.onTabClose(event);
    break;
  case "TabSelect":
    this.onTabSelect(event);
    break;
  case "TabMove":
    this.onTabMove(event);
    break;
  case "TabShow":
    this.onTabShow(event);
    break;
  case "TabHide":
    this.onTabHide(event);
    break;
  case "popupshowing":
    this.contentAreaContextMenuShowHideItems(event);
    break;
  }
};

TabGroupsManager.EventListener.prototype.onTabOpen = function (event)
{
  try
  {
    if (!TabGroupsManager.session.sessionRestoring || !TabGroupsManagerJsm.globalPreferences.lastSessionFinalized)
    {
      var newTab = event.originalTarget;
      if (TabGroupsManager.preferences.tabTreeOpenTabByExternalApplication && TabGroupsManager.tabOpenStatus.openerContext == Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL)
      {
        var group = TabGroupsManager.allGroups.getGroupById(-2);
        if (!group)
        {
          group = TabGroupsManager.allGroups.openNewGroup(newTab, -2, TabGroupsManager.strings.getString("ExtAppGroupName"));
          TabGroupsManager.allGroups.changeGroupOrder(group, 0);
        }
        else
        {
          group.addTab(newTab);
        }
      }
      else if (TabGroupsManager.tabOpenStatus.openerTab)
      {
        var parentTab = TabGroupsManager.tabOpenStatus.openerTab;
        if (TabGroupsManager.preferences.tabTreeOpenTabByJavaScript)
        {
          parentTab.group.addTab(newTab);
        }
        else
        {
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
        if (!parentTab.tabGroupsManagerTabTree)
        {
          parentTab.tabGroupsManagerTabTree = new TabGroupsManager.TabTree(parentTab);
        }
        parentTab.tabGroupsManagerTabTree.addTabToTree(newTab);
      }
      else
      {
        if (this.tabOpenTarget)
        {
          this.tabOpenTarget.addTab(newTab);
        }
        else
        {
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
      }
      TabGroupsManager.groupBarDispHide.dispGroupBarByTabCount();
      newTab.tgmSelectedTime = (new Date()).getTime();
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.tabOpenStatus.clearOpenerData();
    this.tabOpenTarget = null;
  }
};

TabGroupsManager.EventListener.prototype.onTabClose = function (event)
{
  var closeTab = event.originalTarget;
  if (closeTab.tabGroupsManagerTabTree)
  {
    closeTab.tabGroupsManagerTabTree.removeTabFromTree(true);
  }
  if (closeTab.group != null)
  {
    closeTab.group.removeTab(closeTab, true);
  }
  TabGroupsManager.groupBarDispHide.hideGroupBarByTabCountDelay();
};

TabGroupsManager.EventListener.prototype.onTabSelect = function (event)
{
  var tab = gBrowser.selectedTab;
  if (tab.group == null)
  {
    //FIXME is it possible for the group to be null if we're not in the restoring code?
    if (TabGroupsManager.session.sessionRestoring)
    {
      return; //It's being weird
    }
    TabGroupsManager.allGroups.selectedGroup.addTab(tab);
  }
  if (!tab.group.selected)
  {
    tab.group.selectedTab = tab;
    TabGroupsManager.allGroups.selectedGroup = tab.group;
  }
  else
  {
    tab.group.selectedTab = tab;
  }
  tab.tgmSelectedTime = (new Date()).getTime();
};

TabGroupsManager.EventListener.prototype.onTabShow = function (event)
{
  var tab = event.target;
  if (!tab.group.selected)
  {
    TabGroupsManager.utils.hideTab(tab);
  }
};

TabGroupsManager.EventListener.prototype.onTabHide = function (event)
{
  var tab = event.target;
  let count = 0;

  function checkTabGroup()
  {
    count++;
    var activeGroupPromise = new Promise(
      function (resolve, reject)
      {
        setTimeout(function ()
        {
          if (typeof tab.group == "undefined" && count < 10)
          {
            checkTabGroup();
          }
          else resolve(tab);
        }, 50);
      });

    activeGroupPromise.then(function (tab)
    {
      if (tab.group.selected)
      {
        TabGroupsManager.utils.unHideTab(tab);
      }
    }, Components.utils.reportError);
  }

  //check if tab.group is not defined at startup since Fx25+
  if (TabGroupsManager.preferences.firefoxVersionCompare("28") == 1 && typeof tab.group == "undefined")
  {
    checkTabGroup();
  }
  else
  {
    if (tab.group.selected)
    {
      TabGroupsManager.utils.unHideTab(tab);
    }
  }
};

TabGroupsManager.EventListener.prototype.onTabMove = function (event)
{
  var tab = event.originalTarget;
  if (!TabGroupsManager.eventListener.groupSelecting)
  {
    if (tab.tabGroupsManagerTabTree)
    {
      tab.tabGroupsManagerTabTree.removeTabFromTree(false);
    }
    if (tab.group)
    {
      tab.group.sortTabArrayByTPos();
    }
  }
};

TabGroupsManager.EventListener.prototype.onGroupSelect = function (event)
{
  if (TabGroupsManager.session.allTabsMovingToGroup)
  {
    return;
  }
  TabGroupsManager.eventListener.groupSelecting = true;
  try
  {
    var selectedGroup = TabGroupsManager.allGroups.selectedGroup;
    selectedGroup.suspended = false;
    if (selectedGroup.tabArray.length == 0)
    {
      let tab = selectedGroup.makeDummyTab();
      selectedGroup.addTab(tab);
      selectedGroup.selectedTab = tab;
    }
    if (!selectedGroup.selectedTab)
    {
      selectedGroup.selectedTab = selectedGroup.tabArray[0];
    }
    for (var tab = gBrowser.mTabContainer.firstChild; tab; tab = tab.nextSibling)
    {
      if (tab.group && !tab.group.selected)
      {
        TabGroupsManager.utils.hideTab(tab);
      }
      else
      {
        TabGroupsManager.utils.unHideTab(tab);
      }
    }
    TabGroupsManager.allGroups.scrollInActiveGroup(true);
    if (!("TreeStyleTabService" in window))
    {
      if ("TabmixTabbar" in window)
      {
        if (TabGroupsManager.preferences.firefoxVersionCompare("3.7") > 0)
        {
          if (TabmixTabbar.isMultiRow)
          {
            TabmixTabbar.updateScrollStatus();
          }
          else
          {
            gBrowser.tabContainer.collapsedTabs = 0;
          }
        }
        else
        {
          gBrowser.mTabContainer.collapsedTabs = 0;
          TabmixTabbar.updateScrollStatus();
          gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
          TabmixTabbar.updateBeforeAndAfter();
        }
      }
      else if ("tabBarScrollStatus" in window)
      {
        gBrowser.mTabContainer.collapsedTabs = 0;
        tabBarScrollStatus();
        gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
        checkBeforeAndAfter();
      }
    }
    gBrowser.selectedTab = selectedGroup.selectedTab;
    selectedGroup.unread = false;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.eventListener.groupSelecting = false;
  }
};

TabGroupsManager.EventListener.prototype.onGroupClick = function (event)
{
  var group = event.target.group;
  if (group)
  {
    if (event.button == 0)
    {
      if (group.suspended)
      {
        group.suspended = false;
      }
      else
      {
        group.setSelected();
      }
    }
    else if (event.button == 1)
    {
      group.mouseCommand(TabGroupsManager.preferences.groupMClick);
    }
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onGroupDblClick = function (event)
{
  if (event.button == 0)
  {
    event.target.group.mouseCommand(TabGroupsManager.preferences.groupDblClick);
  }
  else if (event.button == 2)
  {
    if (TabGroupsManager.preferences.groupDblRClick != 0)
    {
      document.getElementById("TabGroupsManagerGroupContextMenu").hidePopup();
    }
    event.target.group.mouseCommand(TabGroupsManager.preferences.groupDblRClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onGroupBarClick = function (event)
{
  switch (event.button)
  {
  case 0:
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarLClick);
    break;
  case 1:
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarMClick);
    break;
  }
};

TabGroupsManager.EventListener.prototype.onGroupBarDblClick = function (event)
{
  switch (event.button)
  {
  case 0:
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarDblClick);
    break;
  }
};

TabGroupsManager.EventListener.prototype.onButtonOpenCommand = function (event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonOpenClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonOpenDblClick = function (event)
{
  if (event.button == 0) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenDblClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepCommand = function (event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepDblClick = function (event)
{
  if (event.button == 0) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepDblClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseCommand = function (event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseDblClick = function (event)
{
  if (event.button == 0) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseDblClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonDispMClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonDispMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onShowingSleepingGroupsMenu = function (event)
{
  TabGroupsManager.sleepingGroups.createMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onHiddenSleepingGroupsMenu = function (event)
{
  TabGroupsManager.sleepingGroups.destroyMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onShowingClosedGroupsMenu = function (event)
{
  TabGroupsManager.closedGroups.createMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onHiddenClosedGroupsMenu = function (event)
{
  TabGroupsManager.closedGroups.destroyMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.contentAreaContextMenuShowHideItems = function ()
{
  document.getElementById("TabGroupsManagerLinkOpenInNewGroup").hidden = !gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInSelectedGroup").hidden = !gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInNewGroupSeparator").hidden = !gContextMenu.onLink;
};

TabGroupsManager.EventListener.prototype.linkOpenInNewGroup = function ()
{
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  TabGroupsManager.allGroups.openNewGroup(newTab);
};

TabGroupsManager.EventListener.prototype.linkOpenInSelectedGroup = function ()
{
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  var group = TabGroupsManager.allGroups.openNewGroup(newTab);
  TabGroupsManager.allGroups.selectedGroup = group;
};

//------------------------------------------------------------------------------------

TabGroupsManager.TabContextMenu = function () {};

TabGroupsManager.TabContextMenu.prototype.makeMenu = function ()
{
  var flgmntNode = document.createDocumentFragment();
  flgmntNode.appendChild(document.createElement("menuseparator"));
  var sendToMenu = document.createElement("menu");
  sendToMenu.setAttribute("id", "TabGroupsManagerTabContextMenuSendToOtherGroup");
  sendToMenu.setAttribute("label", TabGroupsManager.strings.getString("SendToOtherGroup"));
  var sendToMenuPopup = document.createElement("menupopup");
  sendToMenuPopup.addEventListener("popupshowing", this.sendToMenuPopup, false);
  sendToMenuPopup.addEventListener("popuphidden", this.sendToMenuHidden, false);
  sendToMenu.appendChild(sendToMenuPopup);
  flgmntNode.appendChild(sendToMenu);
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseOtherTab", "CloseOtherTab", this.closeOtherTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseLeftTab", "CloseLeftTab", this.closeLeftTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuSelectLeftTab", "SelectLeftTab", this.selectLeftTabInGroupWithHTM));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseRightTab", "CloseRightTab", this.closeRightTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuSelectRightTab", "SelectRightTab", this.selectRightTabInGroupWithHTM));
  let menu = gBrowser.tabContextMenu;
  if (!menu)
  {
    menu = document.getAnonymousElementByAttribute(gBrowser, "anonid", "tabContextMenu");
  }
  menu.appendChild(flgmntNode);
  menu.addEventListener("popupshowing", this.contextMenuPopup, false);
};

TabGroupsManager.TabContextMenu.prototype.deleteMenu = function ()
{
  let menu = gBrowser.tabContextMenu;
  if (!menu)
  {
    menu = document.getAnonymousElementByAttribute(gBrowser, "anonid", "tabContextMenu");
  }
  //fix deleting null items on exit (exception seen while debugging and reloading with F5).
  var menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseOtherTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseLeftTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuSelectLeftTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseRightTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuSelectRightTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }

  menu.removeEventListener("popupshowing", this.contextMenuPopup, false);
};

TabGroupsManager.TabContextMenu.prototype.makeOneMenuitem = function (id, name, command)
{
  var menuitem = document.createElement("menuitem");
  menuitem.setAttribute("id", "TabGroupsManager" + id + "Menuid");
  menuitem.setAttribute("label", TabGroupsManager.strings.getString(name + "MenuItemLabel"));
  menuitem.setAttribute("accesskey", TabGroupsManager.strings.getString(name + "MenuItemAccesskey"));
  menuitem.addEventListener("command", command, false);
  return menuitem;
};

TabGroupsManager.TabContextMenu.prototype.contextMenuPopup = function ()
{
  var tabContextMenuSendToOtherGroup = document.getElementById("TabGroupsManagerTabContextMenuSendToOtherGroup");
  var tabContextMenuCloseOtherTab = document.getElementById("TabGroupsManagerTabContextMenuCloseOtherTabMenuid");
  var tabContextMenuCloseLeftTab = document.getElementById("TabGroupsManagerTabContextMenuCloseLeftTabMenuid");
  var tabContextMenuCloseRightTab = document.getElementById("TabGroupsManagerTabContextMenuCloseRightTabMenuid");
  var tabContextMenuSelectLeftTab = document.getElementById("TabGroupsManagerTabContextMenuSelectLeftTabMenuid");
  var tabContextMenuSelectRightTab = document.getElementById("TabGroupsManagerTabContextMenuSelectRightTabMenuid");
  if (!document.popupNode.group)
  {
    tabContextMenuSendToOtherGroup.hidden = true;
    tabContextMenuCloseOtherTab.hidden = true;
    tabContextMenuCloseLeftTab.hidden = true;
    tabContextMenuCloseRightTab.hidden = true;
    tabContextMenuSelectLeftTab.hidden = true;
    tabContextMenuSelectRightTab.hidden = true;
    return;
  }
  tabContextMenuSendToOtherGroup.hidden = !TabGroupsManager.preferences.tabMenuSendToOtherGroup;
  tabContextMenuCloseOtherTab.hidden = !TabGroupsManager.preferences.tabMenuCloseOtherTabInGroup;
  tabContextMenuCloseLeftTab.hidden = !TabGroupsManager.preferences.tabMenuCloseLeftTabInGroup;
  tabContextMenuCloseRightTab.hidden = !TabGroupsManager.preferences.tabMenuCloseRightTabInGroup;
  tabContextMenuSelectLeftTab.hidden = !("MultipleTabService" in window) || !TabGroupsManager.preferences.tabMenuSelectLeftTabInGroup;
  tabContextMenuSelectRightTab.hidden = !("MultipleTabService" in window) || !TabGroupsManager.preferences.tabMenuSelectRightTabInGroup;
  var targetTab = document.popupNode;
  var disabledLeft = !TabGroupsManager.tabContextMenu.existsLeftTabInGroup(targetTab);
  var disabledRight = !TabGroupsManager.tabContextMenu.existsRightTabInGroup(targetTab);
  var disabledOhter = disabledLeft && disabledRight;
  tabContextMenuCloseOtherTab.setAttribute("disabled", disabledOhter);
  tabContextMenuCloseLeftTab.setAttribute("disabled", disabledLeft);
  tabContextMenuCloseRightTab.setAttribute("disabled", disabledRight);
};

TabGroupsManager.TabContextMenu.prototype.sendToMenuPopup = function (event)
{
  TabGroupsManager.tabContextMenu.sendToMenuHidden(event);
  var flgmntNode = document.createDocumentFragment();
  var menuitem = document.createElement("menuitem");
  menuitem.setAttribute("label", TabGroupsManager.strings.getString("SendToNewGroup"));
  menuitem.setAttribute("class", "menuitem-iconic");
  menuitem.addEventListener("command", TabGroupsManager.tabContextMenu.sendTabToNewGroup, false);
  flgmntNode.appendChild(menuitem);
  flgmntNode.appendChild(document.createElement("menuseparator"));
  for (var i = 0; i < TabGroupsManager.allGroups.childNodes.length; i++)
  {
    var nowGroup = TabGroupsManager.allGroups.childNodes[i].group;
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("value", nowGroup.id);
    menuitem.setAttribute("label", nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"));
    menuitem.setAttribute("image", nowGroup.image);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("validate", "never");
    if (nowGroup.id == document.popupNode.group.id)
    {
      menuitem.setAttribute("disabled", "true");
    }
    menuitem.addEventListener("command", TabGroupsManager.tabContextMenu.sendTabToGroup, false);
    flgmntNode.appendChild(menuitem);
  }
  flgmntNode.appendChild(document.createElement("menuseparator"));
  for (var i = 0; i < TabGroupsManager.sleepingGroups.store.length; i++)
  {
    var nowGroup = TabGroupsManager.sleepingGroups.store[i];
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("value", nowGroup.id);
    menuitem.setAttribute("label", nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"));
    menuitem.setAttribute("image", nowGroup.image);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("validate", "never");
    menuitem.addEventListener("command", TabGroupsManager.tabContextMenu.sendTabToSleepingGroup, false);
    flgmntNode.appendChild(menuitem);
  }
  var sendToMenuPopup = event.target;
  sendToMenuPopup.appendChild(flgmntNode);
};

TabGroupsManager.TabContextMenu.prototype.sendToMenuHidden = function (event)
{
  var sendToMenuPopup = event.target;
  TabGroupsManager.utils.deleteFromAnonidToAnonid(sendToMenuPopup);
};

TabGroupsManager.TabContextMenu.prototype.sendTabToNewGroup = function (event)
{
  var tab = document.popupNode;
  TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab, null, event.ctrlKey);
};

TabGroupsManager.TabContextMenu.prototype.sendTabToGroup = function (event)
{
  var tab = document.popupNode;
  var groupId = event.target.getAttribute("value") - 0;
  var group = TabGroupsManager.allGroups.getGroupById(groupId);
  TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab, group, event.ctrlKey);
};

TabGroupsManager.TabContextMenu.prototype.sendTabToSleepingGroup = function (event)
{
  var tab = document.popupNode;
  var groupId = event.target.getAttribute("value") - 0;
  TabGroupsManager.sleepingGroups.sendTabToGroupsStore(tab, groupId);
};

TabGroupsManager.TabContextMenu.prototype.closeLeftTabInGroup = function ()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab.previousSibling; tab;)
  {
    var nextTab = tab.previousSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      gBrowser.removeTab(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.closeRightTabInGroup = function ()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab.nextSibling; tab;)
  {
    var nextTab = tab.nextSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      gBrowser.removeTab(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.selectLeftTabInGroupWithHTM = function ()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab; tab;)
  {
    var nextTab = tab.previousSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      MultipleTabService.toggleSelection(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.selectRightTabInGroupWithHTM = function ()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab; tab;)
  {
    var nextTab = tab.nextSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      MultipleTabService.toggleSelection(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.closeOtherTabInGroup = function ()
{
  TabGroupsManager.tabContextMenu.closeRightTabInGroup();
  TabGroupsManager.tabContextMenu.closeLeftTabInGroup();
};

TabGroupsManager.TabContextMenu.prototype.existsLeftTabInGroup = function (targetTab)
{
  var targetGroup = targetTab.group;
  for (var tab = targetTab.previousSibling; tab; tab = tab.previousSibling)
  {
    if (tab.group == targetGroup)
    {
      return true;
    }
  }
  return false;
};

TabGroupsManager.TabContextMenu.prototype.existsRightTabInGroup = function (targetTab)
{
  var targetGroup = targetTab.group;
  for (var tab = targetTab.nextSibling; tab; tab = tab.nextSibling)
  {
    if (tab.group == targetGroup)
    {
      return true;
    }
  }
  return false;
};

//------------------------------------------------------------------------------------

TabGroupsManager.SupportDnD = function ()
{
  try
  {
    this.dropAllow = document.getElementById("TabGroupsManagerGroupBarDropAllow");
    this.dropPlus = document.getElementById("TabGroupsManagerGroupBarDropPlus");
    this.dropPlusNewGroup = document.getElementById("TabGroupsManagerGroupBarDropPlusNewGroup");
    this.dropZZZ = document.getElementById("TabGroupsManagerGroupBarDropZZZ");
    this.dropSuspend = document.getElementById("TabGroupsManagerDropSuspend");
    this.icons = new Array();
    this.icons.push(this.dropAllow);
    this.icons.push(this.dropPlus);
    this.icons.push(this.dropPlusNewGroup);
    this.icons.push(this.dropZZZ);
    this.icons.push(this.dropSuspend);
    this.displayIconTimer = null;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.SupportDnD.prototype.getDragElementByParent = function (element, parent)
{
  while (element)
  {
    var nextElement = element.parentNode;
    if (nextElement == parent)
    {
      return element;
    }
    element = nextElement;
  }
  return null;
};

TabGroupsManager.SupportDnD.prototype.getDragElementByTagName = function (element, tagName)
{
  var xulTagName = "xul:" + tagName;
  while (element)
  {
    if (element.tagName == tagName || element.tagName == xulTagName)
    {
      return element;
    }
    element = element.parentNode;
  }
  return null;
};

TabGroupsManager.SupportDnD.prototype.setAllowPositionX = function (positionX)
{
  this.dropAllow.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropAllow);
};

TabGroupsManager.SupportDnD.prototype.setPlusPositionX = function (positionX)
{
  this.dropPlus.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropPlus);
};

TabGroupsManager.SupportDnD.prototype.setPlusOPositionX = function (positionX, ctrlKey)
{
  this.dropPlusNewGroup.style.left = positionX + "px";
  if (ctrlKey != undefined)
  {
    this.dropAllow.style.left = (positionX + 16) + "px";
    this.dropPlus.style.left = (positionX + 16) + "px";
    this.selectDisplayIconTimer(this.dropPlusNewGroup, ctrlKey ? this.dropPlus : this.dropAllow);
  }
  else
  {
    this.selectDisplayIconTimer(this.dropPlusNewGroup);
  }
};

TabGroupsManager.SupportDnD.prototype.setZZZPosition = function (positionX, positionY)
{
  this.dropZZZ.style.left = positionX + "px";
  this.dropZZZ.style.top = positionY + "px";
  this.selectDisplayIconTimer(this.dropZZZ);
};

TabGroupsManager.SupportDnD.prototype.setZZZPositionX = function (positionX)
{
  this.dropZZZ.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropZZZ);
};

TabGroupsManager.SupportDnD.prototype.setSuspendPositionX = function (positionX)
{
  this.dropSuspend.style.left = positionX + "px";
  this.selectDisplayIconTimer(this.dropSuspend);
};

TabGroupsManager.SupportDnD.prototype.stopDisplayTimer = function ()
{
  if (('undefined' !== typeof this.displayIconTimer) && (this.displayIconTimer))
  {
    clearTimeout(this.displayIconTimer);
  }
  this.displayIconTimer = null;
};

TabGroupsManager.SupportDnD.prototype.selectDisplayIcon = function (displayIconList)
{
  this.stopDisplayTimer();
  for (let i = 0; i < this.icons.length; i++)
  {
    this.icons[i].hidden = (-1 == displayIconList.indexOf(this.icons[i]));
  }
};

TabGroupsManager.SupportDnD.prototype.selectDisplayIconTimer = function ()
{
  this.stopDisplayTimer();
  let displayIconList = new Array();
  for (let i = 0; i < arguments.length; i++)
  {
    displayIconList.push(arguments[i]);
  }
  this.displayIconTimer = setTimeout(function (_this)
  {
    _this.selectDisplayIcon(displayIconList);
  }, 0, this);
};

TabGroupsManager.SupportDnD.prototype.hideAllNow = function ()
{
  this.hideAllNowCore();
  this.hideAll();
};

TabGroupsManager.SupportDnD.prototype.hideAllNowCore = function ()
{
  this.stopDisplayTimer();
  if (('undefined' !== typeof this.icons) && (this.icons))
  {
    for (let i = 0; i < this.icons.length; i++)
    {
      this.icons[i].hidden = true;
    }
  }
};

TabGroupsManager.SupportDnD.prototype.hideAll = function ()
{
  this.stopDisplayTimer();
  this.displayIconTimer = setTimeout(function (_this)
  {
    _this.hideAllNowCore();
  }, 0, this);
};

//------------------------------------------------------------------------------------

window.addEventListener("load", TabGroupsManager.onLoad, false);
