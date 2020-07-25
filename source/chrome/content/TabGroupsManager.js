/*jshint browser: true, devel: true */
/*eslint-env browser */
/* globals TabGroupsManagerJsm */

var Cc = Components.classes;
var Ci = Components.interfaces;
Components.utils.import("resource://tabgroupsmanager/modules/AxelUtils.jsm");
Components.utils.import("resource://gre/modules/PlacesUtils.jsm");

var TabGroupsManager = {
  apiEnabled: false,
  contextTargetHref: null,

  //setup E10s message processing
  MESSAGES: [ "sendToTGMChrome" ],

  receiveMessage: function(msg)
  {
    if (msg.name != "sendToTGMChrome")
    {
      return;
    }

    switch (msg.data.msgType)
    {
    case "linkTarget": // set our target in chrome code
      TabGroupsManager.contextTargetHref = msg.data.href;
      break;
    }
  }
};

//setup E10s message manager and framescript
TabGroupsManager.addFrameScript = function()
{
  const mm = window.getGroupMessageManager("browsers");

  //enable delayed load for new tabs
  mm.loadFrameScript("chrome://tabgroupsmanager/content/TabGroupsManager-content.js", true);

  //setup chrome message listener
  for (const msg of this.MESSAGES)
  {
    mm.addMessageListener(msg, this.receiveMessage);
  }
};

TabGroupsManager.onLoad = function(_event)
{
  window.removeEventListener("load", arguments.callee);
  window.addEventListener("unload", TabGroupsManager.onUnload);
  TabGroupsManager.initialize();
};

TabGroupsManager.onUnload = function(_event)
{
  window.removeEventListener("unload", arguments.callee);
  TabGroupsManager.finalize();
};

TabGroupsManager.initialize = function(event)
{
  try
  {
    this.addFrameScript();
    this.lastId = 1;
    this.strings = document.getElementById("TabGroupsManagerStrings");
    Components.utils.import("resource://tabgroupsmanager/modules/TabGroupsManager.jsm");
    TabGroupsManagerJsm.applicationStatus.addWindow(window);
    this.xulElements = new this.XulElements();
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
    //This is for when you manage to drag a whole group into a brand  new window
    //Having said which, I can't work out how to trigger it.
    if ("arguments" in window &&
        window.arguments.length > 2 &&
        window.arguments[1] == "TabGroupsManagerNewWindowWithGroup")
    {
      const fromGroupTab = window.arguments[2];
      if (fromGroupTab.group)
      {
        const newGroup = this.allGroups.moveGroupToOtherWindow(
          fromGroupTab,
          null,
          window.arguments[3]);
        this.allGroups.selectedGroup = newGroup;
        group.close();
      }
    }

    //FIXME Why is this delayed?
    setTimeout(function ()
    {
      TabGroupsManager.initializeAfterOnLoad();
    }, 10);
  }
  catch (err)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(err);
  }
};

TabGroupsManager.initializeAfterOnLoad = function()
{
  try
  {
    //This is nasty as we're depending on the preferences of another extension
    if (TabGroupsManagerJsm.globalPreferences.prefService.getBranch(
      "extensions.tabmix.sessions.").getBoolPref("manager", false))
    {
      try
      {
        /**/console.log("kick3");
        this.session.sessionStore.getWindowState(window);
      }
      catch (err)
      {
        //FIXME - how does this get caused?
/**/console.log(err)
        this.session.sessionStore.init(window);
      }
    }

    this.tabContextMenu.makeMenu();

    setTimeout(function ()
    {
      TabGroupsManager.onLoadDelay1000();
    }, 1000);
  }
  catch (err)
  {
    TabGroupsManagerJsm.displayError.alertIfDebug(err);
  }
};

TabGroupsManager.onLoadDelay1000 = function()
{
  try
  {
/**/console.log("kick6")
    //this can take effect *after* the first session has been restored when you select
    //restore from specific session without prompting...
    //would probably be better done by waiting for the browser to announce all
    //extensions have been initialised.
    TabGroupsManager.overrideMethod.delayOverride();
    TabGroupsManager.overrideOtherAddOns.delayOverride();
  }
  catch (err)
  {
/**/console.log("bad things happened", err)
  }
};

TabGroupsManager.finalize = function()
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

TabGroupsManager.afterQuitApplicationRequested = function()
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

//------------------------------------------------------------------------------

window.addEventListener("load", TabGroupsManager.onLoad, false);
