/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.AllGroups = function()
{
  try
  {
    this.updating = false;
    this.saveAllGroupsDataTimer = null;
    this.saveAllGroupsDataTimeout = 100;
    this.__defineGetter__("groupbar", function()
    {
      return document.getElementById("TabGroupsManagerGroupbar");
    });
    this.__defineGetter__("childNodes", function()
    {
      return this.groupbar.childNodes;
    });
    this.__defineGetter__("firstChild", function()
    {
      return this.groupbar.firstChild;
    });
    this.__defineGetter__("lastChild", function()
    {
      return this.groupbar.lastChild;
    });
    this.__defineGetter__("selectedGroup", this.getSelectedGroup);
    this.__defineSetter__("selectedGroup", this.setSelectedGroup);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.AllGroups.prototype.getSelectedGroup = function()
{
  return this.groupbar.selectedItem.group;
};

TabGroupsManager.AllGroups.prototype.setSelectedGroup = function(value)
{
  this.groupbar.selectedItem = value.groupTab;
};

TabGroupsManager.AllGroups.prototype.selectNextGroup = function()
{
  var selectedIndex = this.groupbar.selectedIndex;
  for (var i = selectedIndex + 1; i < this.childNodes.length; i++)
  {
    if (!this.childNodes[i].group.suspended)
    {
      return this.groupbar.selectedItem = this.childNodes[i];
    }
  }
  for (var i = selectedIndex - 1; i >= 0; i--)
  {
    if (!this.childNodes[i].group.suspended)
    {
      return this.groupbar.selectedItem = this.childNodes[i];
    }
  }
  for (var i = selectedIndex + 1; i < this.childNodes.length; i++)
  {
    return this.groupbar.selectedItem = this.childNodes[i];
  }
  for (var i = selectedIndex - 1; i >= 0; i--)
  {
    return this.groupbar.selectedItem = this.childNodes[i];
  }
  return null;
};

TabGroupsManager.AllGroups.prototype.selectLeftGroup = function()
{
  this.groupbar.advanceSelectedTab(-1, true);
};

TabGroupsManager.AllGroups.prototype.selectRightGroup = function()
{
  this.groupbar.advanceSelectedTab(1, true);
};

TabGroupsManager.AllGroups.prototype.selectLastGroup = function()
{
  this.childNodes[this.childNodes.length - 1].group.setSelected();
};

TabGroupsManager.AllGroups.prototype.selectNthGroup = function(n)
{
  if (this.childNodes.length > n)
  {
    this.childNodes[n].group.setSelected();
  }
};

TabGroupsManager.AllGroups.prototype.getGroupById = function(id)
{
  var groupTab = document.getElementById("_group" + id);
  return groupTab ? groupTab.group : null;
};

TabGroupsManager.AllGroups.prototype.openNewGroup = function(tab, id, name, image, forTabMixPlus)
{
  var group = this.openNewGroupCore(id, name, image);
  if (!tab)
  {
    if (("TMP_BrowserOpenTab" in window) && forTabMixPlus == "TMP_BrowserOpenTab")
    {
      tab = TMP_BrowserOpenTab(null, true);
    }
    else
    {
      tab = TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank");
    }
  }
  group.addTab(tab);
  return group;
};

TabGroupsManager.AllGroups.prototype.openNewGroupActive = function(tab, id, name, image)
{
  var group = this.openNewGroup(tab, id, name, image);
  this.selectedGroup = group;
  return group;
};

TabGroupsManager.AllGroups.prototype.openNewGroupRename = function(tab, id, name, image)
{
  name = window.prompt(TabGroupsManager.strings.getString("RenameDialogMessage"), "");
  if (name !== null)
  {
    var group = this.openNewGroup(tab, id, name, image);
    TabGroupsManagerJsm.globalPreferences.addGroupNameHistory(name);
    group.disableAutoRename = true;
    return group;
  }
  return null;
};

TabGroupsManager.AllGroups.prototype.openNewGroupRenameActive = function(tab, id, name, image)
{
  var group = this.openNewGroupRename(tab, id, name, image);
  if (group)
  {
    this.selectedGroup = group;
  }
  return group;
};

TabGroupsManager.AllGroups.prototype.openNewGroupHome = function(tab, id, name, image)
{
  if (name == null)
  {
    name = TabGroupsManager.strings.getString("HomeGroupName");
  }
  var group = this.openNewGroup(tab, id, name, image);
  var browser = group.selectedTab.linkedBrowser;
  var homepageUri = gHomeButton.getHomePage().split("|")[0];
  browser.loadURI(homepageUri);
  return group;
};

TabGroupsManager.AllGroups.prototype.openNewGroupHomeActive = function(tab, id, name, image)
{
  var group = this.openNewGroupHome(tab, id, name, image);
  this.selectedGroup = group;
  return group;
};

TabGroupsManager.AllGroups.prototype.openNewGroupCore = function(id, name, image)
{
  var group = new TabGroupsManager.GroupClass(id, name, image);
  if (!this.groupbar.selectedItem)
  {
    this.selectedGroup = group;
  }
  document.getElementById("TabGroupsManagerGroupBarScrollbox").ensureElementIsVisible(group.groupTab);
  return group;
};

TabGroupsManager.AllGroups.prototype.sleepActiveGroup = function()
{
  this.selectedGroup.sleepGroup();
};

TabGroupsManager.AllGroups.prototype.closeActiveGroup = function()
{
  this.selectedGroup.closeAllTabsAndGroup();
};

TabGroupsManager.AllGroups.prototype.suspendActiveGroup = function()
{
  this.selectedGroup.suspendGroup();
};

TabGroupsManager.AllGroups.prototype.saveAllGroupsDataTimerChancel = function()
{
  if (this.saveAllGroupsDataTimer != null)
  {
    clearTimeout(this.saveAllGroupsDataTimer);
    this.saveAllGroupsDataTimer = null;
  }
};

TabGroupsManager.AllGroups.prototype.saveAllGroupsData = function()
{
  this.saveAllGroupsDataTimerChancel();
  if (TabGroupsManager.session.groupRestored < 2 || this.updating == true)
  {
    return;
  }
  var _this = this;
  this.saveAllGroupsDataTimer = setTimeout(function ()
  {
    _this.saveAllGroupsDataImmediately();
  }, this.saveAllGroupsDataTimeout, this);
};

TabGroupsManager.AllGroups.prototype.saveAllGroupsDataImmediately = function(_this)
{
  /*SSTabRestoring fires on every tab restoring -> so let us save data only if groups are in status restored         */
  /*in other case we will fetch data from the groups but the restore is still in progress and datas are not complete */
  /*so we lost our extData due the async stuff in sessionstore with fx > 29                                          */
  if (TabGroupsManager.session.groupRestored == 2)
  {
    if (_this == null)
    {
      _this = this;
    }
    _this.saveAllGroupsDataTimerChancel();
    var allGroupsData = {};
    allGroupsData.groups = new Array();
    for (var i = 0; i < _this.childNodes.length; i++)
    {
      allGroupsData.groups.push(_this.childNodes[i].group.getGroupDataWithoutTabs());
    }
    let jsonText = JSON.stringify(allGroupsData);
    try
    {
      TabGroupsManager.session.sessionStore.setWindowValue(window, "TabGroupsManagerAllGroupsData", jsonText);
    }
    catch (e)
    {
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
    if (("TMP_TabGroupsManager" in window) && ("saveAllGroupsData" in window.TabmixSessionManager))
    {
      TabmixSessionManager.saveAllGroupsData(jsonText);
    }
  }
};

TabGroupsManager.AllGroups.prototype.beginUpdate = function()
{
  this.updating = true;
  setTimeout(function (_this)
  {
    _this.endUpdateByTimer();
  }, 0, this);
};

TabGroupsManager.AllGroups.prototype.endUpdate = function()
{
  this.updating = false;
  this.saveAllGroupsData();
};

TabGroupsManager.AllGroups.prototype.endUpdateByTimer = function()
{
  if (this.updating)
  {
    this.endUpdate();
  }
};

TabGroupsManager.AllGroups.prototype.loadAllGroupsData = function()
{
  TabGroupsManager.session.groupRestored = 1;
  try
  {
    try
    {
      let jsonText = TabGroupsManager.session.sessionStore.getWindowValue(window, "TabGroupsManagerAllGroupsData");
      if (jsonText != null && jsonText != "")
      {
        var allGroupsData = JSON.parse(jsonText);
        for (var i = 0; i < allGroupsData.groups.length; i++)
        {
          var groupData = allGroupsData.groups[i];
          if (!this.getGroupById(groupData.id))
          {
            var group = this.openNewGroupCore(groupData.id, groupData.name, groupData.image);
            group.setGroupDataWithoutTabs(groupData);
          }
        }
      }
    }
    catch (e)
    {
      //show errors as window is not tracked during startup caused by small
      //delay on initialisation > Fx33
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
    if (TabGroupsManager.session.sessionRestoring)
    {
      //Seriously, this being set seems to imply the preferences menu is open..
      if (TabGroupsManagerJsm.globalPreferences.lastSessionFinalized)
      {
        //TabGroupsManager.session.allTabsMoveToGroup();
      }
    }
    else
    {
      TabGroupsManager.allGroups.selectedGroup.initDefaultGroupAndModifyId();
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.session.groupRestored = 2;
  }
};

TabGroupsManager.AllGroups.prototype.dispHideAllGroupIcon = function()
{
  var value = TabGroupsManager.preferences.dispGroupTabIcon;
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].group.dispHideGroupIcon(value);
  }
};

TabGroupsManager.AllGroups.prototype.dispHideAllGroupTabCount = function()
{
  var value = TabGroupsManager.preferences.dispGroupTabCount;
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].group.dispHideTabCount(value);
  }
};

TabGroupsManager.AllGroups.prototype.dispAllGroupLabel = function()
{
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].group.dispGroupLabel();
  }
};

TabGroupsManager.AllGroups.prototype.mouseCommand = function(no)
{
  switch (no & 255)
  {
  case 1:
    TabGroupsManager.command.OpenNewGroup();
    break;
  case 6:
    TabGroupsManager.command.OpenNewGroupActive();
    break;
  case 7:
    TabGroupsManager.command.OpenNewGroupRename();
    break;
  case 8:
    TabGroupsManager.command.OpenNewGroupRenameActive();
    break;
  case 9:
    TabGroupsManager.command.OpenNewGroupHome();
    break;
  case 10:
    TabGroupsManager.command.OpenNewGroupHomeActive();
    break;
  case 2:
    TabGroupsManager.command.SleepActiveGroup();
    break;
  case 3:
    TabGroupsManager.command.CloseActiveGroup();
    break;
  case 11:
    TabGroupsManager.command.SuspendActiveGroup();
    break;
  case 4:
    TabGroupsManager.command.RestoreLatestSleepedGroup();
    break;
  case 5:
    TabGroupsManager.command.RestoreLatestClosedGroup();
    break;
  }
};

TabGroupsManager.AllGroups.prototype.setMinWidthAllGroup = function()
{
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].minWidthWithReduce = TabGroupsManager.preferences.groupTabMinWidth;
  }
};

TabGroupsManager.AllGroups.prototype.setMaxWidthAllGroup = function()
{
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].maxWidth = TabGroupsManager.preferences.groupTabMaxWidth;
  }
};

TabGroupsManager.AllGroups.prototype.setReduceAllGroup = function()
{
  for (var i = 0; i < this.childNodes.length; i++)
  {
    if (this.childNodes[i].group.suspended)
    {
      this.childNodes[i].group.groupTab.reduce = TabGroupsManager.preferences.reduceSuspendGroup;
    }
  }
};

TabGroupsManager.AllGroups.prototype.setCropAllGroup = function()
{
  const GroupTabCropString = ["none", "start", "end", "center"];
  var value = GroupTabCropString[TabGroupsManager.preferences.groupTabCrop];
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].group.groupTab.setAttribute("crop", value);
  }
};

TabGroupsManager.AllGroups.prototype.scrollInActiveGroup = function(smooth)
{
  var scrollbox = document.getElementById("TabGroupsManagerGroupBarScrollbox");
  if (smooth || !scrollbox.smoothScroll)
  {
    scrollbox.ensureElementIsVisible(this.selectedGroup.groupTab);
  }
  else
  {
    scrollbox.smoothScroll = false;
    scrollbox.ensureElementIsVisible(this.selectedGroup.groupTab);
    scrollbox.smoothScroll = true;
  }
};

TabGroupsManager.AllGroups.prototype.changeGroupOrderInsertBefore = function(srcGroup, dstIndex, isCopy)
{
  if (isCopy)
  {
    srcGroup = srcGroup.duplicateGroup();
  }
  var srcIndex = srcGroup.groupTab.parentNode.getIndexOfItem(srcGroup.groupTab);
  if (dstIndex == null || dstIndex >= this.childNodes.length)
  {
    dstIndex = this.childNodes.length - 1;
  }
  else if (dstIndex < 0)
  {
    dstIndex = 0;
  }
  else if (srcIndex < dstIndex)
  {
    dstIndex--;
  }
  return this.changeGroupOrder(srcGroup, dstIndex);
};

TabGroupsManager.AllGroups.prototype.changeGroupOrder = function(srcGroup, dstIndex)
{
  var srcIndex = srcGroup.groupTab.parentNode.getIndexOfItem(srcGroup.groupTab);
  if (srcIndex == dstIndex)
  {
    return false;
  }
  var selectedIndex = this.groupbar.selectedIndex;
  var dir = (srcIndex < dstIndex) ? +1 : -1;
  var newSelectedIndex = -1;
  var i;
  for (i = srcIndex; i != dstIndex; i += dir)
  {
    this.childNodes[i + dir].group.relateGroupTab(this.childNodes[i]);
    if (selectedIndex == i + dir)
    {
      newSelectedIndex = i;
    }
  }
  srcGroup.relateGroupTab(this.childNodes[i]);
  if (selectedIndex == srcIndex)
  {
    newSelectedIndex = i;
  }
  if (newSelectedIndex != -1)
  {
    this.groupbar.selectedIndex = newSelectedIndex;
  }
  TabGroupsManager.allGroups.saveAllGroupsData();
  return true;
};

TabGroupsManager.AllGroups.prototype.bookmarkAllGroups = function()
{
  var folderName = window.prompt(TabGroupsManager.strings.getString("EnterBookmarkFolderName"), "");
  if (folderName)
  {
    this.bookmarkAllGroupsCore(folderName)
  }
};

TabGroupsManager.AllGroups.prototype.bookmarkAllGroupsCore = function(folderName, parentFolder)
{
  var places = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
  if (!parentFolder)
  {
    parentFolder = places.bookmarksMenuFolder;
  }
  var newFolderId = places.createFolder(parentFolder, folderName, places.DEFAULT_INDEX);
  for (var i = 0; i < this.childNodes.length; i++)
  {
    this.childNodes[i].group.bookmarkThisGroupCore(null, newFolderId);
  }
  var sleepingFolderId = places.createFolder(newFolderId, "+ Hibernated Groups", places.DEFAULT_INDEX);
  TabGroupsManager.sleepingGroups.bookmarkAllStoredGroup(sleepingFolderId);
};

TabGroupsManager.AllGroups.prototype.listMoveGroup = function()
{
  var groupArray = new Array();
  for (var i = 0; i < this.childNodes.length; i++)
  {
    var groupTab = this.childNodes[i];
    if (!groupTab.group.isBlank())
    {
      groupArray.push(groupTab);
    }
  }
  return groupArray;
};

TabGroupsManager.AllGroups.prototype.moveAllGroupsToMainWindow = function()
{
  var groupArray = this.listMoveGroup();
  var targetWindow = TabGroupsManagerJsm.applicationStatus.searchMainWindow(window);
  for (var i = 0; i < groupArray.length; i++)
  {
    targetWindow.TabGroupsManager.allGroups.moveGroupToOtherWindow(groupArray[i], null, false);
  }
};

TabGroupsManager.AllGroups.prototype.moveGroupToSameWindow = function(groupTab, event, isCopy)
{
  if (groupTab == event.target && !isCopy)
  {
    return false;
  }
  var dropGroupIndex = TabGroupsManager.allGroups.groupbar.getIndexOfItem(event.target);
  dropGroupIndex += TabGroupsManager.allGroups.dropPositionIsRight(groupTab, event.target, event.clientX);
  return TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group, dropGroupIndex, isCopy);
};

TabGroupsManager.AllGroups.prototype.makeNewTabAndSwapWithOtherWindow = function(newGroup, fromTab)
{
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank");
  newTab.linkedBrowser.stop();
  gBrowser.swapBrowsersAndCloseOther(newTab, fromTab);
  newGroup.dndMoveTabToGroup(newTab);
  return newTab;
};

TabGroupsManager.AllGroups.prototype.moveGroupToOtherWindow = function(fromGroupTab, event, isCopy)
{
  var fromGroup = fromGroupTab.group;
  var fromWindow = fromGroupTab.ownerDocument.defaultView;
  if (isCopy)
  {
    fromGroup = fromGroup.duplicateGroup();
  }
  fromGroup.sortTabArrayByTPos();
  var tabArray = fromGroup.tabArray.slice(0);
  var selectedTab = fromGroup.selectedTab;
  if (fromGroup.selected)
  {
    if (fromWindow.TabGroupsManager.allGroups.childNodes.length > 1)
    {
      fromWindow.TabGroupsManager.allGroups.selectNextGroup();
    }
    else
    {
      fromWindow.gBrowser.selectedTab = fromGroup.tabArray[fromGroup.tabArray.length - 1];
    }
  }
  var newGroup = TabGroupsManager.allGroups.openNewGroupCore(fromGroup.id, fromGroup.name, fromGroup.image);
  newGroup.setGroupDataWithoutTabs(fromGroup.getGroupDataWithoutTabs());
  for (var i = 0; i < tabArray.length; i++)
  {
    var fromTab = tabArray[i];
    var newTab = this.makeNewTabAndSwapWithOtherWindow(newGroup, fromTab);
    if (selectedTab == fromTab)
    {
      newGroup.selectedTab = newTab;
    }
  }
  var sessionSaved = false;
  var groupBar = newGroup.groupTab.parentNode;
  if (event != null)
  {
    var dropGroupIndex = 0;
    if (event !== 0)
    {
      var dropGroupIndex = groupBar.getIndexOfItem(event.target);
      dropGroupIndex += TabGroupsManager.allGroups.dropPositionIsRight(newGroup.groupTab, event.target, event.clientX, true);
    }
    sessionSaved = TabGroupsManager.allGroups.changeGroupOrderInsertBefore(newGroup, dropGroupIndex)
  }
  if (fromWindow.TabGroupsManager && fromGroup.groupTab.label != null)
  {
    fromGroup.close();
  }
  if (!sessionSaved)
  {
    this.saveAllGroupsData();
  }
  return newGroup;
};

TabGroupsManager.AllGroups.prototype.dropPositionX = function(sourceTab, targetTab, clientX)
{
  var left = targetTab.getBoundingClientRect().left;
  var right = targetTab.getBoundingClientRect().right;
  if (sourceTab && sourceTab.parentNode == targetTab.parentNode)
  {
    if (left == sourceTab.getBoundingClientRect().right)
    {
      return right;
    }
    else if (right == sourceTab.getBoundingClientRect().left)
    {
      return left;
    }
  }
  return (clientX < ((left + right) / 2)) ? left : right;
};

TabGroupsManager.AllGroups.prototype.dropPositionIsRight = function(sourceTab, targetTab, clientX, isCopy)
{
  var left = targetTab.getBoundingClientRect().left;
  var right = targetTab.getBoundingClientRect().right;
  if (!isCopy)
  {
    if (left == sourceTab.getBoundingClientRect().right)
    {
      return 1;
    }
    else if (right == sourceTab.getBoundingClientRect().left)
    {
      return 0;
    }
  }
  return (clientX < ((left + right) / 2)) ? 0 : 1;
};

TabGroupsManager.AllGroups.prototype.checkCurrentTabInTabsOfMTH = function(tabs)
{
  return (-1 != tabs.indexOf(gBrowser.selectedTab));
};

TabGroupsManager.AllGroups.prototype.searchCurrentTabWithoutTabsOfMTH = function()
{
  var group = gBrowser.selectedTab.group;
  var candidateTab = null;
  for (var tab = gBrowser.selectedTab.nextSibling; tab; tab = tab.nextSibling)
  {
    if (tab.TabGroupsManagerMoveTabTmp !== true)
    {
      if (tab.group == group)
      {
        return tab;
      }
      else if (candidateTab == null)
      {
        candidateTab = tab;
      }
    }
  }
  for (var tab = gBrowser.selectedTab.previousSibling; tab; tab = tab.previousSibling)
  {
    if (tab.TabGroupsManagerMoveTabTmp !== true)
    {
      if (tab.group == group)
      {
        return tab;
      }
      else if (candidateTab == null)
      {
        candidateTab = tab;
      }
    }
  }
  return candidateTab;
};

TabGroupsManager.AllGroups.prototype.moveCurrentTabWithoutTabsOfMTH = function(tabs)
{
  if (!this.checkCurrentTabInTabsOfMTH(tabs))
  {
    return;
  }
  for (var i = 0; i < tabs.length; i++)
  {
    tabs[i].TabGroupsManagerMoveTabTmp = true;
  }
  var newCuttentTab = this.searchCurrentTabWithoutTabsOfMTH();
  if (newCuttentTab)
  {
    gBrowser.selectedTab = newCuttentTab;
  }
  for (var i = 0; i < tabs.length; i++)
  {
    delete tabs[i].TabGroupsManagerMoveTabTmp;
  }
};

TabGroupsManager.AllGroups.prototype.moveTabToGroupInSameWindow = function(tab, group, isCopy)
{
  if (group)
  {
    group.deleteBlankTab();
  }
  else
  {
    group = TabGroupsManager.allGroups.openNewGroupCore();
  }
  if ((group == tab.group || group.displayTabCount <= 1) && group.name == "")
  {
    group.autoRenameNameIcon(tab);
  }
  var tabs = this.checkMultipleTabHandler(tab, window);
  for (var i = 0; i < tabs.length; i++)
  {
    var moveTab = isCopy ? TabGroupsManager.session.duplicateTabEx(window, tabs[i]) : tabs[i];
    group.dndMoveTabToGroup(moveTab);
  }
};

TabGroupsManager.AllGroups.prototype.moveTabToGroupInOtherWindow = function(fromTab, newGroup, isCopy)
{
  var fromWindow = fromTab.ownerDocument.defaultView;
  newGroup = newGroup || TabGroupsManager.allGroups.openNewGroupCore();
  newGroup.deleteBlankTab();
  if (newGroup.displayTabCount <= 1 && newGroup.name == "")
  {
    newGroup.autoRenameNameIcon(fromTab);
  }
  var tabs = this.checkMultipleTabHandler(fromTab, fromWindow);
  for (var i = 0; i < tabs.length; i++)
  {
    var moveTab = isCopy ? TabGroupsManager.session.duplicateTabEx(fromWindow, tabs[i]) : tabs[i];
    this.makeNewTabAndSwapWithOtherWindow(newGroup, moveTab);
  }
};

TabGroupsManager.AllGroups.prototype.checkMultipleTabHandler = function(fromTab, fromWindow)
{
  if ("MultipleTabService" in fromWindow)
  {
    var tabs = fromWindow.MultipleTabService.getBundledTabsOf(fromTab);
    if (tabs.length > 0)
    {
      this.moveCurrentTabWithoutTabsOfMTH(tabs);
      fromWindow.MultipleTabService.clearSelection();
      return tabs;
    }
  }
  return [fromTab];
};

TabGroupsManager.AllGroups.prototype.countNonSuspendedGroups = function()
{
  var count = 0;
  for (var i = 0; i < this.childNodes.length; i++)
  {
    if (!this.childNodes[i].group.suspended)
    {
      count++;
    }
  }
  return count;
};

TabGroupsManager.AllGroups.prototype.makeNonSuspendedGroupsList = function()
{
  let list = new Array();
  for (let i = 0; i < this.childNodes.length; i++)
  {
    if (!this.childNodes[i].group.suspended)
    {
      list.push(this.childNodes[i].group);
    }
  }
  return list;
};

TabGroupsManager.AllGroups.prototype.suspendAllNonSelectedGroups = function()
{
  let data = {
    object: this,
    function: this.suspendAllNonSelectedGroupsProgressFunction,
    title: TabGroupsManager.strings.getString("DialogTitle"),
    message: TabGroupsManager.strings.getString("SuspendingGroups"),
    progressMin: 0,
    progressMax: this.childNodes.length * 1000,
    progressValue: 0
  };
  window.openDialog("chrome://tabgroupsmanager/content/ProgressmeterDialog.xul", "_blank", "chrome,modal,dialog,centerscreen,resizable,close=no,titlebar=no", data);
  this.saveAllGroupsDataImmediately();
};

TabGroupsManager.AllGroups.prototype.suspendAllNonSelectedGroupsProgressFunction = function(progressWindow, progressClass)
{
  try
  {
    AxelUtils.setTimeoutDelegator.exec(progressWindow, this, this.suspendAllNonSelectedGroupsProgressFunctionLoop, 0, [0, progressWindow, progressClass]);
  }
  catch (e)
  {
    progressClass.finalize();
  }
};

TabGroupsManager.AllGroups.prototype.suspendAllNonSelectedGroupsProgressFunctionLoop = function(index, progressWindow, progressClass)
{
  try
  {
    for (; index < this.childNodes.length; index++)
    {
      let group = this.childNodes[index].group;
      if (!group.selected && !group.suspended)
      {
        group.suspendGroup();
        break;
      }
    }
    index++;
    progressClass.progress.value = index * 1000;
    if (index < this.childNodes.length)
    {
      AxelUtils.setTimeoutDelegator.exec(progressWindow, this, this.suspendAllNonSelectedGroupsProgressFunctionLoop, 0, [index, progressWindow, progressClass]);
    }
    else
    {
      progressClass.finalize();
    }
  }
  catch (e)
  {
    progressClass.finalize();
  }
};

TabGroupsManager.AllGroups.prototype.readDummyBlankPage = function()
{
  let linkedBrowser = gBrowser.selectedTab.linkedBrowser;
  if (linkedBrowser.currentURI.spec == "about:blank")
  {
    linkedBrowser.loadURI("chrome://tabgroupsmanager/content/blank.html");
  }
};

TabGroupsManager.AllGroups.prototype.waitDummyBlankPage = function()
{
  if (gBrowser.selectedTab.linkedBrowser.currentURI.spec != "about:blank")
  {
    return;
  }
  let data = {
    object: this,
    function: this.dummyBlankPageForTmpProgress,
    title: "",
    message: ""
  };
  window.openDialog("chrome://tabgroupsmanager/content/ProgressmeterDialog.xul", "_blank", "chrome,modal,dialog,centerscreen,resizable,close=no,titlebar=no", data);
};

TabGroupsManager.AllGroups.prototype.dummyBlankPageForTmpProgress = function(progressWindow, progressClass, index)
{
  try
  {
    index = (index == undefined) ? 0 : index + 1;
    if (index < 50 && gBrowser.selectedTab.linkedBrowser.currentURI.spec == "about:blank")
    {
      AxelUtils.setTimeoutDelegator.exec(progressWindow, this, this.dummyBlankPageForTmpProgress, 100, [progressWindow, progressClass, index]);
      return;
    }
  }
  catch (e)
  {}
  progressClass.finalize();
};
