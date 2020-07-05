/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.Preferences = function()
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
    //FIXME seriously? why are we setting this?
    if (this.tabTreeOpenTabByJavaScript)
    {
      this.prefRoot.setBoolPref("browser.tabs.insertRelatedAfterCurrent", false);
    }
    this.debug = this.prefBranch.getBoolPref("debug");
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Preferences.prototype.destructor = function()
{
  if (this.prefBranch)
  {
    this.prefBranch.removeObserver("", this);
  }
};

TabGroupsManager.Preferences.prototype.observe = function(aSubject, aTopic, aData)
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

TabGroupsManager.Preferences.prototype.setButtonType = function(id, value)
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

TabGroupsManager.Preferences.prototype.firefoxVersionCompare = function(target)
{
  return this.versionComparator.compare(this.firefoxAppInfo.version, target);
};

TabGroupsManager.Preferences.prototype.firefoxVersion = function()
{
  return this.firefoxAppInfo.version.substr(0, this.firefoxAppInfo.version.indexOf('.'));
};

TabGroupsManager.Preferences.prototype.addStyleSheet = function(text)
{
  var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  var uri = TabGroupsManager.utils.createNewNsiUri("data:text/css," + encodeURIComponent("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul); " + text));
  if (!sss.sheetRegistered(uri, sss.USER_SHEET))
  {
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  }
};

TabGroupsManager.Preferences.prototype.removeStyleSheet = function(text)
{
  var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  var uri = TabGroupsManager.utils.createNewNsiUri("data:text/css," + encodeURIComponent("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul); " + text));
  if (sss.sheetRegistered(uri, sss.USER_SHEET))
  {
    sss.unregisterSheet(uri, sss.USER_SHEET);
  }
};

TabGroupsManager.Preferences.prototype.addOrRemoveStyleSheet = function(flag, text)
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

TabGroupsManager.Preferences.prototype.rewriteStyleSheet = function(base, oldStyle, newStyle)
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

TabGroupsManager.Preferences.prototype.openPrefWindow = function()
{
  window.openDialog("chrome://tabgroupsmanager/content/options.xul", "TabGroupsManagerSettingsWindow", "chrome,titlebar,toolbar,centerscreen");
};
