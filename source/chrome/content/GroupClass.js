/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.GroupClass = function (id, name, image)
{
  try
  {
    this._id = id || TabGroupsManagerJsm.applicationStatus.makeNewId();
    this._name = name || "";
    this._image = image || "";
    this._suspended = false;
    this._selectedTab = null;
    this.suspendedTabIndex = -1;
    this._busy = false;
    this._busyTabCount = 0;
    this._unread = false;
    this.suspendTitleList = "";
    this.tabArray = new Array();
    this.suspendArray = undefined;
    this._disableAutoRename = false;
    this.autoRenameBak = null;
    this.autoRenameIndex = -1;
    this.autoRenameDisableTimer = null;
    this.__defineGetter__("selected", function ()
    {
      return this.groupTab.selected;
    });
    this.__defineGetter__("selectedTab", function ()
    {
      return this._selectedTab;
    });
    this.__defineSetter__("selectedTab", this.setSelectedTab);
    this.__defineGetter__("id", function ()
    {
      return this._id;
    });
    this.__defineSetter__("id", this.setID);
    this.__defineGetter__("name", function ()
    {
      return this._name;
    });
    this.__defineSetter__("name", this.setName);
    this.__defineGetter__("image", function ()
    {
      return this._image;
    });
    this.__defineSetter__("image", this.setImage);
    this.__defineGetter__("disableAutoRename", function ()
    {
      return this._disableAutoRename;
    });
    this.__defineSetter__("disableAutoRename", this.setDisableAutoRename);
    this.__defineGetter__("firstTab", this.getFirstTabInGroup);
    this.__defineGetter__("lastTab", this.getLastTabInGroup);
    this.__defineGetter__("last2Tab", this.getLast2TabInGroup);
    this.__defineGetter__("suspended", function ()
    {
      return this._suspended;
    });
    this.__defineSetter__("suspended", this.setSuspended);
    this.__defineGetter__("displayTabCount", function ()
    {
      return this.suspended ? this.suspendArray.length : this.tabArray.length;
    });
    this.__defineGetter__("busy", function ()
    {
      return this._busy;
    });
    this.__defineSetter__("busy", this.setBusy);
    this.__defineGetter__("unread", function ()
    {
      return this._unread;
    });
    this.__defineSetter__("unread", this.setUnread);
    this.__defineGetter__("busyTabCount", function ()
    {
      return this._busyTabCount;
    });
    this.__defineSetter__("busyTabCount", this.setBusyTabCount);
    this.progressListener = new TabGroupsManager.progressListenerForGroup(this);
    this.groupTab = this.makeGroupTab();
    this.relateGroupTab(this.groupTab);
    TabGroupsManager.allGroups.saveAllGroupsData();
    TabGroupsManager.groupBarDispHide.dispGroupBarByGroupCount();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupClass.prototype.setSelectedTab = function (tab)
{
  this._selectedTab = tab;
  if (gBrowser.selectedTab != tab && this.selected)
  {
    gBrowser.selectedTab = tab;
  }
};

TabGroupsManager.GroupClass.prototype.setID = function (value)
{
  if (this._id != value)
  {
    this._id = value;
    this.groupTab.id = "_group" + this.id;
  }
};

TabGroupsManager.GroupClass.prototype.setName = function (name)
{
  this.reassignGroupIdFromMinus2();
  this._name = name;
  this.dispGroupLabel();
  TabGroupsManager.session.setGroupNameAllTabsInGroup(this);
  TabGroupsManager.allGroups.saveAllGroupsData();
};

TabGroupsManager.GroupClass.prototype.setImage = function (image)
{
  this._image = image;
  this.groupTab.setAttribute("image", this.image);
  TabGroupsManager.allGroups.saveAllGroupsData();
};

TabGroupsManager.GroupClass.prototype.setDisableAutoRename = function (value)
{
  this._disableAutoRename = value;
  TabGroupsManager.allGroups.saveAllGroupsData();
};

TabGroupsManager.GroupClass.prototype.setBusyTabCount = function (value)
{
  if (this._busyTabCount != value)
  {
    if (!this.selected && this._busyTabCount > value)
    {
      this.unread = true;
    }
    this._busyTabCount = value;
    if (TabGroupsManager.preferences.dispGroupTabCountReading)
    {
      this.groupTab.tabCount = (this.busyTabCount > 0) ? (this.busyTabCount + "/" + this.tabArray.length) : this.tabArray.length;
    }
    else
    {
      this.groupTab.tabCount = this.tabArray.length;
    }
  }
};

TabGroupsManager.GroupClass.prototype.setBusy = function (value)
{
  if (this._busy != value)
  {
    this._busy = value;
    this.setRemoveGroupTabAttribute("busy", value);
  }
};

TabGroupsManager.GroupClass.prototype.setUnread = function (value)
{
  if (this._unread != value)
  {
    this._unread = value;
    this.setRemoveGroupTabAttribute("unread", value);
  }
};

TabGroupsManager.GroupClass.prototype.setSuspended = function (value)
{
  return value ? this.suspendGroup() : this.unsuspendGroup();
};

TabGroupsManager.GroupClass.prototype.setRemoveGroupTabAttribute = function (key, value)
{
  if (value)
  {
    this.groupTab.setAttribute(key, "true");
  }
  else
  {
    this.groupTab.removeAttribute(key);
  }
};

TabGroupsManager.GroupClass.prototype.makeGroupTab = function ()
{
  var groupTab = TabGroupsManager.allGroups.groupbar.appendItem();
  groupTab.className = "tabgroupsmanager-grouptab";
  groupTab.minWidth = TabGroupsManager.preferences.groupTabMinWidth;
  groupTab._minWidthWithReduce = TabGroupsManager.preferences.groupTabMinWidth;
  groupTab.maxWidth = TabGroupsManager.preferences.groupTabMaxWidth;
  const GroupTabCropString = ["none", "start", "end", "center"];
  groupTab.setAttribute("crop", GroupTabCropString[TabGroupsManager.preferences.groupTabCrop]);
  if (!TabGroupsManager.preferences.dispGroupTabIcon)
  {
    setTimeout(function ()
    {
      groupTab.hideIcon = true;
    }, 0);
  }
  return groupTab;
};

TabGroupsManager.GroupClass.prototype.relateGroupTab = function (groupTab)
{
  this.groupTab = groupTab;
  groupTab.group = this;
  groupTab.id = "_group" + this.id;
  this.dispGroupLabel();
  this.groupTab.setAttribute("image", this.image);
  this.setRemoveGroupTabAttribute("busy", this._busy);
  this.setRemoveGroupTabAttribute("unread", this._unread);
  this.setRemoveGroupTabAttribute("suspended", this._suspended);
  if (this.groupTab.reduce != undefined)
  {
    this.groupTab.reduce = TabGroupsManager.preferences.reduceSuspendGroup && this.suspended;
  }
};

TabGroupsManager.GroupClass.prototype.setSelected = function ()
{
  if (!this.selected)
  {
    TabGroupsManager.allGroups.selectedGroup = this;
  }
};

TabGroupsManager.GroupClass.prototype.sortTabArrayByTPos = function ()
{
  this.tabArray.sort(this.sortTabArrayByTPosFunction);
};

TabGroupsManager.GroupClass.prototype.sortTabArrayByTPosFunction = function (a, b)
{
  try
  {
    return (a._tPos - b._tPos);
  }
  catch (e)
  {}
  return 0;
};

TabGroupsManager.GroupClass.prototype.displayGroupBusy = function ()
{
  var busyTabCount = 0;
  for (var i = 0; i < this.tabArray.length; i++)
  {
    if (this.tabArray[i].hasAttribute("busy"))
    {
      busyTabCount++;
    }
  }
  this.busyTabCount = busyTabCount;
  this.busy = (busyTabCount > 0);
};

TabGroupsManager.GroupClass.prototype.dispGroupLabel = function ()
{
  this.groupTab.setAttribute("label", this.name || TabGroupsManager.strings.getString("NewGroupName"));
  if (this.groupTab.tabCount != null && this.groupTab.hideTabCount != null)
  {
    if (TabGroupsManager.preferences.dispGroupTabCountReading)
    {
      this.groupTab.tabCount = (this.busyTabCount > 0) ? (this.busyTabCount + "/" + this.displayTabCount) : this.displayTabCount;
    }
    else
    {
      this.groupTab.tabCount = this.displayTabCount;
    }
    this.groupTab.hideTabCount = !TabGroupsManager.preferences.dispGroupTabCount;
  }
  else
  {
    var _this = this;
    setTimeout(function ()
    {
      _this.dispGroupLabel();
    }, 10);
  }
  this.groupTab.tooltipText = this.name + " (" + this.displayTabCount + ")" + this.suspendTitleList;
};

TabGroupsManager.GroupClass.prototype.dispHideTabCount = function (value)
{
  this.groupTab.hideTabCount = !value;
};

TabGroupsManager.GroupClass.prototype.dispHideGroupIcon = function (value)
{
  this.groupTab.hideIcon = !value;
};

TabGroupsManager.GroupClass.prototype.addTab = function (tab, fromSessionStore)
{
  try
  {
    if (typeof tab.group != "undefined" && tab.group == this)
    {
      return;
    }
    if (tab.tabGroupsManagerTabTree)
    {
      tab.tabGroupsManagerTabTree.removeTabFromTree(false);
    }
    if (tab.group != null)
    {
      tab.group.removeTab(tab);
    }
    if (TabGroupsManager.session.groupRestored >= 2 && !fromSessionStore)
    {
      TabGroupsManager.session.sessionStore.setTabValue(tab, "TabGroupsManagerGroupId", this.id.toString());
      TabGroupsManager.session.sessionStore.setTabValue(tab, "TabGroupsManagerGroupName", this.name);
      if ("TMP_TabGroupsManager" in window)
      {
        TabmixSessionManager.updateTabProp(tab);
      }
    }
    if (this.suspended)
    {
      this.addTabToSuspendArray(tab);
    }
    else
    {
      this.addTabToTabArray(tab, fromSessionStore);
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupClass.prototype.addTabToTabArray = function (tab, fromSessionStore)
{
  try
  {
    let [firstTab, lastTab] = this.getFirstLastTabInGroup();
    tab.group = this;
    this.tabArray.push(tab);
    this.dispGroupLabel();
    if (!TabGroupsManager.session.allTabsMovingToGroup)
    {
      if (TabGroupsManager.session.groupRestored < 2)
      {
        tab.tPosBak = tab._tPos;
      }
      else if (tab.tPosBak != null)
      {
        TabGroupsManager.tabMoveByTGM.moveTabTo(tab, tab.tPosBak);
        delete tab.tPosBak;
      }
      else
      {
        this.moveTabToLast(tab, firstTab, lastTab);
      }
      this.sortTabArrayByTPos();

      switch (this.selected)
      {
      case false:
        TabGroupsManager.utils.hideTab(tab);
        break;
      default:
        TabGroupsManager.utils.unHideTab(tab);
        break;
      }
    }
    tab.linkedBrowser.webProgress.addProgressListener(this.progressListener, Ci.nsIWebProgress.NOTIFY_STATE_NETWORK);
    this.displayGroupBusy();
    if (!this.selectedTab)
    {
      this.selectedTab = tab;
      if (this.selected)
      {
        gBrowser.selectedTab = tab;
      }
    }
    if (this.selected && ("TMP_TabGroupsManager" in window))
    {
      tab.collapsed = false;
      if (fromSessionStore)
      {
        gBrowser.mTabContainer.ensureTabIsVisible(this.selectedTab._tPos);
      }
    }
    if ("TreeStyleTabService" in window)
    {
      if (!fromSessionStore)
      {
        if (TreeStyleTabService.hasChildTabs(tab))
        {
          var _this = this;
          setTimeout(function ()
          {
            _this.addChildTabOfTST();
          }, 0, tab);
        }
      }
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupClass.prototype.addChildTabOfTST = function (parentTab)
{
  let tabList = TreeStyleTabService.getChildTabs(parentTab);
  for (let i = 0; i < tabList.length; i++)
  {
    parentTab.group.addTab(tabList[i]);
  }
};

TabGroupsManager.GroupClass.prototype.addTabToSuspendArray = function (tab)
{
  tab.group = this;
  this.suspendArray.push(TabGroupsManager.session.getTabStateEx(tab));
  this.suspendTitleList += "\n  " + tab.linkedBrowser.contentTitle;
  this.dispGroupLabel();
  if (this.suspendedTabIndex < 0)
  {
    this.suspendedTabIndex = 0;
  }
  tab.group = null;
  this.removeTabWithoutClosedTabsList(tab);
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
};

TabGroupsManager.GroupClass.prototype.dndMoveTabToGroup = function (tab)
{
  this.addTab(tab);
  if (this.displayTabCount == 1 && this.name == "")
  {
    this.autoRenameNameIcon(tab);
  }
};

TabGroupsManager.GroupClass.prototype.getNextTabWhenTabRemove = function (targetTab)
{
  switch (TabGroupsManager.preferences.focusTabWhenActiveTabClosed)
  {
  case 1:
    return this.getLeftRightTabInGroup(targetTab);
  case 2:
    return this.getFirstTabInGroup(targetTab);
  case 3:
    return this.getLastTabInGroup(targetTab);
  case 4:
    return this.getLatestSelectedTabInGroup(targetTab);
  case -1:
  case 0:
  default:
    return this.getRightLeftTabInGroup(targetTab);
  }
};

TabGroupsManager.GroupClass.prototype.getNextTabInGroup = function (targetTab)
{
  if (this.tabArray.length > 1)
  {
    for (var tab = targetTab.nextSibling; tab; tab = tab.nextSibling)
    {
      if (tab.group == targetTab.group)
      {
        return tab;
      }
    }
  }
  return null;
};

TabGroupsManager.GroupClass.prototype.getPreviousTabInGroup = function (targetTab)
{
  if (this.tabArray.length > 1)
  {
    for (var tab = targetTab.previousSibling; tab; tab = tab.previousSibling)
    {
      if (tab.group == targetTab.group)
      {
        return tab;
      }
    }
  }
  return null;
};

TabGroupsManager.GroupClass.prototype.getFirstTabInGroup = function (excludeTab)
{
  this.sortTabArrayByTPos();
  for (var i = 0; i < this.tabArray.length; i++)
  {
    if (this.tabArray[i] != excludeTab)
    {
      return this.tabArray[i];
    }
  }
  return null;
};

TabGroupsManager.GroupClass.prototype.getLastTabInGroup = function (excludeTab)
{
  this.sortTabArrayByTPos();
  for (var i = this.tabArray.length - 1; i >= 0; i--)
  {
    if (this.tabArray[i] != excludeTab)
    {
      return this.tabArray[i];
    }
  }
  return null;
};

TabGroupsManager.GroupClass.prototype.getLatestSelectedTabInGroup = function (targetTab)
{
  this.sortTabArrayByTPos();
  let targetIndex = this.tabArray.indexOf(targetTab);
  let latestTime = -1;
  let latestIndex = -1;
  for (let i = targetIndex + 1; i < this.tabArray.length; i++)
  {
    let time = this.tabArray[i].tgmSelectedTime || 0;
    if (time > latestTime)
    {
      latestTime = time;
      latestIndex = i;
    }
  }
  for (let i = targetIndex - 1; i >= 0; i--)
  {
    let time = this.tabArray[i].tgmSelectedTime || 0;
    if (time > latestTime)
    {
      latestTime = time;
      latestIndex = i;
    }
  }
  return this.tabArray[latestIndex];
};

TabGroupsManager.GroupClass.prototype.getFirstLastTabInGroup = function ()
{
  this.sortTabArrayByTPos();
  return [this.tabArray[0], this.tabArray[this.tabArray.length - 1]];
};

TabGroupsManager.GroupClass.prototype.getLast2TabInGroup = function ()
{
  this.sortTabArrayByTPos();
  return (this.tabArray.length > 1) ? this.tabArray[this.tabArray.length - 2] : null;
};

TabGroupsManager.GroupClass.prototype.getRightLeftTabInGroup = function (targetTab)
{
  var tab = this.getNextTabInGroup(targetTab);
  return tab ? tab : this.getPreviousTabInGroup(targetTab);
};

TabGroupsManager.GroupClass.prototype.getLeftRightTabInGroup = function (targetTab)
{
  var tab = this.getPreviousTabInGroup(targetTab);
  return tab ? tab : this.getNextTabInGroup(targetTab);
};

TabGroupsManager.GroupClass.prototype.getRightLoopTabInGroup = function (targetTab)
{
  var tab = this.getNextTabInGroup(targetTab);
  return tab ? tab : this.getFirstTabInGroup(targetTab);
};

TabGroupsManager.GroupClass.prototype.getLeftLoopTabInGroup = function (targetTab)
{
  var tab = this.getPreviousTabInGroup(targetTab);
  return tab ? tab : this.getLastTabInGroup(targetTab);
};

TabGroupsManager.GroupClass.prototype.selectRightLoopTabInGroup = function ()
{
  var newSelectedTab = this.getRightLoopTabInGroup(this.selectedTab);
  if (newSelectedTab)
  {
    this.selectedTab = newSelectedTab;
  }
};

TabGroupsManager.GroupClass.prototype.selectLeftLoopTabInGroup = function ()
{
  var newSelectedTab = this.getLeftLoopTabInGroup(this.selectedTab);
  if (newSelectedTab)
  {
    this.selectedTab = newSelectedTab;
  }
};

TabGroupsManager.GroupClass.prototype.selectLastTabInGroup = function ()
{
  this.sortTabArrayByTPos();
  this.selectedTab = this.tabArray[this.tabArray.length - 1];
};

TabGroupsManager.GroupClass.prototype.selectNthTabInGroup = function (n)
{
  this.sortTabArrayByTPos();
  if (this.tabArray.length > n)
  {
    this.selectedTab = this.tabArray[n];
  }
};

TabGroupsManager.GroupClass.prototype.moveTabToLast = function (tab, firstTab, lastTab)
{
  if (lastTab == null)
  {
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab, gBrowser.mTabContainer.childNodes.length - 1);
  }
  else if (tab._tPos < firstTab._tPos)
  {
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab, lastTab._tPos);
  }
  else if (tab._tPos > lastTab._tPos + 1)
  {
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab, lastTab._tPos + 1);
  }
  else if (!("TreeStyleTabService" in window))
  {
    let pos = (tab._tPos < lastTab._tPos) ? lastTab._tPos : lastTab._tPos + 1;
    TabGroupsManager.tabMoveByTGM.moveTabToWithoutTST(tab, pos);
  }
};

TabGroupsManager.GroupClass.prototype.makeDummyTab = function ()
{
  let dummyTab = TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank");
  var _this = this;
  setTimeout(function ()
  {
    _this.removeDummyTab();
  }, 0, dummyTab);
  return dummyTab;
};

TabGroupsManager.GroupClass.prototype.removeDummyTab = function (dummyTab)
{
  if (dummyTab && dummyTab.group && dummyTab.group.tabArray.length > 1 && TabGroupsManager.utils.isBlankTab(dummyTab))
  {
    gBrowser.removeTab(dummyTab);
  }
};

TabGroupsManager.GroupClass.prototype.removeTab = function (tab, fromTabCloseEvent, notClose)
{
  if (tab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag)
  {
    delete tab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag;
  }
  else if (! TabGroupsManagerJsm.privateBrowsing.enteringOrExiting &&
           this.tabArray.length <= 1 &&
           TabGroupsManager.preferences.groupNotCloseWhenCloseAllTabsInGroup &&
           fromTabCloseEvent)
  {
    this.addTab(("TMP_BrowserOpenTab" in window) ? TMP_BrowserOpenTab(null, true) : TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank"));
  }
  if (this.tabArray.length <= 1 && ! notClose)
  {
    if (TabGroupsManager.allGroups.childNodes.length == 1)
    {
      var group = TabGroupsManager.allGroups.openNewGroup(null, null, null, null, "TMP_BrowserOpenTab");
      TabGroupsManager.allGroups.selectedGroup = group;
    }
    else if (this.selected && ! TabGroupsManager.session.sessionRestoring)
    {
      TabGroupsManager.allGroups.selectNextGroup();
    }
    this.unlinkTab(tab);
    if (TabGroupsManager.session.allTabsMovingToGroup && this.id == -1)
    {
      this.selectedTab = null;
    }
    else
    {
      this.close();
    }
  }
  else
  { //for startup allow select tab only if group is in status restored to prevent 2 loaded tabs in group
    if (this.selectedTab == tab && TabGroupsManager.session.groupRestored == 2)
    {
      this._selectedTab = this.getNextTabWhenTabRemove(tab);
      if (this.selected && this._selectedTab && TabGroupsManager.preferences.focusTabWhenActiveTabClosed != -1)
      {
        gBrowser.selectedTab = this._selectedTab;
      }
    }
    if (this.selected)
    {
      if ("TMP_TabGroupsManager" in window)
      {
        TMP_eventListener.onTabClose_updateTabBar(tab);
      }
    }
    this.unlinkTab(tab);
    this.dispGroupLabel();
    this.displayGroupBusy();
  }
};

TabGroupsManager.GroupClass.prototype.unlinkTab = function (tab, notDeleteFromTabArray)
{
  if (tab.group != this)
  {
    return;
  }
  try
  {
    tab.linkedBrowser.removeProgressListener(this.progressListener);
  }
  catch (e)
  {}
  if (notDeleteFromTabArray != true)
  {
    this.tabArray.splice(this.tabArray.indexOf(tab), 1);
  }
  tab.group = null;
};

TabGroupsManager.GroupClass.prototype.deleteBlankTab = function ()
{
  return;
};

TabGroupsManager.GroupClass.prototype.renameDialog = function ()
{
  let oldName = this.name;
  let oldIcon = this.image;
  let data = {
    "name": oldName,
    "image": oldIcon
  };
  window.openDialog("chrome://tabgroupsmanager/content/GroupSettingsDialog.xul", "TabGroupsManagerGroupSettingsDialog", "chrome,modal,dialog,centerscreen,resizable", data);
  if (data.name != null)
  {
    this.renameByText(data.name);
  }
  if (data.image != null)
  {
    this.image = data.image;
  }
};

TabGroupsManager.GroupClass.prototype.changeIconFromLocal = function (event)
{
  this.image = event.target.image;
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
};

TabGroupsManager.GroupClass.prototype.renameByText = function (text)
{
  if (text)
  {
    this.name = text;
    TabGroupsManagerJsm.globalPreferences.addGroupNameHistory(text);
    this.disableAutoRename = true;
  }
};

TabGroupsManager.GroupClass.prototype.disableAutoRenameByTimer = function ()
{
  if (TabGroupsManager.preferences.autoRenameDisableTime > 0)
  {
    clearTimeout(this.autoRenameDisableTimer);
    var _this = this;
    this.disableAutoRenameTimer = setTimeout(function ()
    {
      _this.autoRenameDisableTimer = null;
      _this.disableAutoRename = true;
    }, TabGroupsManager.preferences.autoRenameDisableTime);
  }
};

TabGroupsManager.GroupClass.prototype.autoRenameNameIcon = function (tab)
{
  tab = tab || this.selectedTab;
  if (tab)
  {
    TabGroupsManager.allGroups.beginUpdate();
    this.image = tab.image;
    var tabTitle = tab.linkedBrowser.contentTitle;
    if (tabTitle != "")
    {
      this.autoRename(tabTitle);
    }
    else
    {
      TabGroupsManager.allGroups.saveAllGroupsData();
    }
    TabGroupsManager.allGroups.endUpdate();
    this.disableAutoRenameByTimer();
  }
};

TabGroupsManager.GroupClass.prototype.autoRenameNameOnly = function ()
{
  if (this.selectedTab)
  {
    var tabTitle = this.selectedTab.linkedBrowser.contentTitle;
    if (tabTitle != "")
    {
      this.autoRename(tabTitle);
      this.disableAutoRenameByTimer();
    }
  }
};

TabGroupsManager.GroupClass.prototype.autoRenameIconOnly = function ()
{
  if (this.selectedTab)
  {
    this.image = this.selectedTab.image;
    this.disableAutoRenameByTimer();
  }
};

TabGroupsManager.GroupClass.prototype.autoRenameDisable = function (event)
{
  this.disableAutoRename = event.target.hasAttribute("checked");
};

TabGroupsManager.GroupClass.prototype.autoRename = function (input)
{
  var splitInput = input.split(TabGroupsManager.titleSplitRegExp);
  for (var i = splitInput.length - 1; i >= 0; i--)
  {
    if (splitInput[i] == "")
    {
      splitInput.splice(i, 1);
    }
  }
  if (splitInput.length == 0)
  {
    this.autoRenameBak = null;
    this.autoRenameIndex = -1;
    return;
  }
  if (this.autoRenameBak != input)
  {
    this.autoRenameBak = input;
    this.autoRenameIndex = -1;
    this.name = input;
  }
  else
  {
    this.autoRenameIndex++;
    if (this.autoRenameIndex == splitInput.length)
    {
      this.autoRenameIndex = -1;
      this.name = input;
    }
    else
    {
      this.autoRenameIndex = this.autoRenameIndex % splitInput.length;
      this.name = splitInput[this.autoRenameIndex];
    }
  }
};

TabGroupsManager.GroupClass.prototype.closeAllTabsAndGroup = function ()
{
  if (!this.checkProtectedOfTabMixPlus(TabGroupsManager.strings.getString("ConfirmCloseGroupWhenTabProtected")))
  {
    return;
  }
  if (TabGroupsManagerJsm.privateBrowsing.enteringOrExiting)
  {
    this.close();
  }
  else
  {
    TabGroupsManager.closedGroups.addGroup(this.getGroupDataWithAllTabs(), this);
  }
};

TabGroupsManager.GroupClass.prototype.sleepGroup = function ()
{
  if (!this.checkProtectedOfTabMixPlus(TabGroupsManager.strings.getString("ConfirmSleepGroupWhenTabProtected")))
  {
    return;
  }
  TabGroupsManager.sleepingGroups.addGroup(this.getGroupDataWithAllTabs(), this);
};

TabGroupsManager.GroupClass.prototype.suspendToggle = function (event)
{
  this.suspended = event.target.hasAttribute("checked");
};

TabGroupsManager.GroupClass.prototype.suspendGroup = function (notConfirm)
{
  try
  {
    if (this.suspended || 1 >= TabGroupsManager.allGroups.countNonSuspendedGroups())
    {
      return true;
    }
    this.reassignGroupIdFromMinus2();
    let confirmResult = notConfirm ? false : null;
    if (this.checkProtectedOfTabMixPlus(TabGroupsManager.strings.getString("ConfirmSleepGroupWhenTabProtected"), confirmResult))
    {
      if (this.selected)
      {
        TabGroupsManager.allGroups.selectNextGroup();
      }
      this.sortTabArrayByTPos();
      this.suspendTitleList = "";
      this.suspendArray = new Array();
      for (var i = 0; i < this.tabArray.length; i++)
      {
        this.suspendTitleList += "\n  " + this.tabArray[i].linkedBrowser.contentTitle;
        this.suspendArray.push(TabGroupsManager.session.getTabStateEx(this.tabArray[i]));
      }
      this.suspendedTabIndex = this.tabArray.indexOf(this.selectedTab);
      this.selectedTab = null;
      this.removeAllTabsWithoutClosedTabsList();
      this.groupTab.setAttribute("suspended", "true");
      if (TabGroupsManager.preferences.reduceSuspendGroup)
      {
        this.groupTab.reduce = true;
      }
      this.busy = false;
      this.unread = false;
      this.busyTabCount = 0;
      this._suspended = true;
      this.dispGroupLabel();
      TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
    }
    return true;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupClass.prototype.unsuspendGroup = function ()
{
  if (this._suspended)
  {
    this._suspended = false;
    this.groupTab.removeAttribute("suspended");
    this.groupTab.reduce = false;
    this.groupTab.minWidthWithReduce = TabGroupsManager.preferences.groupTabMinWidth;
    this.suspendTitleList = "";
    this.restoreTabs(this.suspendArray);
    this.suspendArray.splice(0);
    this.suspendArray = undefined;
    this.selectedTab = this.tabArray[Math.max(0, this.suspendedTabIndex)];
    TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  }
  return false;
};

TabGroupsManager.GroupClass.prototype.openTabInGroup = function ()
{
  TabGroupsManager.eventListener.tabOpenTarget = this;
  try
  {
    var tab = gBrowser.addTab.apply(gBrowser, arguments);
  }
  finally
  {
    TabGroupsManager.eventListener.tabOpenTarget = null;
  }
  return tab;
};

TabGroupsManager.GroupClass.prototype.duplicateTabsInGroup = function (oldTabArrayOriginal)
{
  let oldTabArray = oldTabArrayOriginal.slice();
  let newTabArray = new Array(oldTabArray.length);
  TabGroupsManager.session.disableOnSSTabRestoring = true;
  try
  {
    for (var i = 0; i < oldTabArray.length; i++)
    {
      newTabArray[i] = TabGroupsManager.session.duplicateTabEx(window, oldTabArray[i]);
    }
  }
  finally
  {
    TabGroupsManager.session.disableOnSSTabRestoring = false;
  }
  return newTabArray;
};

TabGroupsManager.GroupClass.prototype.restoreTabs = function (arrayOfTabs)
{
  try
  {
    let tabs = new Array(arrayOfTabs.length);
    for (let i = 0; i < arrayOfTabs.length; i++)
    {
      tabs[i] = TabGroupsManager.overrideMethod.gBrowserAddTab();
      this.addTab(tabs[i]);
    }
    for (let i = 0; i < arrayOfTabs.length; i++)
    {
      TabGroupsManager.session.sessionStore.setTabState(tabs[i], arrayOfTabs[i]);
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupClass.prototype.checkProtectedOfTabMixPlus = function (message, confirmResult)
{
  var protectedCount = 0;
  for (var i = 0; i < this.tabArray.length; i++)
  {
    protectedCount += this.tabArray[i].getAttribute("protected") ? 1 : 0;
  }
  if (protectedCount > 0)
  {
    if (confirmResult == null)
    {
      if (confirm(message.replace("%1", protectedCount)))
      {
        for (var i = 0; i < this.tabArray.length; i++)
        {
          this.tabArray[i].removeAttribute("protected");
        }
      }
      else
      {
        return false;
      }
    }
    else
    {
      return confirmResult;
    }
  }
  return true;
};

TabGroupsManager.GroupClass.prototype.removeAllProgressListener = function ()
{
  for (var i = 0; i < this.tabArray.length; i++)
  {
    try
    {
      this.tabArray[i].linkedBrowser.removeProgressListener(this.progressListener);
    }
    catch (e)
    {}
  }
};

TabGroupsManager.GroupClass.prototype.close = function ()
{
  let lastGroup = (TabGroupsManager.allGroups.childNodes.length == 1);
  if (lastGroup)
  {
    TabGroupsManager.allGroups.openNewGroup();
  }
  if (this.selected && ! TabGroupsManager.session.sessionRestoring)
  {
    TabGroupsManager.allGroups.selectNextGroup();
  }
  this.removeAllTabsWithoutClosedTabsList();
  if (this.groupTab.parentNode)
  {
    this.groupTab.parentNode.removeChild(this.groupTab);
    var arrowScrollBox = document.getElementById("TabGroupsManagerGroupBarScrollbox");
    setTimeout(function ()
    {
      arrowScrollBox.scrollByPixels(-1);
      arrowScrollBox.scrollByPixels(1);
    }, 0);
    TabGroupsManager.allGroups.saveAllGroupsData();
  }
  if (lastGroup &&
      TabGroupsManagerJsm.applicationStatus.windows.length > 1 &&
      TabGroupsManagerJsm.globalPreferences.windowCloseWhenLastGroupClose)
  {
    window.close();
  }
  else
  {
    TabGroupsManager.groupBarDispHide.hideGroupBarByGroupCount();
  }
};

TabGroupsManager.GroupClass.prototype.removeTabWithoutClosedTabsList = function (tab)
{
  let closedTabsJson = TabGroupsManager.session.sessionStore.getClosedTabData(window);
  gBrowser.removeTab(tab);
  TabGroupsManager.session.setClosedTabJson(closedTabsJson);
};

TabGroupsManager.GroupClass.prototype.removeAllTabsWithoutClosedTabsList = function ()
{
  if (this.tabArray.length <= 0)
  {
    return;
  }
  let closedTabsJson = TabGroupsManager.session.sessionStore.getClosedTabData(window);
  for (var i = 0; i < this.tabArray.length; i++)
  {
    this.unlinkTab(this.tabArray[i], true);
    gBrowser.removeTab(this.tabArray[i]);
  }
  this.tabArray.splice(0);
  TabGroupsManager.session.setClosedTabJson(closedTabsJson);
};

TabGroupsManager.GroupClass.prototype.initDefaultGroupAndModifyId = function ()
{
  if (this.id == -1)
  {
    this.id = TabGroupsManagerJsm.applicationStatus.makeNewId();
    for (var i = 0; i < this.tabArray.length; i++)
    {
      var tab = this.tabArray[i];
      var groupId = TabGroupsManager.session.getGroupId(tab);
      if (isNaN(groupId))
      {
        TabGroupsManager.session.sessionStore.setTabValue(tab, "TabGroupsManagerGroupId", this.id.toString());
        TabGroupsManager.session.sessionStore.setTabValue(tab, "TabGroupsManagerGroupName", this.name);
        if ("TMP_TabGroupsManager" in window)
        {
          TabmixSessionManager.updateTabProp(tab);
        }
      }
      else
      {
        TabGroupsManager.session.moveTabToGroupBySessionStore(tab);
      }
    }
    TabGroupsManager.allGroups.saveAllGroupsData();
  }
};

TabGroupsManager.GroupClass.prototype.getGroupDataBase = function ()
{
  var groupData = {
    type: TabGroupsManagerJsm.constValues.groupDataType,
    id: this.id,
    name: this.name,
    image: this.image,
    disableAutoRename: this.disableAutoRename
  };
  if (this.tabViewBounds)
  {
    groupData.tabViewBounds = {
      left: this.tabViewBounds.left,
      top: this.tabViewBounds.top,
      width: this.tabViewBounds.width,
      height: this.tabViewBounds.height
    };
  }
  return groupData;
};

TabGroupsManager.GroupClass.prototype.setGroupDataBase = function (groupData)
{
  this._disableAutoRename = groupData.disableAutoRename;
  if (groupData.tabViewBounds)
  {
    this.tabViewBounds = groupData.tabViewBounds;
  }
};

TabGroupsManager.GroupClass.prototype.getGroupDataWithoutTabs = function ()
{
  var groupData = this.getGroupDataBase();
  groupData.suspended = this.suspended;
  if (this.suspended)
  {
    groupData.suspendArray = JSON.stringify(this.suspendArray);
    groupData.suspendTitleList = this.suspendTitleList
  }
  return groupData;
};

TabGroupsManager.GroupClass.prototype.setGroupDataWithoutTabs = function (groupData)
{
  this.setGroupDataBase(groupData);
  this.suspended = groupData.suspended;
  if (groupData.suspended)
  {
    this.suspendedTabIndex = 0;
    if (groupData.suspendArray)
    {
      this.suspendArray = JSON.parse(groupData.suspendArray);
      this.suspendTitleList = groupData.suspendTitleList;
      this.dispGroupLabel();
    }
    TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
  }
};

TabGroupsManager.GroupClass.prototype.reassignGroupIdFromMinus2 = function ()
{
  if (this.id == -2)
  {
    this.id = TabGroupsManagerJsm.applicationStatus.makeNewId();
    for (var i = 0; i < this.tabArray.length; i++)
    {
      TabGroupsManager.session.sessionStore.setTabValue(this.tabArray[i], "TabGroupsManagerGroupId", this.id.toString());
      if ("TMP_TabGroupsManager" in window)
      {
        TabmixSessionManager.updateTabProp(this.tabArray[i]);
      }
    }
  }
};

TabGroupsManager.GroupClass.prototype.getGroupDataWithAllTabs = function ()
{
  this.reassignGroupIdFromMinus2();
  var groupData = this.getGroupDataBase();
  if (TabGroupsManager.preferences.groupRestoreOldPosition == true)
  {
    groupData.index = TabGroupsManager.allGroups.groupbar.getIndexOfItem(this.groupTab);
  }
  this.sortTabArrayByTPos();
  groupData.titleList = "";
  groupData.tabs = new Array();
  if (this.suspended)
  {
    for (var i = 0; i < this.suspendArray.length; i++)
    {
      groupData.tabs.push(this.suspendArray[i]);
    }
  }
  else
  {
    for (var i = 0; i < this.tabArray.length; i++)
    {
      groupData.titleList += this.tabArray[i].label + "\n";
      groupData.tabs.push(TabGroupsManager.session.getTabStateEx(this.tabArray[i]));
    }
  }
  return groupData;
};

TabGroupsManager.GroupClass.prototype.setGroupDataWithAllTabs = function (groupData, tabObject)
{
  this.setGroupDataBase(groupData);
  if (tabObject == null)
  {
    if (groupData.tabs && groupData.tabs.length)
    {
      this.restoreTabs(groupData.tabs);
    }
  }
  else
  {
    var tab = TabGroupsManager.overrideMethod.gBrowserAddTab();
    TabGroupsManager.session.sessionStore.setTabState(tab, tabObject);
  }
  if (TabGroupsManager.preferences.groupRestoreOldPosition == true && groupData.index != null && groupData.index < TabGroupsManager.allGroups.groupbar.childNodes.length)
  {
    TabGroupsManager.allGroups.changeGroupOrder(this, groupData.index);
  }
  TabGroupsManager.allGroups.saveAllGroupsDataImmediately();
};

TabGroupsManager.GroupClass.prototype.mouseCommand = function (no)
{
  switch (no)
  {
  case 1:
    this.sleepGroup();
    break;
  case 2:
    this.closeAllTabsAndGroup();
    break;
  case 5:
    this.suspended = !this.suspended;
    break;
  case 4:
    if (!this.disableAutoRename) this.autoRenameNameIcon();
    break;
  case 3:
    this.renameDialog();
    break;
  }
};

TabGroupsManager.GroupClass.prototype.bookmarkThisGroup = function ()
{
  var folderName = window.prompt(TabGroupsManager.strings.getString("EnterBookmarkFolderName"), this.name);
  if (folderName)
  {
    this.bookmarkThisGroupCore(folderName);
  }
};

TabGroupsManager.GroupClass.prototype.bookmarkThisGroupCore = function (folderName, parentFolder)
{
  var places = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
  if (!folderName)
  {
    folderName = this.name;
  }
  if (!parentFolder)
  {
    parentFolder = places.bookmarksMenuFolder;
  }
  var newFolderId = places.createFolder(parentFolder, folderName, places.DEFAULT_INDEX);
  if (this.suspended)
  {
    for (var i = 0; i < this.suspendArray.length; i++)
    {
      try
      {
        var tabData = JSON.parse(this.suspendArray[i]);
        if (tabData.index)
        {
          var uri = TabGroupsManager.utils.createNewNsiUri(tabData.entries[tabData.index - 1].url);
          var title = tabData.entries[tabData.index - 1].title;
          places.insertBookmark(newFolderId, uri, places.DEFAULT_INDEX, title);
        }
      }
      catch (e)
      {
        TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
      }
    }
  }
  else
  {
    this.sortTabArrayByTPos();
    for (var i = 0; i < this.tabArray.length; i++)
    {
      try
      {
        var uri = this.tabArray[i].linkedBrowser.currentURI;
        var title = this.tabArray[i].linkedBrowser.contentTitle;
        places.insertBookmark(newFolderId, uri, places.DEFAULT_INDEX, title);
      }
      catch (e)
      {
        TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
      }
    }
  }
};

TabGroupsManager.GroupClass.prototype.reloadTabsInGroup = function ()
{
  for (var i = 0; i < this.tabArray.length; i++)
  {
    var tab = this.tabArray[i];
    if (tab.linkedBrowser.currentURI.spec == "about:blank")
    {
      TabGroupsManager.session.disableOnSSTabRestoring = true;
      try
      {
        TabGroupsManager.session.sessionStore.setTabState(tab, TabGroupsManager.session.getTabStateEx(tab));
      }
      finally
      {
        TabGroupsManager.session.disableOnSSTabRestoring = false;
      }
    }
    else
    {
      tab.linkedBrowser.reload();
    }
  }
};

TabGroupsManager.GroupClass.prototype.isBlank = function ()
{
  if (this.suspended)
  {
    return false;
  }
  if (this.name == "" ||
    this.name == TabGroupsManager.strings.getString("StartGroupName") ||
    this.name == TabGroupsManager.strings.getString("ExtAppGroupName") ||
    this.name == TabGroupsManager.strings.getString("HomeGroupName")
  )
  {
    for (var i = 0; i < this.tabArray.length; i++)
    {
      if (!TabGroupsManager.utils.isBlankTab(this.tabArray[i]))
      {
        return false;
      }
    }
    return true;
  }
  return false;
};

TabGroupsManager.GroupClass.prototype.getFirstTabVisible = function ()
{
  let index;
  if (window.getComputedStyle(gBrowser.mTabContainer.parentNode, null).direction == "rtl" && !gBrowser.mTabContainer.hasAttribute("multibar"))
  {
    var lastTab = this.getLastTabInGroup();
    if (!lastTab || !gBrowser.mTabContainer.lastChild.group)
    {
      lastTab = gBrowser.mTabContainer.lastChild;
    }
    index = lastTab._tPos;
  }
  else
  {
    var firstTab = this.getFirstTabInGroup();
    if (!firstTab || !gBrowser.mTabContainer.firstChild.group)
    {
      firstTab = gBrowser.mTabContainer.firstChild;
    }
    index = firstTab._tPos;
  }
  return gBrowser.mTabContainer.isTabVisible(index);
};

TabGroupsManager.GroupClass.prototype.getLastTabVisible = function ()
{
  let index;
  if (window.getComputedStyle(gBrowser.mTabContainer.parentNode, null).direction == "rtl" && !gBrowser.mTabContainer.hasAttribute("multibar"))
  {
    var firstTab = this.getFirstTabInGroup();
    if (!firstTab || !gBrowser.mTabContainer.firstChild.group)
    {
      firstTab = gBrowser.mTabContainer.firstChild;
    }
    index = firstTab._tPos;
  }
  else
  {
    var lastTab = this.getLastTabInGroup();
    if (!lastTab || !gBrowser.mTabContainer.lastChild.group)
    {
      lastTab = gBrowser.mTabContainer.lastChild;
    }
    index = lastTab._tPos;
  }
  return gBrowser.mTabContainer.isTabVisible(index);
};

TabGroupsManager.GroupClass.prototype.duplicateGroup = function ()
{
  try
  {
    var newGroup = TabGroupsManager.allGroups.openNewGroupCore(null, this.name, this.image);
    newGroup._suspended = this._suspended;
    newGroup.suspendedTabIndex = this.suspendedTabIndex;
    newGroup.suspendTitleList = this.suspendTitleList;
    newGroup._disableAutoRename = this._disableAutoRename;
    newGroup.autoRenameBak = this.autoRenameBak;
    newGroup.autoRenameIndex = this.autoRenameIndex;
    newGroup.autoRenameDisableTimer = this.autoRenameDisableTimer;
    let newTabArray = this.duplicateTabsInGroup(this.tabArray);
    for (var i = 0; i < newTabArray.length; i++)
    {
      newGroup.addTab(newTabArray[i]);
      if (this.selectedTab == this.tabArray[i])
      {
        newGroup.selectedTab = newTabArray[i];
      }
    }
    if ("treeStyleTab" in gBrowser)
    {
      for (let i = 0; i < newTabArray.length; i++)
      {
        let parent = TreeStyleTabService.getParentTab(this.tabArray[i]);
        if (parent)
        {
          gBrowser.treeStyleTab.attachTabTo(newTabArray[i], newTabArray[this.tabArray.indexOf(parent)]);
        }
      }
    }
    if (this.suspended)
    {
      newGroup.suspendArray = new Array();
      for (var i = 0; i < this.suspendArray.length; i++)
      {
        var object = JSON.parse(this.suspendArray[i]);
        object.extData.TabGroupsManagerGroupId = newGroup.id;
        newGroup.suspendArray.push(JSON.stringify(object));
      }
    }
    newGroup.relateGroupTab(newGroup.groupTab);
    TabGroupsManager.allGroups.saveAllGroupsData();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return newGroup;
};

TabGroupsManager.GroupClass.prototype.exportGroup = function ()
{
  let nsIFilePicker = Ci.nsIFilePicker;
  let filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  filePicker.init(window, null, nsIFilePicker.modeSave);
  filePicker.appendFilter(TabGroupsManager.strings.getString("GroupDataExtDescription") + "(*." + TabGroupsManagerJsm.constValues.groupDataExt + ")", "*." + TabGroupsManagerJsm.constValues.groupDataExt);
  filePicker.appendFilters(nsIFilePicker.filterAll);
  filePicker.defaultString = this.name + "." + TabGroupsManagerJsm.constValues.groupDataExt;
  filePicker.defaultExtension = TabGroupsManagerJsm.constValues.groupDataExt;
  switch (filePicker.show())
  {
  case nsIFilePicker.returnOK:
  case nsIFilePicker.returnReplace:
    let file = new TabGroupsManagerJsm.NsIFileWrapper(filePicker.file);
    file.writeFileAsText(JSON.stringify(this.getGroupDataWithAllTabs()));
    break;
  }
};
